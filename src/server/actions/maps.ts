"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../auth/session";
import { runAction } from "../action-utils";
import * as M from "../services/maps";

const id = z.string().min(1).max(64);
const coord = z.number().finite();

export async function placeMarkerAction(worldId: string, mapId: string, entityId: string, x: number, y: number) {
  return runAction(async () => {
    const user = await requireUser();
    await M.placeMarker(user.id, worldId, id.parse(mapId), id.parse(entityId), coord.parse(x), coord.parse(y));
    return null;
  });
}
export async function removeMarkerAction(worldId: string, mapId: string, entityId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await M.removeMarker(user.id, worldId, id.parse(mapId), id.parse(entityId));
    revalidatePath(`/worlds/${worldId}/atlas`);
    return null;
  });
}
export async function createRouteAction(worldId: string, mapId: string, input: unknown) {
  return runAction(async () => {
    const user = await requireUser();
    const r = await M.createRoute(user.id, worldId, id.parse(mapId), input);
    revalidatePath(`/worlds/${worldId}/atlas`);
    return { id: r.id };
  });
}
export async function deleteRouteAction(worldId: string, mapId: string, routeId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await M.deleteRoute(user.id, worldId, id.parse(mapId), id.parse(routeId));
    revalidatePath(`/worlds/${worldId}/atlas`);
    return null;
  });
}
export async function createRegionAction(worldId: string, mapId: string, input: unknown) {
  return runAction(async () => {
    const user = await requireUser();
    const r = await M.createRegion(user.id, worldId, id.parse(mapId), input);
    revalidatePath(`/worlds/${worldId}/atlas`);
    return { id: r.id };
  });
}
export async function deleteRegionAction(worldId: string, mapId: string, regionId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await M.deleteRegion(user.id, worldId, id.parse(mapId), id.parse(regionId));
    revalidatePath(`/worlds/${worldId}/atlas`);
    return null;
  });
}
export async function saveMapViewAction(worldId: string, mapId: string, input: { layers?: unknown; viewport?: unknown }) {
  return runAction(async () => {
    const user = await requireUser();
    await M.saveMapView(user.id, worldId, id.parse(mapId), input);
    return null;
  });
}
export async function createMapAction(worldId: string, input: unknown) {
  return runAction(async () => {
    const user = await requireUser();
    const m = await M.createMap(user.id, worldId, input);
    revalidatePath(`/worlds/${worldId}/atlas`);
    return { id: m.id };
  });
}
