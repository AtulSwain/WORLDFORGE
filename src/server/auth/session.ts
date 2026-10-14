import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "../db";
import { randomToken, sha256 } from "./password";

export const SESSION_COOKIE = "wf_session";
const SESSION_DAYS = 30;
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

/** Creates a DB-backed session and sets an httpOnly cookie holding only the random token. */
export async function createSession(userId: string): Promise<void> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const ua = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await db.session.create({ data: { userId, tokenHash: sha256(token), expiresAt, userAgent: ua } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Resolves the current user once per request. Expired sessions are treated as signed out. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  if (Date.now() - session.lastUsedAt.getTime() > REFRESH_AFTER_MS) {
    // Sliding expiry; the cookie keeps its original expiry until the next sign-in.
    await db.session
      .update({
        where: { id: session.id },
        data: { lastUsedAt: new Date(), expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000) },
      })
      .catch(() => undefined);
  }
  return session.user;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  store.delete(SESSION_COOKIE);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
