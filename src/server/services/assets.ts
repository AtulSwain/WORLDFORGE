import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db";
import { invalid, notFound } from "../errors";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, sniffMime, storage } from "../storage";
import { requireAccess } from "./access";
import { audit, recordActivity } from "./activity";

export const ASSET_KINDS = ["PORTRAIT", "EMBLEM", "MAP", "ILLUSTRATION", "ARTIFACT", "CONCEPT", "REFERENCE", "DOCUMENT"] as const;

const metaSchema = z.object({ kind: z.enum(ASSET_KINDS).default("REFERENCE"), altText: z.string().trim().max(300).default("") });

async function processFile(file: File) {
  if (file.size === 0) throw invalid("The file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw invalid(`Files must be ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB or smaller.`);
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(buf);
  if (!mime || !ALLOWED_MIME.has(mime)) throw invalid("Unsupported file type. Upload PNG, JPEG, GIF, WebP, AVIF, PDF or plain-text files. (SVG is not accepted because it can contain scripts.)");
  let width: number | null = null;
  let height: number | null = null;
  let thumb: Buffer | null = null;
  if (mime.startsWith("image/")) {
    try {
      const sharp = (await import("sharp")).default;
      const img = sharp(buf, { limitInputPixels: 80_000_000 });
      const meta = await img.metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      thumb = await img.rotate().resize(480, 480, { fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    } catch {
      throw invalid("The image could not be read. It may be corrupted.");
    }
  }
  return { buf, mime, width, height, thumb };
}

const safeName = (name: string) => name.replace(/[^\w.\- ]+/g, "_").slice(0, 160) || "file";

export async function uploadAsset(userId: string, universeId: string, file: File, rawMeta: unknown) {
  await requireAccess(userId, universeId, "content:write");
  const meta = metaSchema.parse(rawMeta);
  const { buf, mime, width, height, thumb } = await processFile(file);
  const id = randomUUID();
  const key = `universes/${universeId}/${id}`;
  const s = storage();
  await s.put(key, buf, mime);
  if (thumb) await s.put(`${key}.thumb.webp`, thumb, "image/webp");
  try {
    const asset = await db.mediaAsset.create({
      data: { id, universeId, uploaderId: userId, kind: meta.kind, filename: safeName(file.name), mimeType: mime, sizeBytes: buf.length, storageKey: key, thumbnailKey: thumb ? `${key}.thumb.webp` : null, width, height, altText: meta.altText },
    });
    await recordActivity(db, { universeId, actorId: userId, action: "asset.uploaded", targetType: "ASSET", targetId: id, summary: `Uploaded ${asset.filename}` });
    return asset;
  } catch (e) {
    // Never leave orphaned objects when the database write fails.
    await s.remove(key).catch(() => undefined);
    if (thumb) await s.remove(`${key}.thumb.webp`).catch(() => undefined);
    throw e;
  }
}

export async function replaceAsset(userId: string, universeId: string, assetId: string, file: File) {
  await requireAccess(userId, universeId, "content:write");
  const asset = await db.mediaAsset.findFirst({ where: { id: assetId, universeId } });
  if (!asset) throw notFound("Asset");
  const { buf, mime, width, height, thumb } = await processFile(file);
  const s = storage();
  const version = randomUUID().slice(0, 8);
  const key = `universes/${universeId}/${asset.id}-${version}`;
  await s.put(key, buf, mime);
  if (thumb) await s.put(`${key}.thumb.webp`, thumb, "image/webp");
  await db.mediaAsset.update({ where: { id: asset.id }, data: { storageKey: key, thumbnailKey: thumb ? `${key}.thumb.webp` : null, mimeType: mime, sizeBytes: buf.length, width, height, filename: safeName(file.name) } });
  await s.remove(asset.storageKey).catch(() => undefined);
  if (asset.thumbnailKey) await s.remove(asset.thumbnailKey).catch(() => undefined);
}

export async function listAssets(userId: string, universeId: string, kind?: string) {
  await requireAccess(userId, universeId, "universe:read");
  return db.mediaAsset.findMany({
    where: { universeId, archivedAt: null, ...(kind ? { kind } : {}) },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { links: { include: { entity: { select: { id: true, name: true, type: true } }, event: { select: { id: true, title: true } }, document: { select: { id: true, title: true } } } } },
  });
}

/** Authorised read for the serving route. */
export async function readAsset(userId: string, assetId: string, thumb: boolean) {
  const asset = await db.mediaAsset.findUnique({ where: { id: assetId } });
  if (!asset || asset.archivedAt) throw notFound("Asset");
  await requireAccess(userId, asset.universeId, "universe:read");
  const key = thumb && asset.thumbnailKey ? asset.thumbnailKey : asset.storageKey;
  return { asset, key, mime: thumb && asset.thumbnailKey ? "image/webp" : asset.mimeType };
}

export async function linkAsset(userId: string, universeId: string, assetId: string, target: { entityId?: string; eventId?: string; documentId?: string; setPortrait?: boolean }) {
  await requireAccess(userId, universeId, "content:write");
  const asset = await db.mediaAsset.findFirst({ where: { id: assetId, universeId, archivedAt: null } });
  if (!asset) throw notFound("Asset");
  if (target.entityId) {
    const e = await db.entity.findFirst({ where: { id: target.entityId, universeId } });
    if (!e) throw notFound("Entity");
    await db.assetLink.create({ data: { assetId, entityId: e.id } });
    if (target.setPortrait && asset.mimeType.startsWith("image/")) {
      await db.entity.update({ where: { id: e.id }, data: { portrait: `/api/assets/${asset.id}?thumb=1`, version: { increment: 1 } } });
    }
  } else if (target.eventId) {
    const e = await db.historicalEvent.findFirst({ where: { id: target.eventId, universeId } });
    if (!e) throw notFound("Event");
    await db.assetLink.create({ data: { assetId, eventId: e.id } });
  } else if (target.documentId) {
    const d = await db.loreDocument.findFirst({ where: { id: target.documentId, universeId } });
    if (!d) throw notFound("Lore document");
    await db.assetLink.create({ data: { assetId, documentId: d.id } });
  } else throw invalid("Choose what to link the asset to.");
}

export async function unlinkAsset(userId: string, universeId: string, linkId: string) {
  await requireAccess(userId, universeId, "content:write");
  const r = await db.assetLink.deleteMany({ where: { id: linkId, asset: { universeId } } });
  if (!r.count) throw notFound("Link");
}

export async function removeAsset(userId: string, universeId: string, assetId: string) {
  await requireAccess(userId, universeId, "content:write");
  const asset = await db.mediaAsset.findFirst({ where: { id: assetId, universeId } });
  if (!asset) throw notFound("Asset");
  await db.$transaction([
    db.assetLink.deleteMany({ where: { assetId } }),
    db.mediaAsset.update({ where: { id: assetId }, data: { archivedAt: new Date() } }),
    db.entity.updateMany({ where: { universeId, portrait: { startsWith: `/api/assets/${assetId}` } }, data: { portrait: null } }),
  ]);
  const s = storage();
  await s.remove(asset.storageKey).catch(() => undefined);
  if (asset.thumbnailKey) await s.remove(asset.thumbnailKey).catch(() => undefined);
  await audit({ userId, universeId, action: "asset.remove", metadata: { assetId, filename: asset.filename } });
}
