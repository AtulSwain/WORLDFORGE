import "server-only";
import { z } from "zod";
import { CANON_STATUSES } from "@/domain/catalog";
import { DATE_PRECISIONS, eventOrdinals } from "@/domain/chronology";
import type { Tx } from "../db";
import { db } from "../db";
import { conflict, invalid, notFound } from "../errors";
import { requireAccess } from "./access";
import { audit, recordActivity } from "./activity";
import { createRevision, entitySnapshot, eventSnapshot, relationshipSnapshot, toJson } from "./revisions";
import { timelineChain } from "./snapshot";

/**
 * Applying, reverting and promoting timeline changes.
 *
 * - A change to a record owned by the target timeline updates the base row (with a revision)
 *   and is logged as a TimelineChange with appliedToBase = true.
 * - A change to a record inherited from an ancestor is stored only as an overlay
 *   (appliedToBase = false). The ancestor's row is never touched.
 * All functions here expect to run inside a transaction supplied by the caller.
 */

const year = z.number().int().min(-1_000_000).max(1_000_000).nullable();
const month = z.number().int().min(1).max(24).nullable();
const day = z.number().int().min(1).max(40).nullable();
const canon = z.enum(CANON_STATUSES);

export const PATCH_SCHEMAS = {
  EVENT: z
    .object({
      title: z.string().trim().min(1).max(200),
      description: z.string().max(20000),
      eventType: z.string().max(40),
      startYear: z.number().int().min(-1_000_000).max(1_000_000),
      startMonth: month,
      startDay: day,
      endYear: year,
      endMonth: month,
      endDay: day,
      precision: z.enum(DATE_PRECISIONS),
      locationId: z.string().max(64).nullable(),
      importance: z.number().int().min(1).max(5),
      canonStatus: canon,
    })
    .partial()
    .strict(),
  ENTITY: z.object({ status: z.string().max(40), beginYear: year, endYear: year, canonStatus: canon, summary: z.string().max(600) }).partial().strict(),
  RELATIONSHIP: z.object({ validFromYear: year, validToYear: year, canonStatus: canon, description: z.string().max(2000) }).partial().strict(),
} as const;

export type ChangeTarget = keyof typeof PATCH_SCHEMAS;

export interface ChangeSpec {
  targetType: ChangeTarget;
  targetId: string;
  changeType: "UPDATE" | "DELETE";
  patch: Record<string, unknown>;
}

async function loadRecord(tx: Tx, universeId: string, type: ChangeTarget, id: string) {
  if (type === "EVENT") return tx.historicalEvent.findFirst({ where: { id, universeId } });
  if (type === "ENTITY") return tx.entity.findFirst({ where: { id, universeId } });
  return tx.relationship.findFirst({ where: { id, universeId } });
}

function pick(record: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, record[k] ?? null]));
}

export async function applyChange(
  tx: Tx,
  ctx: { universeId: string; timelineId: string; chain: string[]; authorId: string; proposalId?: string | null; sourceEventId?: string | null; reason: string; promotedFromId?: string | null },
  spec: ChangeSpec,
) {
  const record = (await loadRecord(tx, ctx.universeId, spec.targetType, spec.targetId)) as (Record<string, unknown> & { timelineId: string; version: number }) | null;
  if (!record) throw notFound("Changed record");
  if (!ctx.chain.includes(record.timelineId)) throw invalid("A change can only touch records visible in its timeline.");
  const patch = spec.changeType === "DELETE" ? {} : PATCH_SCHEMAS[spec.targetType].parse(spec.patch);
  if (spec.targetType === "EVENT" && "locationId" in patch && patch.locationId) {
    const loc = await tx.entity.findFirst({ where: { id: patch.locationId as string, universeId: ctx.universeId } });
    if (!loc) throw notFound("Location");
  }
  const keys = spec.changeType === "DELETE" ? ["archivedAt"] : Object.keys(patch);
  const previousState = pick(record, keys);
  const ownsRecord = record.timelineId === ctx.timelineId;

  if (!ownsRecord) {
    // Overlay on an inherited record: the ancestor's row is untouched.
    return tx.timelineChange.create({
      data: {
        universeId: ctx.universeId, timelineId: ctx.timelineId, proposalId: ctx.proposalId ?? null, targetType: spec.targetType, targetId: spec.targetId,
        changeType: spec.changeType, previousState: toJson(previousState), proposedState: spec.changeType === "DELETE" ? undefined : toJson(patch),
        appliedToBase: false, sourceEventId: ctx.sourceEventId ?? null, reason: ctx.reason, status: "ACCEPTED", authorId: ctx.authorId,
        promotedFromId: ctx.promotedFromId ?? null,
      },
    });
  }

  // Base update with optimistic concurrency on the row version.
  let newVersion: number;
  const where = { id: spec.targetId, version: record.version };
  if (spec.targetType === "EVENT") {
    const merged = { ...record, ...patch } as unknown as Parameters<typeof eventOrdinals>[0];
    const ord = eventOrdinals(merged);
    const data = spec.changeType === "DELETE" ? { archivedAt: new Date() } : { ...patch, ...ord };
    const r = await tx.historicalEvent.updateMany({ where, data: { ...(data as object), version: { increment: 1 } } });
    if (!r.count) throw conflict("A record changed while the commit was running. Nothing was saved; re-run the analysis.");
    const u = await tx.historicalEvent.findUniqueOrThrow({ where: { id: spec.targetId } });
    newVersion = u.version;
    await createRevision(tx, { universeId: ctx.universeId, recordType: "EVENT", recordId: u.id, version: u.version, snapshot: eventSnapshot(u), summary: ctx.reason.slice(0, 200) || "Living World Engine change", authorId: ctx.authorId, timelineId: ctx.timelineId });
  } else if (spec.targetType === "ENTITY") {
    const data = spec.changeType === "DELETE" ? { archivedAt: new Date() } : patch;
    const r = await tx.entity.updateMany({ where, data: { ...(data as object), version: { increment: 1 } } });
    if (!r.count) throw conflict("A record changed while the commit was running. Nothing was saved; re-run the analysis.");
    const u = await tx.entity.findUniqueOrThrow({ where: { id: spec.targetId } });
    newVersion = u.version;
    await createRevision(tx, { universeId: ctx.universeId, recordType: "ENTITY", recordId: u.id, version: u.version, snapshot: entitySnapshot(u), summary: ctx.reason.slice(0, 200) || "Living World Engine change", authorId: ctx.authorId, timelineId: ctx.timelineId });
  } else {
    const data = spec.changeType === "DELETE" ? { archivedAt: new Date() } : patch;
    const r = await tx.relationship.updateMany({ where, data: { ...(data as object), version: { increment: 1 } } });
    if (!r.count) throw conflict("A record changed while the commit was running. Nothing was saved; re-run the analysis.");
    const u = await tx.relationship.findUniqueOrThrow({ where: { id: spec.targetId } });
    newVersion = u.version;
    await createRevision(tx, { universeId: ctx.universeId, recordType: "RELATIONSHIP", recordId: u.id, version: u.version, snapshot: relationshipSnapshot(u), summary: ctx.reason.slice(0, 200) || "Living World Engine change", authorId: ctx.authorId, timelineId: ctx.timelineId });
  }
  return tx.timelineChange.create({
    data: {
      universeId: ctx.universeId, timelineId: ctx.timelineId, proposalId: ctx.proposalId ?? null, targetType: spec.targetType, targetId: spec.targetId,
      changeType: spec.changeType, previousState: toJson(previousState), proposedState: spec.changeType === "DELETE" ? undefined : toJson(patch),
      appliedToBase: true, resultVersion: newVersion, sourceEventId: ctx.sourceEventId ?? null, reason: ctx.reason, status: "ACCEPTED", authorId: ctx.authorId,
      promotedFromId: ctx.promotedFromId ?? null,
    },
  });
}

/** Locks the timeline row and checks/increments its version (optimistic concurrency). */
export async function bumpTimelineVersion(tx: Tx, timelineId: string, expected?: number | null, increment = true) {
  const rows = await tx.$queryRaw<{ version: number }[]>`SELECT version FROM "Timeline" WHERE id = ${timelineId} FOR UPDATE`;
  const current = rows[0]?.version;
  if (current == null) throw notFound("Timeline");
  if (expected != null && current !== expected) throw conflict("The timeline changed after this analysis was run. Nothing was saved — re-run the analysis to see the current consequences.");
  if (increment) await tx.timeline.update({ where: { id: timelineId }, data: { version: { increment: 1 } } });
}

/** Any direct edit invalidates pending analyses of the timeline that owns the record. */
export async function touchTimeline(tx: Tx | typeof db, timelineId: string) {
  await tx.timeline.update({ where: { id: timelineId }, data: { version: { increment: 1 } } });
}

async function revertOne(tx: Tx, universeId: string, userId: string, changeId: string) {
  const ch = await tx.timelineChange.findFirst({ where: { id: changeId, universeId } });
  if (!ch) throw notFound("Change");
  if (ch.status !== "ACCEPTED") throw invalid("Only accepted changes can be reverted.");
  if (ch.appliedToBase) {
    const type = ch.targetType as ChangeTarget;
    const record = (await loadRecord(tx, universeId, type, ch.targetId)) as ({ version: number; timelineId: string } & Record<string, unknown>) | null;
    if (!record) throw notFound("Changed record");
    if (record.version !== ch.resultVersion) {
      throw conflict("This record was edited after the change, so undoing it here could discard later work. Restore an earlier version from the record's revision history instead.");
    }
    const prev = (ch.previousState ?? {}) as Record<string, unknown>;
    const reason = `Reverted change: ${ch.reason}`.slice(0, 200);
    if (type === "EVENT") {
      const merged = { ...record, ...prev } as unknown as Parameters<typeof eventOrdinals>[0];
      await tx.historicalEvent.update({ where: { id: ch.targetId }, data: { ...prev, ...eventOrdinals(merged), version: { increment: 1 } } });
      const u = await tx.historicalEvent.findUniqueOrThrow({ where: { id: ch.targetId } });
      await createRevision(tx, { universeId, recordType: "EVENT", recordId: u.id, version: u.version, snapshot: eventSnapshot(u), summary: reason, authorId: userId, timelineId: ch.timelineId });
    } else if (type === "ENTITY") {
      await tx.entity.update({ where: { id: ch.targetId }, data: { ...prev, version: { increment: 1 } } });
      const u = await tx.entity.findUniqueOrThrow({ where: { id: ch.targetId } });
      await createRevision(tx, { universeId, recordType: "ENTITY", recordId: u.id, version: u.version, snapshot: entitySnapshot(u), summary: reason, authorId: userId, timelineId: ch.timelineId });
    } else {
      await tx.relationship.update({ where: { id: ch.targetId }, data: { ...prev, version: { increment: 1 } } });
      const u = await tx.relationship.findUniqueOrThrow({ where: { id: ch.targetId } });
      await createRevision(tx, { universeId, recordType: "RELATIONSHIP", recordId: u.id, version: u.version, snapshot: relationshipSnapshot(u), summary: reason, authorId: userId, timelineId: ch.timelineId });
    }
  } else {
    const later = await tx.timelineChange.findFirst({
      where: { timelineId: ch.timelineId, targetId: ch.targetId, status: "ACCEPTED", createdAt: { gt: ch.createdAt }, id: { not: ch.id } },
    });
    if (later) throw conflict("A later change in this timeline builds on this one. Revert the later change first.");
  }
  await tx.timelineChange.update({ where: { id: ch.id }, data: { status: "REVERTED", revertedAt: new Date() } });
  return ch;
}

export async function revertChange(userId: string, universeId: string, changeId: string) {
  await requireAccess(userId, universeId, "timeline:branch");
  return db.$transaction(async (tx) => {
    const ch = await revertOne(tx, universeId, userId, changeId);
    await bumpTimelineVersion(tx, ch.timelineId);
    await recordActivity(tx, { universeId, actorId: userId, action: "change.reverted", targetType: "TIMELINE", targetId: ch.timelineId, summary: `Undid a change: ${ch.reason || ch.targetType.toLowerCase()}` });
    return ch;
  });
}

/** Restores a timeline to its state before `changeId` by reverting it and every later change, newest first. */
export async function revertTimelineTo(userId: string, universeId: string, changeId: string) {
  await requireAccess(userId, universeId, "timeline:branch");
  return db.$transaction(async (tx) => {
    const anchor = await tx.timelineChange.findFirst({ where: { id: changeId, universeId } });
    if (!anchor) throw notFound("Change");
    const list = await tx.timelineChange.findMany({
      where: { timelineId: anchor.timelineId, status: "ACCEPTED", createdAt: { gte: anchor.createdAt } },
      orderBy: { createdAt: "desc" },
    });
    for (const c of list) await revertOne(tx, universeId, userId, c.id);
    await bumpTimelineVersion(tx, anchor.timelineId);
    await recordActivity(tx, { universeId, actorId: userId, action: "timeline.restored", targetType: "TIMELINE", targetId: anchor.timelineId, summary: `Restored a timeline to before ${list.length} change(s)` });
    await audit({ userId, universeId, action: "timeline.restore_point", metadata: { timelineId: anchor.timelineId, reverted: list.length } }, tx);
    return list.length;
  }, { timeout: 30_000 });
}

/** Applies a branch overlay to the branch's parent timeline (explicit, user-initiated). */
export async function promoteChange(userId: string, universeId: string, changeId: string) {
  await requireAccess(userId, universeId, "timeline:branch");
  return db.$transaction(async (tx) => {
    const ch = await tx.timelineChange.findFirst({ where: { id: changeId, universeId, status: "ACCEPTED" }, include: { timeline: true } });
    if (!ch) throw notFound("Change");
    if (!ch.timeline.parentId) throw invalid("Changes on the main timeline have no parent to promote to.");
    const parentId = ch.timeline.parentId;
    const chain = await timelineChain(universeId, parentId, tx);
    const promoted = await applyChange(
      tx,
      { universeId, timelineId: parentId, chain, authorId: userId, sourceEventId: ch.sourceEventId, reason: `Promoted from “${ch.timeline.name}”: ${ch.reason}`.slice(0, 500), promotedFromId: ch.id },
      { targetType: ch.targetType as ChangeTarget, targetId: ch.targetId, changeType: ch.changeType === "DELETE" ? "DELETE" : "UPDATE", patch: (ch.proposedState ?? {}) as Record<string, unknown> },
    );
    await bumpTimelineVersion(tx, parentId);
    await recordActivity(tx, { universeId, actorId: userId, action: "change.promoted", targetType: "TIMELINE", targetId: parentId, summary: `Promoted a change from “${ch.timeline.name}” into its parent` });
    await audit({ userId, universeId, action: "change.promote", metadata: { changeId, parentId } }, tx);
    return promoted;
  });
}

/** Moves a record created in a branch into the branch's parent. */
export async function promoteRecord(userId: string, universeId: string, timelineId: string, type: ChangeTarget, recordId: string) {
  await requireAccess(userId, universeId, "timeline:branch");
  return db.$transaction(async (tx) => {
    const t = await tx.timeline.findFirst({ where: { id: timelineId, universeId } });
    if (!t?.parentId) throw invalid("Only branch records can be promoted.");
    const parentChain = await timelineChain(universeId, t.parentId, tx);
    const record = (await loadRecord(tx, universeId, type, recordId)) as ({ timelineId: string } & Record<string, unknown>) | null;
    if (!record || record.timelineId !== timelineId) throw notFound("Branch record");
    // Every record it references must already be visible in the parent.
    const refs: string[] = [];
    if (type === "RELATIONSHIP") refs.push(record.sourceId as string, record.targetId as string);
    if (type === "EVENT") {
      const parts = await tx.eventParticipant.findMany({ where: { eventId: recordId }, select: { entityId: true } });
      refs.push(...parts.map((p) => p.entityId));
      if (record.locationId) refs.push(record.locationId as string);
    }
    if (refs.length) {
      const visible = await tx.entity.count({ where: { id: { in: refs }, timelineId: { in: parentChain } } });
      if (visible !== new Set(refs).size) throw invalid("This record references entities that exist only in the branch. Promote those first.");
    }
    const data = { timelineId: t.parentId, version: { increment: 1 } };
    if (type === "EVENT") {
      await tx.historicalEvent.update({ where: { id: recordId }, data });
      await tx.eventDependency.updateMany({ where: { OR: [{ sourceId: recordId }, { targetId: recordId }], timelineId }, data: { timelineId: t.parentId } });
    } else if (type === "ENTITY") await tx.entity.update({ where: { id: recordId }, data });
    else await tx.relationship.update({ where: { id: recordId }, data });
    await bumpTimelineVersion(tx, t.parentId);
    await recordActivity(tx, { universeId, actorId: userId, action: "record.promoted", targetType: type, targetId: recordId, summary: `Promoted a ${type.toLowerCase()} from “${t.name}” into its parent` });
  });
}

export async function listChanges(userId: string, universeId: string, timelineId: string) {
  await requireAccess(userId, universeId, "universe:read");
  return db.timelineChange.findMany({
    where: { universeId, timelineId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { proposal: { select: { id: true, title: true } } },
  });
}
