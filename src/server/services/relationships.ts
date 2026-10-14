import "server-only";
import { validateRelationshipCandidate } from "@/domain/consistency";
import { isBuiltinRelationship, relationshipInputSchema, relationshipTypeKey, type RelationshipInput } from "@/domain/schemas";
import { relationshipMeta } from "@/domain/catalog";
import { db, type DbOrTx } from "../db";
import { conflict, invalid, notFound } from "../errors";
import { assertEventsInUniverse, requireAccess } from "./access";
import { recordActivity } from "./activity";
import { createRevision, relationshipSnapshot } from "./revisions";
import { mainTimeline, resolveTimelineId } from "./snapshot";

async function validate(tx: DbOrTx, universeId: string, input: ReturnType<typeof relationshipInputSchema.parse>, ignoreId?: string) {
  const ends = await tx.entity.findMany({
    where: { id: { in: [input.sourceId, input.targetId] }, universeId, archivedAt: null },
    select: { id: true, type: true, name: true },
  });
  if (!isBuiltinRelationship(input.type)) {
    const def = await tx.relationshipTypeDef.findUnique({ where: { universeId_key: { universeId, key: input.type } } });
    if (!def) throw invalid(`Unknown relationship type “${input.type}”. Define it in universe settings first.`);
  }
  await assertEventsInUniverse(tx, universeId, [input.originEventId, input.endEventId]);
  const existing = await tx.relationship.findMany({
    where: {
      universeId,
      archivedAt: null,
      type: input.type,
      OR: [
        { sourceId: input.sourceId, targetId: input.targetId },
        { sourceId: input.targetId, targetId: input.sourceId },
      ],
    },
  });
  const errors = validateRelationshipCandidate(
    input,
    ends.find((e) => e.id === input.sourceId),
    ends.find((e) => e.id === input.targetId),
    existing,
    ignoreId,
  );
  if (errors.length) throw invalid(errors.join(" "));
}

export async function createRelationship(
  userId: string,
  universeId: string,
  raw: RelationshipInput & { timelineId?: string | null },
  client?: DbOrTx,
) {
  await requireAccess(userId, universeId, "content:write");
  const input = relationshipInputSchema.parse(raw);
  const run = async (tx: DbOrTx) => {
    await validate(tx, universeId, input);
    const timelineId = raw.timelineId ? await resolveTimelineId(universeId, raw.timelineId, tx) : (await mainTimeline(universeId, tx)).id;
    const rel = await tx.relationship.create({
      data: {
        universeId,
        timelineId,
        sourceId: input.sourceId,
        targetId: input.targetId,
        type: input.type,
        description: input.description,
        validFromYear: input.validFromYear ?? null,
        validToYear: input.validToYear ?? null,
        originEventId: input.originEventId ?? null,
        endEventId: input.endEventId ?? null,
        canonStatus: input.canonStatus,
        createdById: userId,
      },
      include: { source: { select: { name: true } }, target: { select: { name: true } } },
    });
    await createRevision(tx, {
      universeId, recordType: "RELATIONSHIP", recordId: rel.id, version: 1, snapshot: relationshipSnapshot(rel),
      summary: "Created", authorId: userId, timelineId,
    });
    await recordActivity(tx, {
      universeId, actorId: userId, action: "relationship.created", targetType: "RELATIONSHIP", targetId: rel.id,
      summary: `Connected ${rel.source.name} ${relationshipMeta(rel.type).label.toLowerCase()} ${rel.target.name}`,
    });
    return rel;
  };
  return client ? run(client) : db.$transaction(run);
}

export async function updateRelationship(userId: string, universeId: string, relId: string, raw: RelationshipInput, expectedVersion: number) {
  await requireAccess(userId, universeId, "content:write");
  const input = relationshipInputSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const current = await tx.relationship.findFirst({ where: { id: relId, universeId } });
    if (!current) throw notFound("Relationship");
    await validate(tx, universeId, input, relId);
    const res = await tx.relationship.updateMany({
      where: { id: relId, version: expectedVersion },
      data: {
        sourceId: input.sourceId, targetId: input.targetId, type: input.type, description: input.description,
        validFromYear: input.validFromYear ?? null, validToYear: input.validToYear ?? null,
        originEventId: input.originEventId ?? null, endEventId: input.endEventId ?? null, canonStatus: input.canonStatus,
        version: { increment: 1 },
      },
    });
    if (!res.count) throw conflict("This relationship was changed by someone else. Reload and try again.");
    const updated = await tx.relationship.findUniqueOrThrow({ where: { id: relId } });
    await createRevision(tx, {
      universeId, recordType: "RELATIONSHIP", recordId: relId, version: updated.version, snapshot: relationshipSnapshot(updated),
      summary: "Edited", authorId: userId, timelineId: updated.timelineId,
    });
    return updated;
  });
}

export async function archiveRelationship(userId: string, universeId: string, relId: string) {
  await requireAccess(userId, universeId, "content:write");
  return db.$transaction(async (tx) => {
    const rel = await tx.relationship.findFirst({
      where: { id: relId, universeId, archivedAt: null },
      include: { source: { select: { name: true } }, target: { select: { name: true } } },
    });
    if (!rel) throw notFound("Relationship");
    const updated = await tx.relationship.update({ where: { id: relId }, data: { archivedAt: new Date(), version: { increment: 1 } } });
    await createRevision(tx, {
      universeId, recordType: "RELATIONSHIP", recordId: relId, version: updated.version, snapshot: relationshipSnapshot(updated),
      summary: "Archived", authorId: userId, timelineId: rel.timelineId,
    });
    await recordActivity(tx, {
      universeId, actorId: userId, action: "relationship.archived", targetType: "RELATIONSHIP", targetId: relId,
      summary: `Removed ${rel.source.name} — ${relationshipMeta(rel.type).label.toLowerCase()} — ${rel.target.name}`,
    });
  });
}

export async function listRelationshipTypes(userId: string, universeId: string) {
  await requireAccess(userId, universeId, "universe:read");
  return db.relationshipTypeDef.findMany({ where: { universeId }, orderBy: { label: "asc" } });
}

export async function createRelationshipType(userId: string, universeId: string, raw: { key: string; label: string; inverse?: string }) {
  await requireAccess(userId, universeId, "universe:settings");
  const key = relationshipTypeKey.parse(raw.key.toUpperCase().replace(/[^A-Z0-9]+/g, "_"));
  if (isBuiltinRelationship(key)) throw invalid("That relationship type already exists as a built-in type.");
  const label = raw.label.trim().slice(0, 60);
  if (!label) throw invalid("Give the relationship type a label.");
  try {
    return await db.relationshipTypeDef.create({ data: { universeId, key, label, inverse: raw.inverse?.trim().slice(0, 60) || null } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw conflict("A relationship type with that key already exists.");
    throw e;
  }
}
