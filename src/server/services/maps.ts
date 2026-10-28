import "server-only";
import { z } from "zod";
import { db } from "../db";
import { invalid, notFound } from "../errors";
import { requireAccess } from "./access";
import { recordActivity } from "./activity";

const point = z.tuple([z.number().finite(), z.number().finite()]);
export const routeSchema = z.object({ name: z.string().trim().min(1).max(120), kind: z.enum(["ROAD", "TRADE", "SEA", "RIVER", "PATH"]), points: z.array(point).min(2).max(200) });
export const regionSchema = z.object({ name: z.string().trim().min(1).max(120), factionId: z.string().max(64).nullable().optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#D6BD8D"), polygon: z.array(point).min(3).max(300) });
export const layerSchema = z.object({ markers: z.boolean(), routes: z.boolean(), regions: z.boolean(), labels: z.boolean() });
export const viewportSchema = z.object({ x: z.number().finite(), y: z.number().finite(), zoom: z.number().min(0.05).max(8) });
export const mapCreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  imageSource: z.string().trim().max(500).regex(/^\/(maps|api\/assets)\//, "Choose a built-in map or an uploaded image asset."),
  width: z.number().int().min(200).max(20000),
  height: z.number().int().min(200).max(20000),
});

export async function getAtlas(userId: string, universeId: string, mapId?: string | null) {
  const access = await requireAccess(userId, universeId, "universe:read");
  const maps = await db.worldMap.findMany({ where: { universeId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], select: { id: true, title: true, isDefault: true } });
  const id = mapId && maps.some((m) => m.id === mapId) ? mapId : maps[0]?.id;
  if (!id) return { access, maps, map: null };
  const map = await db.worldMap.findUniqueOrThrow({
    where: { id },
    include: {
      placements: { include: { entity: { select: { id: true, name: true, type: true, summary: true, status: true, attributes: true, archivedAt: true } } } },
      routes: true,
      regions: { include: { faction: { select: { id: true, name: true } } } },
    },
  });
  return { access, maps, map };
}

async function ownedMap(universeId: string, mapId: string) {
  const map = await db.worldMap.findFirst({ where: { id: mapId, universeId } });
  if (!map) throw notFound("Map");
  return map;
}

function assertInside(map: { width: number; height: number }, pts: [number, number][]) {
  for (const [x, y] of pts) if (x < 0 || y < 0 || x > map.width || y > map.height) throw invalid("Points must lie within the map.");
}

export async function placeMarker(userId: string, universeId: string, mapId: string, entityId: string, x: number, y: number) {
  await requireAccess(userId, universeId, "content:write");
  const map = await ownedMap(universeId, mapId);
  assertInside(map, [[x, y]]);
  const entity = await db.entity.findFirst({ where: { id: entityId, universeId }, select: { id: true, name: true } });
  if (!entity) throw notFound("Entity");
  const p = await db.mapPlacement.upsert({
    where: { mapId_entityId: { mapId, entityId } },
    create: { mapId, entityId, x, y },
    update: { x, y },
  });
  return p;
}

export async function removeMarker(userId: string, universeId: string, mapId: string, entityId: string) {
  await requireAccess(userId, universeId, "content:write");
  await ownedMap(universeId, mapId);
  await db.mapPlacement.deleteMany({ where: { mapId, entityId } });
}

export async function createRoute(userId: string, universeId: string, mapId: string, raw: unknown) {
  await requireAccess(userId, universeId, "content:write");
  const map = await ownedMap(universeId, mapId);
  const input = routeSchema.parse(raw);
  assertInside(map, input.points);
  const route = await db.mapRoute.create({ data: { mapId, ...input } });
  await recordActivity(db, { universeId, actorId: userId, action: "map.route", summary: `Drew route “${input.name}” on ${map.title}` });
  return route;
}

export async function deleteRoute(userId: string, universeId: string, mapId: string, routeId: string) {
  await requireAccess(userId, universeId, "content:write");
  await ownedMap(universeId, mapId);
  await db.mapRoute.deleteMany({ where: { id: routeId, mapId } });
}

export async function createRegion(userId: string, universeId: string, mapId: string, raw: unknown) {
  await requireAccess(userId, universeId, "content:write");
  const map = await ownedMap(universeId, mapId);
  const input = regionSchema.parse(raw);
  assertInside(map, input.polygon);
  if (input.factionId) {
    const f = await db.entity.findFirst({ where: { id: input.factionId, universeId } });
    if (!f) throw notFound("Faction");
  }
  const region = await db.mapRegion.create({ data: { mapId, name: input.name, factionId: input.factionId ?? null, color: input.color, polygon: input.polygon } });
  await recordActivity(db, { universeId, actorId: userId, action: "map.region", summary: `Drew region “${input.name}” on ${map.title}` });
  return region;
}

export async function deleteRegion(userId: string, universeId: string, mapId: string, regionId: string) {
  await requireAccess(userId, universeId, "content:write");
  await ownedMap(universeId, mapId);
  await db.mapRegion.deleteMany({ where: { id: regionId, mapId } });
}

export async function saveMapView(userId: string, universeId: string, mapId: string, raw: { layers?: unknown; viewport?: unknown }) {
  await requireAccess(userId, universeId, "content:write");
  await ownedMap(universeId, mapId);
  await db.worldMap.update({
    where: { id: mapId },
    data: {
      ...(raw.layers ? { layerConfig: layerSchema.parse(raw.layers) } : {}),
      ...(raw.viewport ? { defaultViewport: viewportSchema.parse(raw.viewport) } : {}),
    },
  });
}

export async function createMap(userId: string, universeId: string, raw: unknown) {
  await requireAccess(userId, universeId, "content:write");
  const input = mapCreateSchema.parse(raw);
  if (input.imageSource.startsWith("/api/assets/")) {
    const assetId = input.imageSource.split("/")[3]?.split("?")[0];
    const asset = await db.mediaAsset.findFirst({ where: { id: assetId, universeId, archivedAt: null } });
    if (!asset || !asset.mimeType.startsWith("image/")) throw invalid("Choose an image asset from this universe.");
  }
  const count = await db.worldMap.count({ where: { universeId } });
  return db.worldMap.create({
    data: {
      universeId, ...input, isDefault: count === 0,
      layerConfig: { markers: true, routes: true, regions: true, labels: true },
      defaultViewport: { x: input.width / 2, y: input.height / 2, zoom: 0.5 },
    },
  });
}
