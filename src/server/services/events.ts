import "server-only";
import type { ParticipantRole, Prisma } from "@/generated/prisma/client";
import { DEPENDENCY_META, type DependencyTypeKey } from "@/domain/catalog";
import { eventOrdinals } from "@/domain/chronology";
import { findCycleIfAdded } from "@/domain/graph";
import { dependencyInputSchema, eventInputSchema, type EventInput } from "@/domain/schemas";
import { slugify, uniqueSlug } from "@/lib/slug";
import { db, type DbOrTx } from "../db";
import { conflict, invalid, notFound } from "../errors";
import { assertEntitiesInUniverse, requireAccess } from "./access";
import { recordActivity } from "./activity";
import { createRevision, eventSnapshot } from "./revisions";
import { mainTimeline, resolveTimelineId, timelineChain } from "./snapshot";

function eventData(input: ReturnType<typeof eventInputSchema.parse>) {
  const ord = eventOrdinals(input);
  return {
    title: input.title,
    description: input.description,
    eventType: input.eventType,
    startYear: input.startYear,
    startMonth: input.startMonth ?? null,
    startDay: input.startDay ?? null,
    endYear: input.endYear ?? null,
    endMonth: input.endYear != null ? input.endMonth ?? null : null,
    endDay: input.endYear != null ? input.endDay ?? null : null,
    precision: input.precision,
    displayDate: input.displayDate || null,
    importance: input.importance,
    locationId: input.locationId ?? null,
    canonStatus: input.canonStatus,
    startOrdinal: ord.startOrdinal,
    endOrdinal: ord.endOrdinal,
  };
}

export async function createEvent(userId: string, universeId: string, raw: EventInput & { timelineId?: string | null }, client?: DbOrTx) {
  await requireAccess(userId, universeId, "content:write");
  const input = eventInputSchema.parse(raw);
  const run = async (tx: DbOrTx) => {
    await assertEntitiesInUniverse(tx, universeId, [input.locationId, ...input.participants.map((p) => p.entityId)]);
    const timelineId = raw.timelineId ? await resolveTimelineId(universeId, raw.timelineId, tx) : (await mainTimeline(universeId, tx)).id;
    const base = slugify(input.title);
    const taken = await tx.historicalEvent.findMany({ where: { universeId, slug: { startsWith: base } }, select: { slug: true } });
    const ev = await tx.historicalEvent.create({
      data: {
        universeId,
        timelineId,
        slug: uniqueSlug(base, taken.map((t) => t.slug)),
        createdById: userId,
        ...eventData(input),
        participants: {
          create: dedupeParticipants(input.participants).map((p) => ({ entityId: p.entityId, role: p.role as ParticipantRole, note: p.note ?? null })),
        },
      },
    });
    await createRevision(tx, {
      universeId, recordType: "EVENT", recordId: ev.id, version: 1, snapshot: { ...eventSnapshot(ev), participants: input.participants },
      summary: "Created", authorId: userId, timelineId,
    });
    await recordActivity(tx, { universeId, actorId: userId, action: "event.created", targetType: "EVENT", targetId: ev.id, summary: `Recorded event “${ev.title}”` });
    return ev;
  };
  return client ? run(client) : db.$transaction(run);
}

function dedupeParticipants<T extends { entityId: string; role: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((p) => {
    const k = `${p.entityId}:${p.role}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function updateEvent(userId: string, universeId: string, eventId: string, raw: EventInput, expectedVersion: number) {
  await requireAccess(userId, universeId, "content:write");
  const input = eventInputSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const current = await tx.historicalEvent.findFirst({ where: { id: eventId, universeId } });
    if (!current) throw notFound("Event");
    await assertEntitiesInUniverse(tx, universeId, [input.locationId, ...input.participants.map((p) => p.entityId)]);
    const res = await tx.historicalEvent.updateMany({
      where: { id: eventId, version: expectedVersion },
      data: { ...eventData(input), version: { increment: 1 } },
    });
    if (!res.count) throw conflict("This event was changed by someone else. Reload to see the latest version before saving.");
    await tx.eventParticipant.deleteMany({ where: { eventId } });
    await tx.eventParticipant.createMany({
      data: dedupeParticipants(input.participants).map((p) => ({ eventId, entityId: p.entityId, role: p.role as ParticipantRole, note: p.note ?? null })),
    });
    const updated = await tx.historicalEvent.findUniqueOrThrow({ where: { id: eventId } });
    await createRevision(tx, {
      universeId, recordType: "EVENT", recordId: eventId, version: updated.version,
      snapshot: { ...eventSnapshot(updated), participants: input.participants }, summary: "Edited", authorId: userId, timelineId: updated.timelineId,
    });
    await recordActivity(tx, { universeId, actorId: userId, action: "event.updated", targetType: "EVENT", targetId: eventId, summary: `Edited event “${updated.title}”` });
    return updated;
  });
}

export async function setEventArchived(userId: string, universeId: string, eventId: string, archived: boolean) {
  await requireAccess(userId, universeId, "content:write");
  return db.$transaction(async (tx) => {
    const ev = await tx.historicalEvent.findFirst({ where: { id: eventId, universeId } });
    if (!ev) throw notFound("Event");
    const updated = await tx.historicalEvent.update({ where: { id: eventId }, data: { archivedAt: archived ? new Date() : null, version: { increment: 1 } } });
    await createRevision(tx, {
      universeId, recordType: "EVENT", recordId: eventId, version: updated.version, snapshot: eventSnapshot(updated),
      summary: archived ? "Archived" : "Restored from archive", authorId: userId, timelineId: ev.timelineId,
    });
    await recordActivity(tx, { universeId, actorId: userId, action: archived ? "event.archived" : "event.restored", targetType: "EVENT", targetId: eventId, summary: `${archived ? "Archived" : "Restored"} event “${ev.title}”` });
    return updated;
  });
}

export async function restoreEventRevision(userId: string, universeId: string, eventId: string, revisionId: string) {
  await requireAccess(userId, universeId, "content:write");
  return db.$transaction(async (tx) => {
    const rev = await tx.revision.findFirst({ where: { id: revisionId, universeId, recordType: "EVENT", recordId: eventId } });
    if (!rev) throw notFound("Revision");
    const snap = rev.snapshot as ReturnType<typeof eventSnapshot>;
    const input = eventInputSchema.parse({ ...snap, participants: [] });
    const updated = await tx.historicalEvent.update({
      where: { id: eventId },
      data: { ...eventData(input), version: { increment: 1 } },
    });
    await createRevision(tx, {
      universeId, recordType: "EVENT", recordId: eventId, version: updated.version, snapshot: eventSnapshot(updated),
      summary: `Restored version ${rev.version}`, authorId: userId, timelineId: updated.timelineId,
    });
    await recordActivity(tx, { universeId, actorId: userId, action: "event.restored_revision", targetType: "EVENT", targetId: eventId, summary: `Restored “${updated.title}” to version ${rev.version}` });
    return updated;
  });
}

export async function getEvent(userId: string, universeId: string, eventId: string) {
  const access = await requireAccess(userId, universeId, "universe:read");
  const event = await db.historicalEvent.findFirst({
    where: { id: eventId, universeId },
    include: {
      timeline: { select: { id: true, name: true, isMain: true } },
      location: { select: { id: true, name: true, type: true } },
      participants: { include: { entity: { select: { id: true, name: true, type: true, status: true } } }, orderBy: { role: "asc" } },
      dependsOn: { include: { source: { select: { id: true, title: true, startYear: true, precision: true, startMonth: true, startDay: true, endYear: true, endMonth: true, endDay: true, displayDate: true } } } },
      enables: { include: { target: { select: { id: true, title: true, startYear: true, precision: true, startMonth: true, startDay: true, endYear: true, endMonth: true, endDay: true, displayDate: true } } } },
      loreLinks: { where: { document: { archivedAt: null } }, include: { document: { select: { id: true, title: true, category: true } } } },
      originOf: { where: { archivedAt: null }, include: { source: { select: { id: true, name: true, type: true } }, target: { select: { id: true, name: true, type: true } } } },
      endOf: { where: { archivedAt: null }, include: { source: { select: { id: true, name: true, type: true } }, target: { select: { id: true, name: true, type: true } } } },
      branchPoints: { select: { id: true, name: true } },
    },
  });
  if (!event) throw notFound("Event");
  return { event, role: access.role };
}

export async function eventOptions(userId: string, universeId: string) {
  await requireAccess(userId, universeId, "universe:read");
  return db.historicalEvent.findMany({
    where: { universeId, archivedAt: null },
    select: { id: true, title: true, startYear: true, timelineId: true },
    orderBy: { startOrdinal: "asc" },
    take: 2000,
  });
}

export async function listEvents(
  userId: string,
  universeId: string,
  q: { q?: string; eventType?: string; entityId?: string; page?: number; pageSize?: number } = {},
) {
  await requireAccess(userId, universeId, "universe:read");
  const pageSize = Math.min(q.pageSize ?? 50, 200);
  const page = Math.max(q.page ?? 1, 1);
  const where: Prisma.HistoricalEventWhereInput = {
    universeId,
    archivedAt: null,
    ...(q.eventType ? { eventType: q.eventType } : {}),
    ...(q.entityId ? { OR: [{ participants: { some: { entityId: q.entityId } } }, { locationId: q.entityId }] } : {}),
    ...(q.q ? { title: { contains: q.q, mode: "insensitive" } } : {}),
  };
  const [total, rows] = await Promise.all([
    db.historicalEvent.count({ where }),
    db.historicalEvent.findMany({ where, orderBy: { startOrdinal: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { rows, total, page, pageSize };
}

/** Adds a causal link; rejects cycles for order-bearing link types. */
export async function addDependency(userId: string, universeId: string, raw: unknown, timelineId?: string | null) {
  await requireAccess(userId, universeId, "content:write");
  const input = dependencyInputSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const events = await tx.historicalEvent.findMany({
      where: { id: { in: [input.sourceId, input.targetId] }, universeId, archivedAt: null },
      select: { id: true, title: true, timelineId: true },
    });
    if (events.length !== 2) throw notFound("Event");
    const tid = timelineId ? await resolveTimelineId(universeId, timelineId, tx) : (await mainTimeline(universeId, tx)).id;
    const chain = await timelineChain(universeId, tid, tx);
    if (!events.every((e) => chain.includes(e.timelineId))) throw invalid("Both events must be visible in the selected timeline.");
    if (DEPENDENCY_META[input.type as DependencyTypeKey].requiresOrder) {
      const ordered = await tx.eventDependency.findMany({
        where: { universeId, timelineId: { in: chain }, type: { in: ["CAUSES", "ENABLES", "PRECEDES", "CONTRIBUTES_TO"] } },
        select: { sourceId: true, targetId: true },
      });
      const cycle = findCycleIfAdded(ordered.map((d) => ({ source: d.sourceId, target: d.targetId })), input.sourceId, input.targetId);
      if (cycle) {
        const titles = new Map(events.map((e) => [e.id, e.title]));
        const names = await tx.historicalEvent.findMany({ where: { id: { in: cycle } }, select: { id: true, title: true } });
        for (const n of names) titles.set(n.id, n.title);
        throw invalid(`That link would create a causal loop: ${[...cycle, input.targetId].map((id) => `“${titles.get(id) ?? id}”`).join(" → ")}.`);
      }
    }
    try {
      const dep = await tx.eventDependency.create({
        data: { universeId, timelineId: tid, sourceId: input.sourceId, targetId: input.targetId, type: input.type, note: input.note ?? null },
      });
      await recordActivity(tx, { universeId, actorId: userId, action: "dependency.created", targetType: "EVENT", targetId: input.targetId, summary: `Linked “${events.find((e) => e.id === input.sourceId)?.title}” ${DEPENDENCY_META[input.type].label.toLowerCase()} “${events.find((e) => e.id === input.targetId)?.title}”` });
      return dep;
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw conflict("That link already exists.");
      throw e;
    }
  });
}

export async function removeDependency(userId: string, universeId: string, dependencyId: string) {
  await requireAccess(userId, universeId, "content:write");
  const r = await db.eventDependency.deleteMany({ where: { id: dependencyId, universeId } });
  if (!r.count) throw notFound("Link");
}
