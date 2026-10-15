"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, revokeOtherSessions } from "../auth/session";
import { runAction } from "../action-utils";
import { rateLimit } from "../rate-limit";
import { changePassword, updatePreferences, updateProfile } from "../services/users";

export async function updateProfileAction(input: unknown) {
  return runAction(async () => {
    const user = await requireUser();
    await updateProfile(user.id, input);
    revalidatePath("/", "layout");
    return null;
  });
}

export async function changePasswordAction(input: { current: string; next: string }) {
  return runAction(async () => {
    const user = await requireUser();
    rateLimit(`password-change:${user.id}`, 10, 60 * 60 * 1000);
    const { current, next } = z.object({ current: z.string().max(200), next: z.string().max(200) }).parse(input);
    await changePassword(user.id, current, next);
    // A password change signs out every other device.
    const revoked = await revokeOtherSessions(user.id);
    return { revoked };
  });
}

export async function updatePreferencesAction(input: unknown) {
  return runAction(async () => {
    const user = await requireUser();
    await updatePreferences(user.id, input);
    revalidatePath("/", "layout");
    return null;
  });
}

export async function signOutOtherSessionsAction() {
  return runAction(async () => {
    const user = await requireUser();
    return { revoked: await revokeOtherSessions(user.id) };
  });
}
