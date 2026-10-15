import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { analyzeImpact, ImpactError, type ImpactReport, type SuggestedChange } from "@/domain/impact";
import { calendarSchema, eventPatchSchema, parseSettings } from "@/domain/schemas";
import { db } from "../db";
import { conflict, invalid, notFound } from "../errors";
import { requireAccess } from "./access";
import { audit, recordActivity } from "./activity";
import { toJson } from "./revisions";
import { loadSnapshot, timelineChain } from "./snapshot";
import { applyChange, bumpTimelineVersion, PATCH_SCHEMAS, type ChangeTarget } from "./changes";
import { suggestImpacts } from "../ai/service";
import { impactSuggestionsSchema } from "../ai/schemas";

export const proposalCreateSchema = z.object({
  timelineId: z.string().min(1).max(64),
  sourceEventId: z.string().min(1).max(64),
  title: z.string().trim().min(3, "Describe the change in a few words.").max(200),
  rationale: z.string().max(2000).default(""),
  patch: eventPatchSchema,
});

export async function createProposal(userId: string, universeId: string, raw: unknown) {
  await requireAccess(userId, universeId, "timeline:branch");
  const input = proposalCreateSchema.parse(raw);
  const chain = await timelineChain(universeId, input.timelineId);
  const ev = await db.historicalEvent.findFirst({ where: { id: input.sourceEventId, universeId, timelineId: { in: chain }, archivedAt: null } });
  if (!ev) throw invalid("The event must be visible in the selected timeline.");
  const proposal = await db.changeProposal.create({
    data: { universeId, timelineId: input.timelineId, sourceEventId: input.sourceEventId, title: input.title, rationale: input.rationale, patch: toJson(input.patch), createdById: userId },
  });
  await recordActivity(db, { universeId, actorId: userId, action: "proposal.created", targetType: "PROPOSAL", targetId: proposal.id, summary: `Proposed: ${proposal.title}` });
  return proposal;
}

/** Current values of the fields a suggestion would change, for the review table. */
async function currentValues(universeId: string, c: SuggestedChange): Promise<Record<string, unknown>> {
  const keys = c.changeType === "DELETE" ? ["archivedAt"] : Object.keys(c.patch);
  const rec =
    c.targetType === "EVENT"
      ? await db.historicalEvent.findFirst({ where: { id: c.targetId, universeId } })
      : c.targetType === "ENTITY"
        ? await db.entity.findFirst({ where: { id: c.targetId, universeId } })
        : await db.relationship.findFirst({ where: { id: c.targetId, universeId } });
  const r = (rec ?? {}) as Record<string, unknown>;
  return Object.fromEntries(keys.map((k) => [k, r[k] ?? null]));
}

/** Runs the deterministic engine and replaces the proposal's deterministic items. AI items are kept. */
export async function analyzeProposal(userId: string, universeId: string, proposalId: string) {
  await requireAccess(userId, universeId, "timeline:branch");
  const proposal = await db.changeProposal.findFirst({ where: { id: proposalId, universeId } });
  if (!proposal) throw notFound("Proposal");
  if (proposal.status === "COMMITTED" || proposal.status === "DISCARDED") throw invalid("This proposal is closed.");
  const [universe, timeline, snapshot] = await Promise.all([
    db.universe.findUniqueOrThrow({ where: { id: universeId }, select: { calendar: true, settings: true } }),
    db.timeline.findUniqueOrThrow({ where: { id: proposal.timelineId }, select: { version: true } }),
    loadSnapshot(universeId, proposal.timelineId),
  ]);
  let report: ImpactReport;
  try {
    report = analyzeImpact(snapshot, proposal.sourceEventId, eventPatchSchema.parse(proposal.patch), {
      settings: parseSettings(universe.settings),
      calendar: calendarSchema.parse(universe.calendar ?? {}),
    });
  } catch (e) {
    if (e instanceof ImpactError) throw invalid(e.message);
    throw e;
  }
  const items = await Promise.all(
    report.items.map(async (item, i) => ({
      proposalId,
      category: item.category,
      title: item.title,
      description: item.description,
      basis: item.basis,
      strength: item.strength,
      affected: toJson(item.affected),
      evidence: toJson(item.evidence),
      suggestedChange: item.suggestedChange ? toJson({ ...item.suggestedChange, before: await currentValues(universeId, item.suggestedChange) }) : undefined,
      // The primary change is pre-accepted; everything else waits for review.
      status: item.basis === "PRIMARY_CHANGE" ? ("ACCEPTED" as const) : ("PENDING" as const),
      sortOrder: i,
    })),
  );
  const sourceEvent = snapshot.events.find((e) => e.id === proposal.sourceEventId)!;
  await db.$transaction(async (tx) => {
    await tx.impactItem.deleteMany({ where: { proposalId, basis: { not: "AI_INFERENCE" } } });
    await tx.impactItem.createMany({ data: items });
    await tx.changeProposal.update({
      where: { id: proposalId },
      data: {
        status: "ANALYZED",
        analyzedVersion: timeline.version,
        sourceVersion: sourceEvent.version,
        report: toJson({
          fieldChanges: report.fieldChanges,
          cancelled: report.cancelled,
          newFindings: report.newFindings,
          resolvedFindings: report.resolvedFindings,
          stats: report.stats,
          analyzedAt: new Date().toISOString(),
        }),
      },
    });
  });
  return report;
}

const reviewSchema = z.object({ status: z.enum(["ACCEPTED", "REJECTED", "PENDING"]), patch: z.record(z.string(), z.unknown()).optional() });

export async function reviewItem(userId: string, universeId: string, itemId: string, raw: unknown) {
  await requireAccess(userId, universeId, "timeline:branch");
  const input = reviewSchema.parse(raw);
  const item = await db.impactItem.findFirst({ where: { id: itemId, proposal: { universeId } }, include: { proposal: true } });
  if (!item) throw notFound("Impact item");
  if (item.proposal.status !== "ANALYZED") throw invalid("This proposal is not open for review.");
  if (item.basis === "PRIMARY_CHANGE" && input.status !== "ACCEPTED") throw invalid("The proposed change itself cannot be rejected — discard the proposal instead.");
  let suggestedChange = item.suggestedChange as (SuggestedChange & { before?: unknown }) | null;
  if (input.patch) {
    if (!suggestedChange || suggestedChange.changeType === "DELETE") throw invalid("This item has no editable change.");
    const patch = PATCH_SCHEMAS[suggestedChange.targetType as ChangeTarget].parse(input.patch);
    suggestedChange = { ...suggestedChange, patch };
  }
  return db.impactItem.update({
    where: { id: itemId },
    data: { status: input.status, decidedAt: new Date(), ...(input.patch ? { suggestedChange: toJson(suggestedChange) } : {}) },
  });
}

export async function reviewAll(userId: string, universeId: string, proposalId: string, status: "ACCEPTED" | "REJECTED") {
  await requireAccess(userId, universeId, "timeline:branch");
  const p = await db.changeProposal.findFirst({ where: { id: proposalId, universeId, status: "ANALYZED" } });
  if (!p) throw notFound("Open proposal");
  // Bulk accept only touches items with concrete, deterministic changes; AI items stay individual.
  await db.impactItem.updateMany({
    where: { proposalId, status: "PENDING", basis: { notIn: ["PRIMARY_CHANGE", "AI_INFERENCE"] }, ...(status === "ACCEPTED" ? { suggestedChange: { not: Prisma.DbNull } } : {}) },
    data: { status, decidedAt: new Date() },
  });
}

export async function addAiPossibilities(userId: string, universeId: string, proposalId: string) {
  const suggestion = await suggestImpacts(userId, universeId, proposalId);
  const output = impactSuggestionsSchema.parse(suggestion.output);
  // Never trust model-generated ids: keep only those that exist in this universe.
  const ids = output.impacts.flatMap((i) => i.affectedIds);
  const [entities, events] = await Promise.all([
    db.entity.findMany({ where: { universeId, id: { in: ids } }, select: { id: true, name: true } }),
    db.historicalEvent.findMany({ where: { universeId, id: { in: ids } }, select: { id: true, title: true } }),
  ]);
  const label = new Map<string, { type: "ENTITY" | "EVENT"; label: string }>([
    ...entities.map((e) => [e.id, { type: "ENTITY" as const, label: e.name }] as const),
    ...events.map((e) => [e.id, { type: "EVENT" as const, label: e.title }] as const),
  ]);
  const count = await db.impactItem.count({ where: { proposalId } });
  await db.impactItem.createMany({
    data: output.impacts.map((i, n) => ({
      proposalId,
      category: "AI",
      title: i.title,
      description: `${i.description}\n\nReasoning: ${i.reasoning}`,
      basis: "AI_INFERENCE" as const,
      strength: "POSSIBLE",
      affected: toJson(i.affectedIds.filter((id) => label.has(id)).map((id) => ({ id, ...label.get(id)! }))),
      evidence: toJson([{ type: "TIMELINE", id: suggestion.id, label: suggestion.isDemo ? "Demo sample output" : `AI suggestion (${suggestion.model})`, note: i.category }]),
      status: "PENDING" as const,
      sortOrder: count + n,
    })),
  });
  await db.aiSuggestion.update({ where: { id: suggestion.id }, data: { status: "ACCEPTED", decidedAt: new Date() } });
  return output.impacts.length;
}

export const commitSchema = z.object({
  target: z.enum(["CURRENT", "NEW_BRANCH"]),
  branchName: z.string().trim().max(120).optional(),
  branchDescription: z.string().max(2000).optional(),
});

/**
 * Applies the primary change and every accepted suggestion atomically. Optimistic concurrency:
 * the analysed timeline must still be at the version observed during analysis.
 */
export async function commitProposal(userId: string, universeId: string, proposalId: string, raw: unknown) {
  await requireAccess(userId, universeId, "timeline:branch");
  const input = commitSchema.parse(raw);
  return db.$transaction(
    async (tx) => {
      const proposal = await tx.changeProposal.findFirst({ where: { id: proposalId, universeId }, include: { items: true, timeline: true, sourceEvent: true } });
      if (!proposal) throw notFound("Proposal");
      if (proposal.status !== "ANALYZED") throw invalid(proposal.status === "COMMITTED" ? "This proposal was already committed." : "Run the analysis before committing.");
      if (proposal.items.some((i) => i.status === "PENDING" && i.suggestedChange)) {
        throw invalid("Some suggested changes are still pending. Accept or reject each one before committing.");
      }
      // Optimistic concurrency against the analysed timeline.
      // A new branch leaves its parent untouched, so the parent is only checked, not bumped.
      await bumpTimelineVersion(tx, proposal.timelineId, proposal.analyzedVersion, input.target === "CURRENT");

      let targetTimelineId = proposal.timelineId;
      if (input.target === "NEW_BRANCH") {
        const name = input.branchName?.trim() || `What if: ${proposal.title}`.slice(0, 120);
        const branch = await tx.timeline.create({
          data: { universeId, name, description: input.branchDescription ?? proposal.rationale, parentId: proposal.timelineId, branchEventId: proposal.sourceEventId },
        });
        targetTimelineId = branch.id;
        await recordActivity(tx, { universeId, actorId: userId, action: "timeline.branched", targetType: "TIMELINE", targetId: branch.id, summary: `Branched “${branch.name}” from “${proposal.timeline.name}”` });
      } else if (proposal.timeline.status !== "ACTIVE") {
        throw invalid("The target timeline is archived.");
      }
      const chain = await timelineChain(universeId, targetTimelineId, tx);
      const accepted = proposal.items
        .filter((i) => i.status === "ACCEPTED" && i.suggestedChange)
        .sort((a, b) => (a.basis === "PRIMARY_CHANGE" ? -1 : b.basis === "PRIMARY_CHANGE" ? 1 : a.sortOrder - b.sortOrder));
      // De-duplicate multiple accepted changes to the same record by merging their patches in order.
      const merged = new Map<string, { spec: SuggestedChange; reasons: string[] }>();
      for (const item of accepted) {
        const c = item.suggestedChange as unknown as SuggestedChange;
        const key = `${c.targetType}:${c.targetId}`;
        const cur = merged.get(key);
        if (!cur) merged.set(key, { spec: { ...c }, reasons: [item.title] });
        else if (c.changeType === "DELETE" || cur.spec.changeType === "DELETE") {
          cur.spec = { ...c, changeType: "DELETE", patch: {} };
          cur.reasons.push(item.title);
        } else {
          cur.spec = { ...cur.spec, patch: { ...cur.spec.patch, ...c.patch } };
          cur.reasons.push(item.title);
        }
      }
      for (const { spec, reasons } of merged.values()) {
        await applyChange(
          tx,
          { universeId, timelineId: targetTimelineId, chain, authorId: userId, proposalId, sourceEventId: proposal.sourceEventId, reason: reasons.join(" · ").slice(0, 500) },
          { targetType: spec.targetType as ChangeTarget, targetId: spec.targetId, changeType: spec.changeType, patch: spec.patch },
        );
      }
      if (targetTimelineId !== proposal.timelineId) await tx.timeline.update({ where: { id: targetTimelineId }, data: { version: 1 } });
      await tx.changeProposal.update({ where: { id: proposalId }, data: { status: "COMMITTED", committedTimelineId: targetTimelineId } });
      await recordActivity(tx, { universeId, actorId: userId, action: "proposal.committed", targetType: "PROPOSAL", targetId: proposalId, summary: `Committed “${proposal.title}” (${merged.size} change${merged.size === 1 ? "" : "s"})` });
      await audit({ userId, universeId, action: "proposal.commit", metadata: { proposalId, targetTimelineId, changes: merged.size } }, tx);
      return { timelineId: targetTimelineId, changes: merged.size };
    },
    { timeout: 30_000 },
  );
}

export async function discardProposal(userId: string, universeId: string, proposalId: string) {
  await requireAccess(userId, universeId, "timeline:branch");
  const r = await db.changeProposal.updateMany({ where: { id: proposalId, universeId, status: { in: ["DRAFT", "ANALYZED"] } }, data: { status: "DISCARDED" } });
  if (!r.count) throw conflict("This proposal can no longer be discarded.");
}

export async function getProposal(userId: string, universeId: string, proposalId: string) {
  await requireAccess(userId, universeId, "universe:read");
  const p = await db.changeProposal.findFirst({
    where: { id: proposalId, universeId },
    include: { items: { orderBy: { sortOrder: "asc" } }, sourceEvent: true, timeline: { select: { id: true, name: true, isMain: true, version: true } } },
  });
  if (!p) throw notFound("Proposal");
  return p;
}

export async function listProposals(userId: string, universeId: string) {
  await requireAccess(userId, universeId, "universe:read");
  return db.changeProposal.findMany({
    where: { universeId },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { id: true, title: true, status: true, updatedAt: true, timeline: { select: { name: true } }, _count: { select: { items: true } } },
  });
}
