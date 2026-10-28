"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../auth/session";
import { runAction } from "../action-utils";
import * as A from "../services/assets";

const id = z.string().min(1).max(64);

export async function linkAssetAction(worldId: string, assetId: string, target: { entityId?: string; eventId?: string; documentId?: string; setPortrait?: boolean }) {
  return runAction(async () => {
    const user = await requireUser();
    await A.linkAsset(user.id, worldId, id.parse(assetId), target);
    revalidatePath(`/worlds/${worldId}`, "layout");
    return null;
  });
}
export async function unlinkAssetAction(worldId: string, linkId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await A.unlinkAsset(user.id, worldId, id.parse(linkId));
    revalidatePath(`/worlds/${worldId}`, "layout");
    return null;
  });
}
export async function removeAssetAction(worldId: string, assetId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await A.removeAsset(user.id, worldId, id.parse(assetId));
    revalidatePath(`/worlds/${worldId}`, "layout");
    return null;
  });
}
