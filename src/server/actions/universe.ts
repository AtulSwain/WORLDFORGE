"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../auth/session";
import { runAction } from "../action-utils";
import { db } from "../db";
import { rateLimit } from "../rate-limit";
import { toJson } from "../services/revisions";
import { instantiateSampleUniverse } from "@/sample/instantiate";
import { audit } from "../services/activity";
import * as U from "../services/universes";
import type { UniverseCreateInput } from "@/domain/schemas";
import { Prisma } from "@/generated/prisma/client";

const draftSchema = z.object({ step: z.number().int().min(0).max(5), values: z.record(z.string(), z.unknown()) });

export async function saveOnboardingDraftAction(draft: unknown) {
  return runAction(async () => {
    const user = await requireUser();
    const parsed = draftSchema.parse(draft);
    await db.userPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, onboardingDraft: toJson(parsed) },
      update: { onboardingDraft: toJson(parsed) },
    });
    return null;
  });
}

export async function createUniverseAction(input: UniverseCreateInput) {
  return runAction(async () => {
    const user = await requireUser();
    rateLimit(`universe-create:${user.id}`, 20, 60 * 60 * 1000);
    const { id } = await U.createUniverse(user.id, input);
    // Onboarding finished: clear the saved wizard draft.
    await db.userPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, lastUniverseId: id },
      update: { onboardingDraft: Prisma.DbNull, lastUniverseId: id },
    });
    revalidatePath("/dashboard");
    return { id };
  });
}

export async function addSampleUniverseAction() {
  return runAction(async () => {
    const user = await requireUser();
    rateLimit(`sample:${user.id}`, 5, 60 * 60 * 1000);
    const id = await instantiateSampleUniverse(db, user.id);
    await audit({ userId: user.id, universeId: id, action: "universe.create_sample", metadata: {} });
    revalidatePath("/dashboard");
    return { id };
  });
}

export async function updateUniverseAction(worldId: string, input: unknown) {
  return runAction(async () => {
    const user = await requireUser();
    await U.updateUniverse(user.id, worldId, input);
    revalidatePath(`/worlds/${worldId}`, "layout");
    return null;
  });
}

export async function updateRulesAction(worldId: string, input: unknown) {
  return runAction(async () => {
    const user = await requireUser();
    await U.updateUniverseRules(user.id, worldId, input);
    revalidatePath(`/worlds/${worldId}`, "layout");
    return null;
  });
}

export async function updateCalendarAction(worldId: string, input: unknown) {
  return runAction(async () => {
    const user = await requireUser();
    await U.updateCalendar(user.id, worldId, input);
    revalidatePath(`/worlds/${worldId}`, "layout");
    return null;
  });
}

export async function setUniverseArchivedAction(worldId: string, archived: boolean) {
  return runAction(async () => {
    const user = await requireUser();
    await U.setArchived(user.id, worldId, archived);
    revalidatePath("/dashboard");
    return null;
  });
}

export async function deleteUniverseAction(worldId: string, confirmName: string) {
  return runAction(async () => {
    const user = await requireUser();
    await U.deleteUniverse(user.id, worldId, confirmName);
    revalidatePath("/dashboard");
    return null;
  });
}

export async function runConsistencyAction(worldId: string, timelineId?: string | null) {
  return runAction(async () => {
    const user = await requireUser();
    rateLimit(`consistency:${user.id}`, 30, 60_000);
    const { findings } = await U.runConsistencyReport(user.id, worldId, timelineId);
    revalidatePath(`/worlds/${worldId}`);
    return { count: findings.length };
  });
}

export async function inviteMemberAction(worldId: string, input: unknown) {
  return runAction(async () => {
    const user = await requireUser();
    rateLimit(`invite:${user.id}`, 30, 60 * 60 * 1000);
    const { token } = await U.createInvitation(user.id, worldId, input);
    revalidatePath(`/worlds/${worldId}/settings`);
    return { link: `${process.env.APP_URL ?? ""}/invite/${token}` };
  });
}

export async function revokeInvitationAction(worldId: string, invitationId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await U.revokeInvitation(user.id, worldId, invitationId);
    revalidatePath(`/worlds/${worldId}/settings`);
    return null;
  });
}

export async function changeMemberRoleAction(worldId: string, memberUserId: string, role: "EDITOR" | "VIEWER") {
  return runAction(async () => {
    const user = await requireUser();
    await U.changeMemberRole(user.id, worldId, memberUserId, z.enum(["EDITOR", "VIEWER"]).parse(role));
    revalidatePath(`/worlds/${worldId}/settings`);
    return null;
  });
}

export async function removeMemberAction(worldId: string, memberUserId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await U.removeMember(user.id, worldId, memberUserId);
    revalidatePath(`/worlds/${worldId}/settings`);
    return null;
  });
}

export async function transferOwnershipAction(worldId: string, newOwnerId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await U.transferOwnership(user.id, worldId, newOwnerId);
    revalidatePath(`/worlds/${worldId}`, "layout");
    return null;
  });
}

export async function acceptInvitationAction(token: string) {
  return runAction(async () => {
    const user = await requireUser();
    const universeId = await U.acceptInvitation(user.id, user.email, token);
    revalidatePath("/dashboard");
    return { universeId };
  });
}

export async function createRelationshipTypeAction(worldId: string, input: { key: string; label: string; inverse?: string }) {
  return runAction(async () => {
    const user = await requireUser();
    const { createRelationshipType } = await import("../services/relationships");
    await createRelationshipType(user.id, worldId, input);
    revalidatePath(`/worlds/${worldId}/settings`);
    return null;
  });
}
