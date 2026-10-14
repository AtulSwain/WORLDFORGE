import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { loreInputSchema, type LoreInput } from "@/domain/schemas";
import { slugify, uniqueSlug } from "@/lib/slug";
import { db, type DbOrTx } from "../db";
import { conflict, notFound } from "../errors";
import { assertEntitiesInUniverse, assertEventsInUniverse, requireAccess } from "./access";
import { recordActivity } from "./activity";
import { createRevision, loreSnapshot } from "./revisions";

const REVISION_COALESCE_MS = 2 * 60 * 1000;

export async function listLore(userId: string, universeId: string, q: { q?: string; category?: string; tag?: string; archived?: boolean } = {}) {
  await requireAccess(userId, universeId, "universe:read");
  const where: Prisma.LoreDocumentWhereInput = {
    universeId,
    archivedAt: q.archived ? { not: null } : null,
    ...(q.category ? { category: q.category } : {}),
    ...(q.tag ? { tags: { has: q.tag } } : {}),
    ...(q.q ? { OR: [{ title: { contains: q.q, mode: "insensitive" } }, { body: { contains: q.q, mode: "insensitive" } }] } : {}),
  };
  const [docs, tagRows] = await Promise.all([
    db.loreDocument.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: { id: true, title: true, category: true, tags: true, canonStatus: true, updatedAt: true, body: true, _count: { select: { links: true } } },
    }),
    db.loreDocument.findMany({ where: { universeId, archivedAt: null }, select: { tags: true, category: true } }),
  ]);
  const tagCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  for (const r of tagRows) {
    for (const t of r.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    categoryCounts.set(r.category, (categoryCounts.get(r.category) ?? 0) + 1);
  }
  return {
    docs: docs.map((d) => ({ ...d, excerpt: d.body.replace(/[#>*_`-]/g, "").slice(0, 220), body: undefined })),
    tags: [...tagCounts.entries()].sort((a, b) => b[1] - a[1]),
    categories: Object.fromEntries(categoryCounts),
  };
}

export async function getLore(userId: string, universeId: string, docId: string) {
  const access = await requireAccess(userId, universeId, "universe:read");
  const doc = await db.loreDocument.findFirst({
    where: { id: docId, universeId },
    include: {
      links: { include: { entity: { select: { id: true, name: true, type: true } }, event: { select: { id: true, title: true, startYear: true } } } },
    },
  });
  if (!doc) throw notFound("Lore document");
  return { doc, role: access.role };
}

async function setLinks(tx: DbOrTx, universeId: string, documentId: string, entityIds: string[], eventIds: string[]) {
  await assertEntitiesInUniverse(tx, universeId, entityIds);
  await assertEventsInUniverse(tx, universeId, eventIds);
  await tx.loreLink.deleteMany({ where: { documentId } });
  await tx.loreLink.createMany({
    data: [...new Set(entityIds)].map((entityId) => ({ documentId, entityId })).concat([...new Set(eventIds)].map((eventId) => ({ documentId, eventId })) as never[]),
  });
}

export async function createLore(userId: string, universeId: string, raw: LoreInput) {
  await requireAccess(userId, universeId, "content:write");
  const input = loreInputSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const base = slugify(input.title);
    const taken = await tx.loreDocument.findMany({ where: { universeId, slug: { startsWith: base } }, select: { slug: true } });
    const doc = await tx.loreDocument.create({
      data: {
        universeId, title: input.title, slug: uniqueSlug(base, taken.map((t) => t.slug)), body: input.body, category: input.category,
        tags: normalizeTags(input.tags), canonStatus: input.canonStatus, authorId: userId,
      },
    });
    await setLinks(tx, universeId, doc.id, input.entityIds, input.eventIds);
    await createRevision(tx, { universeId, recordType: "LORE", recordId: doc.id, version: 1, snapshot: loreSnapshot(doc), summary: "Created", authorId: userId });
    await recordActivity(tx, { universeId, actorId: userId, action: "lore.created", targetType: "LORE", targetId: doc.id, summary: `Wrote “${doc.title}”` });
    return doc;
  });
}

function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 30);
}

/**
 * Saves a document with optimistic concurrency. Returns the new version only after the write
 * commits, so the editor never reports "saved" prematurely.
 */
export async function updateLore(userId: string, universeId: string, docId: string, raw: LoreInput, expectedVersion: number) {
  await requireAccess(userId, universeId, "content:write");
  const input = loreInputSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const current = await tx.loreDocument.findFirst({ where: { id: docId, universeId } });
    if (!current) throw notFound("Lore document");
    const res = await tx.loreDocument.updateMany({
      where: { id: docId, version: expectedVersion },
      data: { title: input.title, body: input.body, category: input.category, tags: normalizeTags(input.tags), canonStatus: input.canonStatus, version: { increment: 1 } },
    });
    if (!res.count) throw conflict("Someone else saved this document since you opened it. Copy your changes, reload, and merge them.");
    await setLinks(tx, universeId, docId, input.entityIds, input.eventIds);
    const updated = await tx.loreDocument.findUniqueOrThrow({ where: { id: docId } });
    // Coalesce rapid autosaves by the same author into one revision snapshot.
    const last = await tx.revision.findFirst({ where: { recordType: "LORE", recordId: docId }, orderBy: { createdAt: "desc" } });
    const coalesce = last && last.authorId === userId && Date.now() - last.createdAt.getTime() < REVISION_COALESCE_MS && last.summary === "Edited";
    if (!coalesce) {
      await createRevision(tx, { universeId, recordType: "LORE", recordId: docId, version: updated.version, snapshot: loreSnapshot(updated), summary: "Edited", authorId: userId });
      await recordActivity(tx, { universeId, actorId: userId, action: "lore.updated", targetType: "LORE", targetId: docId, summary: `Edited “${updated.title}”` });
    } else {
      // Immutable history is kept per editing session; this updates only the open session's snapshot.
      await tx.revision.update({ where: { id: last.id }, data: { snapshot: loreSnapshot(updated) as object, version: updated.version } });
    }
    return { version: updated.version, updatedAt: updated.updatedAt };
  });
}

export async function setLoreArchived(userId: string, universeId: string, docId: string, archived: boolean) {
  await requireAccess(userId, universeId, "content:write");
  const doc = await db.loreDocument.findFirst({ where: { id: docId, universeId } });
  if (!doc) throw notFound("Lore document");
  await db.loreDocument.update({ where: { id: docId }, data: { archivedAt: archived ? new Date() : null } });
  await recordActivity(db, { universeId, actorId: userId, action: archived ? "lore.archived" : "lore.restored", targetType: "LORE", targetId: docId, summary: `${archived ? "Archived" : "Restored"} “${doc.title}”` });
}

export async function restoreLoreRevision(userId: string, universeId: string, docId: string, revisionId: string) {
  await requireAccess(userId, universeId, "content:write");
  return db.$transaction(async (tx) => {
    const rev = await tx.revision.findFirst({ where: { id: revisionId, universeId, recordType: "LORE", recordId: docId } });
    if (!rev) throw notFound("Revision");
    const snap = rev.snapshot as ReturnType<typeof loreSnapshot>;
    const updated = await tx.loreDocument.update({
      where: { id: docId },
      data: { title: snap.title, body: snap.body, category: snap.category, tags: snap.tags, canonStatus: snap.canonStatus as never, version: { increment: 1 } },
    });
    await createRevision(tx, { universeId, recordType: "LORE", recordId: docId, version: updated.version, snapshot: loreSnapshot(updated), summary: `Restored version ${rev.version}`, authorId: userId });
    return updated;
  });
}
