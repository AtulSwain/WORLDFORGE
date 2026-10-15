import "server-only";
import type { EntityType, Prisma } from "@/generated/prisma/client";
import { ENTITY_TYPE_META, type EntityTypeKey } from "@/domain/catalog";
import { entityInputSchema, parseAttributes, type EntityInput } from "@/domain/schemas";
import { slugify, uniqueSlug } from "@/lib/slug";
import { db, type DbOrTx } from "../db";
import { conflict, invalid, notFound } from "../errors";
import { requireAccess } from "./access";
import { recordActivity } from "./activity";
import { touchTimeline } from "./changes";
import { createRevision, entitySnapshot, toJson } from "./revisions";
import { mainTimeline, resolveTimelineId } from "./snapshot";

export interface EntityListQuery {
  type?: EntityTypeKey | EntityTypeKey[];
  q?: string;
  status?: string;
  /** Only entities related (any direction) to this entity, e.g. members of a faction. */
  relatedTo?: string;
  relationType?: string;
  /** Exact-match filters on structured attributes, e.g. { species: "Human" }. */
  attrs?: Record<string, string>;
  archived?: boolean;
  sort?: "name" | "updated" | "created";
  page?: number;
  pageSize?: number;
}

export async function listEntities(userId: string, universeId: string, query: EntityListQuery = {}) {
  await requireAccess(userId, universeId, "universe:read");
  const pageSize = Math.min(Math.max(query.pageSize ?? 24, 1), 100);
  const page = Math.max(query.page ?? 1, 1);
  const types = query.type ? (Array.isArray(query.type) ? query.type : [query.type]) : undefined;
  const where: Prisma.EntityWhereInput = {
    universeId,
    archivedAt: query.archived ? { not: null } : null,
    ...(types ? { type: { in: types as EntityType[] } } : {}),
    ...(query.status ? { status: query.status } : {}),
    AND: [
      ...Object.entries(query.attrs ?? {})
        .filter(([, v]) => v)
        .map(([k, v]) => ({ attributes: { path: [k], equals: v } })),
      ...(query.q
        ? [{ OR: [{ name: { contains: query.q, mode: "insensitive" as const } }, { summary: { contains: query.q, mode: "insensitive" as const } }] }]
        : []),
      ...(query.relatedTo
        ? [
            {
              OR: [
                { outgoing: { some: { targetId: query.relatedTo, archivedAt: null, ...(query.relationType ? { type: query.relationType } : {}) } } },
                { incoming: { some: { sourceId: query.relatedTo, archivedAt: null, ...(query.relationType ? { type: query.relationType } : {}) } } },
              ],
            },
          ]
        : []),
    ],
  };
  const orderBy: Prisma.EntityOrderByWithRelationInput =
    query.sort === "updated" ? { updatedAt: "desc" } : query.sort === "created" ? { createdAt: "desc" } : { name: "asc" };
  const [total, rows] = await Promise.all([
    db.entity.count({ where }),
    db.entity.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, type: true, name: true, slug: true, summary: true, status: true, portrait: true, beginYear: true,
        endYear: true, attributes: true, canonStatus: true, timelineId: true, updatedAt: true, archivedAt: true,
        _count: { select: { outgoing: { where: { archivedAt: null } }, incoming: { where: { archivedAt: null } }, participation: true } },
      },
    }),
  ]);
  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Lightweight id/name/type list for pickers (bounded). */
export async function entityOptions(userId: string, universeId: string, types?: EntityTypeKey[]) {
  await requireAccess(userId, universeId, "universe:read");
  return db.entity.findMany({
    where: { universeId, archivedAt: null, ...(types ? { type: { in: types as EntityType[] } } : {}) },
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
    take: 1000,
  });
}

/** Distinct values of a string attribute for filter menus (bounded). */
export async function attributeValues(userId: string, universeId: string, type: EntityTypeKey, key: string) {
  await requireAccess(userId, universeId, "universe:read");
  const rows = await db.entity.findMany({ where: { universeId, type, archivedAt: null }, select: { attributes: true }, take: 2000 });
  const set = new Set<string>();
  for (const r of rows) {
    const v = (r.attributes as Record<string, unknown> | null)?.[key];
    if (typeof v === "string" && v.trim()) set.add(v.trim());
  }
  return [...set].sort();
}

export async function getEntity(userId: string, universeId: string, entityId: string) {
  const access = await requireAccess(userId, universeId, "universe:read");
  const entity = await db.entity.findFirst({
    where: { id: entityId, universeId },
    include: {
      timeline: { select: { id: true, name: true, isMain: true } },
      outgoing: {
        where: { archivedAt: null },
        include: { target: { select: { id: true, name: true, type: true, status: true } }, originEvent: { select: { id: true, title: true } } },
        orderBy: [{ validFromYear: "asc" }],
      },
      incoming: {
        where: { archivedAt: null },
        include: { source: { select: { id: true, name: true, type: true, status: true } }, originEvent: { select: { id: true, title: true } } },
        orderBy: [{ validFromYear: "asc" }],
      },
      participation: {
        where: { event: { archivedAt: null } },
        include: {
          event: {
            select: {
              id: true, title: true, eventType: true, startYear: true, startMonth: true, startDay: true, endYear: true, endMonth: true,
              endDay: true, precision: true, displayDate: true, startOrdinal: true, importance: true, canonStatus: true,
              location: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { event: { startOrdinal: "asc" } },
      },
      eventsHere: {
        where: { archivedAt: null },
        select: { id: true, title: true, startYear: true, precision: true, startMonth: true, startDay: true, endYear: true, endMonth: true, endDay: true, displayDate: true },
        orderBy: { startOrdinal: "asc" },
        take: 50,
      },
      loreLinks: { where: { document: { archivedAt: null } }, include: { document: { select: { id: true, title: true, category: true, updatedAt: true } } } },
      assetLinks: { where: { asset: { archivedAt: null } }, include: { asset: true } },
      placements: { include: { map: { select: { id: true, title: true } } } },
    },
  });
  if (!entity) throw notFound("Entity");
  return { entity, role: access.role };
}

async function takenSlugs(client: DbOrTx, universeId: string, base: string) {
  const rows = await client.entity.findMany({ where: { universeId, slug: { startsWith: base } }, select: { slug: true } });
  return rows.map((r) => r.slug);
}

export async function createEntity(
  userId: string,
  universeId: string,
  raw: EntityInput & { timelineId?: string | null },
  client?: DbOrTx,
) {
  await requireAccess(userId, universeId, "content:write");
  const input = entityInputSchema.parse(raw);
  const attributes = parseAttributes(input.type, input.attributes);
  const run = async (tx: DbOrTx) => {
    const timelineId = raw.timelineId ? await resolveTimelineId(universeId, raw.timelineId, tx) : (await mainTimeline(universeId, tx)).id;
    const base = slugify(input.name);
    const slug = uniqueSlug(base, await takenSlugs(tx, universeId, base));
    const entity = await tx.entity.create({
      data: {
        universeId,
        timelineId,
        type: input.type,
        customTypeLabel: input.type === "CUSTOM" ? input.customTypeLabel || "Custom" : null,
        name: input.name,
        slug,
        summary: input.summary,
        description: input.description,
        status: input.status,
        beginYear: input.beginYear ?? null,
        endYear: input.endYear ?? null,
        portrait: input.portrait ?? null,
        canonStatus: input.canonStatus,
        attributes: toJson(attributes),
        createdById: userId,
      },
    });
    await createRevision(tx, {
      universeId, recordType: "ENTITY", recordId: entity.id, version: 1, snapshot: entitySnapshot(entity),
      summary: "Created", authorId: userId, timelineId,
    });
    await recordActivity(tx, {
      universeId, actorId: userId, action: "entity.created", targetType: entity.type, targetId: entity.id,
      summary: `Created ${ENTITY_TYPE_META[entity.type].label.toLowerCase()} ${entity.name}`,
    });
    return entity;
  };
  return client ? run(client) : db.$transaction(run);
}

/** Updates the base record with optimistic concurrency (`expectedVersion`). */
export async function updateEntity(userId: string, universeId: string, entityId: string, raw: EntityInput, expectedVersion: number) {
  await requireAccess(userId, universeId, "content:write");
  const input = entityInputSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const current = await tx.entity.findFirst({ where: { id: entityId, universeId } });
    if (!current) throw notFound("Entity");
    if (current.type !== input.type) throw invalid("An entity's type cannot be changed.");
    const attributes = parseAttributes(input.type, input.attributes);
    const res = await tx.entity.updateMany({
      where: { id: entityId, universeId, version: expectedVersion },
      data: {
        name: input.name,
        summary: input.summary,
        description: input.description,
        status: input.status,
        beginYear: input.beginYear ?? null,
        endYear: input.endYear ?? null,
        portrait: input.portrait ?? null,
        canonStatus: input.canonStatus,
        customTypeLabel: input.type === "CUSTOM" ? input.customTypeLabel || "Custom" : null,
        attributes: toJson(attributes),
        version: { increment: 1 },
      },
    });
    if (!res.count) throw conflict("This record was changed by someone else. Reload to see the latest version before saving.");
    const updated = await tx.entity.findUniqueOrThrow({ where: { id: entityId } });
    await touchTimeline(tx, updated.timelineId);
    await createRevision(tx, {
      universeId, recordType: "ENTITY", recordId: entityId, version: updated.version, snapshot: entitySnapshot(updated),
      summary: "Edited", authorId: userId, timelineId: updated.timelineId,
    });
    await recordActivity(tx, { universeId, actorId: userId, action: "entity.updated", targetType: updated.type, targetId: entityId, summary: `Edited ${updated.name}` });
    return updated;
  });
}

export async function setEntityArchived(userId: string, universeId: string, entityId: string, archived: boolean) {
  await requireAccess(userId, universeId, "content:write");
  return db.$transaction(async (tx) => {
    const e = await tx.entity.findFirst({ where: { id: entityId, universeId } });
    if (!e) throw notFound("Entity");
    const updated = await tx.entity.update({ where: { id: entityId }, data: { archivedAt: archived ? new Date() : null, version: { increment: 1 } } });
    await touchTimeline(tx, e.timelineId);
    await createRevision(tx, {
      universeId, recordType: "ENTITY", recordId: entityId, version: updated.version, snapshot: entitySnapshot(updated),
      summary: archived ? "Archived" : "Restored from archive", authorId: userId, timelineId: e.timelineId,
    });
    await recordActivity(tx, { universeId, actorId: userId, action: archived ? "entity.archived" : "entity.restored", targetType: e.type, targetId: e.id, summary: `${archived ? "Archived" : "Restored"} ${e.name}` });
    return updated;
  });
}

/** Restores an earlier revision as a new version (history is never rewritten). */
export async function restoreEntityRevision(userId: string, universeId: string, entityId: string, revisionId: string) {
  await requireAccess(userId, universeId, "content:write");
  return db.$transaction(async (tx) => {
    const rev = await tx.revision.findFirst({ where: { id: revisionId, universeId, recordType: "ENTITY", recordId: entityId } });
    if (!rev) throw notFound("Revision");
    const current = await tx.entity.findFirst({ where: { id: entityId, universeId } });
    if (!current) throw notFound("Entity");
    const snap = rev.snapshot as ReturnType<typeof entitySnapshot>;
    const updated = await tx.entity.update({
      where: { id: entityId },
      data: {
        name: snap.name, summary: snap.summary, description: snap.description, status: snap.status, beginYear: snap.beginYear,
        endYear: snap.endYear, portrait: snap.portrait, canonStatus: snap.canonStatus as never, attributes: toJson(snap.attributes),
        customTypeLabel: snap.customTypeLabel, version: { increment: 1 },
      },
    });
    await createRevision(tx, {
      universeId, recordType: "ENTITY", recordId: entityId, version: updated.version, snapshot: entitySnapshot(updated),
      summary: `Restored version ${rev.version}`, authorId: userId, timelineId: updated.timelineId,
    });
    await recordActivity(tx, { universeId, actorId: userId, action: "entity.restored_revision", targetType: updated.type, targetId: entityId, summary: `Restored ${updated.name} to version ${rev.version}` });
    return updated;
  });
}

/** Merges validated attribute changes (e.g. an accepted, edited AI suggestion) into an entity. */
export async function patchEntityFields(
  userId: string,
  universeId: string,
  entityId: string,
  patch: { attributes?: Record<string, unknown>; summary?: string; description?: string },
  expectedVersion: number,
  summary: string,
) {
  await requireAccess(userId, universeId, "content:write");
  return db.$transaction(async (tx) => {
    const current = await tx.entity.findFirst({ where: { id: entityId, universeId } });
    if (!current) throw notFound("Entity");
    const attributes = parseAttributes(current.type, { ...(current.attributes as object), ...(patch.attributes ?? {}) });
    const res = await tx.entity.updateMany({
      where: { id: entityId, version: expectedVersion },
      data: {
        attributes: toJson(attributes),
        ...(patch.summary != null ? { summary: patch.summary.slice(0, 600) } : {}),
        ...(patch.description != null ? { description: patch.description.slice(0, 20000) } : {}),
        version: { increment: 1 },
      },
    });
    if (!res.count) throw conflict("This record changed since the suggestion was generated. Reload and try again.");
    const updated = await tx.entity.findUniqueOrThrow({ where: { id: entityId } });
    await touchTimeline(tx, updated.timelineId);
    await createRevision(tx, {
      universeId, recordType: "ENTITY", recordId: entityId, version: updated.version, snapshot: entitySnapshot(updated),
      summary, authorId: userId, timelineId: updated.timelineId,
    });
    await recordActivity(tx, { universeId, actorId: userId, action: "entity.updated", targetType: updated.type, targetId: entityId, summary: `${summary}: ${updated.name}` });
    return updated;
  });
}
