"use server";

import { redirect } from "next/navigation";
import { authenticate, registerUser, requestPasswordReset, resetPassword } from "../services/users";
import { clientIp, createSession, destroySession } from "../auth/session";
import { runAction, type ActionResult } from "../action-utils";
import { rateLimit } from "../rate-limit";

function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function signupAction(input: { name: string; email: string; password: string }): Promise<ActionResult<{ next: string }>> {
  return runAction(async () => {
    rateLimit(`signup:${await clientIp()}`, 10, 60 * 60 * 1000);
    const user = await registerUser(input);
    await createSession(user.id);
    return { next: "/worlds/new?welcome=1" };
  });
}

export async function loginAction(input: { email: string; password: string; next?: string }): Promise<ActionResult<{ next: string }>> {
  return runAction(async () => {
    const ip = await clientIp();
    rateLimit(`login:${ip}`, 20, 15 * 60 * 1000);
    rateLimit(`login:${String(input.email).toLowerCase()}`, 10, 15 * 60 * 1000);
    const user = await authenticate(input, ip);
    await createSession(user.id);
    return { next: safeNext(input.next) };
  });
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function requestResetAction(email: string): Promise<ActionResult<{ devLink: string | null }>> {
  return runAction(async () => {
    rateLimit(`reset:${await clientIp()}`, 5, 60 * 60 * 1000);
    const result = await requestPasswordReset(email);
    if (!result) return { devLink: null };
    const link = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${result.token}`;
    // No email provider is configured in this build. In development the link is logged and
    // returned so the flow can be completed; in production it is never exposed to the client.
    if (process.env.NODE_ENV !== "production") {
      console.info(`[worldforge] Password reset link for ${result.email}: ${link}`);
      return { devLink: link };
    }
    return { devLink: null };
  });
}

export async function resetPasswordAction(token: string, password: string): Promise<ActionResult> {
  return runAction(async () => {
    rateLimit(`reset-confirm:${await clientIp()}`, 10, 60 * 60 * 1000);
    await resetPassword(token, password);
    return null;
  });
}
