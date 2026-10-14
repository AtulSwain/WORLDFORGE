"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../auth/session";
import { runAction } from "../action-utils";
import * as T from "../services/timelines";

export async function createBranchAction(worldId: string, input: { name: string; description?: string; parentId: string; branchEventId?: string | null }) {
  return runAction(async () => {
    const user = await requireUser();
    const t = await T.createBranch(user.id, worldId, input);
    revalidatePath(`/worlds/${worldId}`, "layout");
    return { id: t.id };
  });
}

export async function setTimelineStatusAction(worldId: string, timelineId: string, status: "ACTIVE" | "ARCHIVED") {
  return runAction(async () => {
    const user = await requireUser();
    await T.setTimelineStatus(user.id, worldId, timelineId, z.enum(["ACTIVE", "ARCHIVED"]).parse(status));
    revalidatePath(`/worlds/${worldId}`, "layout");
    return null;
  });
}

export async function renameTimelineAction(worldId: string, timelineId: string, name: string, description: string) {
  return runAction(async () => {
    const user = await requireUser();
    await T.renameTimeline(user.id, worldId, timelineId, name, description);
    revalidatePath(`/worlds/${worldId}`, "layout");
    return null;
  });
}
