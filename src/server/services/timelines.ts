import "server-only";
import { branchCreateSchema } from "@/domain/schemas";
import { diffSnapshots } from "@/domain/timeline-resolution";
import { db } from "../db";
import { conflict, invalid, notFound } from "../errors";
import { requireAccess } from "./access";
import { recordActivity, audit } from "./activity";
import { loadSnapshot, timelineChain } from "./snapshot";

/** Creates a branch. Nothing is copied: the branch inherits every record of its parent. */
export async function createBranch(userId: string, universeId: string, raw: unknown) {
  await requireAccess(userId, universeId, "timeline:branch");
  const input = branchCreateSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const parent = await tx.timeline.findFirst({ where: { id: input.parentId, universeId } });
    if (!parent) throw notFound("Parent timeline");
    if (parent.status !== "ACTIVE") throw invalid("Archived timelines cannot be branched. Restore it first.");
    if (input.branchEventId) {
      const chain = await timelineChain(universeId, parent.id, tx);
      const ev = await tx.historicalEvent.findFirst({ where: { id: input.branchEventId, universeId, timelineId: { in: chain } } });
      if (!ev) throw invalid("The branching event must be visible in the parent timeline.");
    }
    const branch = await tx.timeline.create({
      data: { universeId, name: input.name, description: input.description, parentId: parent.id, branchEventId: input.branchEventId ?? null },
    });
    await recordActivity(tx, { universeId, actorId: userId, action: "timeline.branched", targetType: "TIMELINE", targetId: branch.id, summary: `Branched “${branch.name}” from “${parent.name}”` });
    return branch;
  });
}

export async function listTimelines(userId: string, universeId: string) {
  await requireAccess(userId, universeId, "universe:read");
  return db.timeline.findMany({
    where: { universeId },
    orderBy: [{ isMain: "desc" }, { createdAt: "asc" }],
    include: {
      branchEvent: { select: { id: true, title: true, startYear: true } },
      parent: { select: { id: true, name: true } },
      _count: { select: { changes: { where: { status: "ACCEPTED" } }, events: { where: { archivedAt: null } }, children: true } },
    },
  });
}

export async function setTimelineStatus(userId: string, universeId: string, timelineId: string, status: "ACTIVE" | "ARCHIVED") {
  await requireAccess(userId, universeId, "timeline:branch");
  const t = await db.timeline.findFirst({ where: { id: timelineId, universeId } });
  if (!t) throw notFound("Timeline");
  if (t.isMain) throw invalid("The main timeline cannot be archived.");
  await db.timeline.update({ where: { id: timelineId }, data: { status } });
  await recordActivity(db, { universeId, actorId: userId, action: status === "ARCHIVED" ? "timeline.archived" : "timeline.restored", targetType: "TIMELINE", targetId: timelineId, summary: `${status === "ARCHIVED" ? "Archived" : "Restored"} timeline “${t.name}”` });
}

export async function renameTimeline(userId: string, universeId: string, timelineId: string, name: string, description: string) {
  await requireAccess(userId, universeId, "timeline:branch");
  const clean = name.trim().slice(0, 120);
  if (clean.length < 2) throw invalid("Name the timeline.");
  const r = await db.timeline.updateMany({ where: { id: timelineId, universeId }, data: { name: clean, description: description.slice(0, 2000) } });
  if (!r.count) throw notFound("Timeline");
}

/** Field-level comparison between a branch and its parent (resolved views). */
export async function compareWithParent(userId: string, universeId: string, timelineId: string) {
  await requireAccess(userId, universeId, "universe:read");
  const t = await db.timeline.findFirst({ where: { id: timelineId, universeId } });
  if (!t) throw notFound("Timeline");
  if (!t.parentId) throw invalid("The main timeline has no parent to compare with.");
  const [parent, branch] = await Promise.all([loadSnapshot(universeId, t.parentId), loadSnapshot(universeId, t.id)]);
  return { timeline: t, diffs: diffSnapshots(parent, branch) };
}

export async function assertTimelineVersion(timelineId: string, expected: number) {
  const t = await db.timeline.findUnique({ where: { id: timelineId }, select: { version: true } });
  if (!t || t.version !== expected) throw conflict("The timeline changed since this analysis ran. Re-run the analysis before committing.");
}

export { audit };
