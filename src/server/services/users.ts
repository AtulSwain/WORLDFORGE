import "server-only";
import { z } from "zod";
import { emailSchema, loginSchema, passwordSchema, signupSchema } from "@/domain/schemas";
import { db } from "../db";
import { AppError, conflict, invalid, notFound } from "../errors";
import { hashPassword, randomToken, sha256, verifyPassword } from "../auth/password";
import { audit } from "./activity";

// Pre-computed hash used to equalise timing when the email does not exist.
let dummyHash: Promise<string> | null = null;

export async function registerUser(raw: unknown) {
  const input = signupSchema.parse(raw);
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict("An account with that email already exists. Try signing in instead.");
  const user = await db.user.create({
    data: { email: input.email, name: input.name, passwordHash: await hashPassword(input.password), preferences: { create: {} } },
  });
  await audit({ userId: user.id, action: "auth.signup", metadata: {} });
  return user;
}

export async function authenticate(raw: unknown, ip: string | null) {
  const input = loginSchema.parse(raw);
  const user = await db.user.findUnique({ where: { email: input.email } });
  if (!user) {
    dummyHash ??= hashPassword("timing-equaliser");
    await verifyPassword(input.password, await dummyHash);
    throw new AppError("That email and password do not match.", "VALIDATION");
  }
  const ok = await verifyPassword(input.password, user.passwordHash);
  await audit({ userId: user.id, action: ok ? "auth.login" : "auth.login_failed", metadata: {}, ip });
  if (!ok) throw new AppError("That email and password do not match.", "VALIDATION");
  return user;
}

/** Always succeeds from the caller's perspective (no account enumeration). Returns the token for delivery. */
export async function requestPasswordReset(rawEmail: unknown): Promise<{ token: string; email: string } | null> {
  const email = emailSchema.parse(rawEmail);
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return null;
  const token = randomToken(32);
  await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
  await audit({ userId: user.id, action: "auth.reset_requested", metadata: {} });
  return { token, email };
}

export async function resetPassword(token: string, rawPassword: unknown) {
  const password = passwordSchema.parse(rawPassword);
  await db.$transaction(async (tx) => {
    const row = await tx.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row || row.usedAt || row.expiresAt < new Date()) throw invalid("This reset link is invalid or has expired.");
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    if (!claimed.count) throw invalid("This reset link has already been used.");
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(password) } });
    // Sign out everywhere after a reset.
    await tx.session.deleteMany({ where: { userId: row.userId } });
    await audit({ userId: row.userId, action: "auth.password_reset", metadata: {} }, tx);
  });
}

export async function changePassword(userId: string, current: string, next: unknown) {
  const password = passwordSchema.parse(next);
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("User");
  if (!(await verifyPassword(current, user.passwordHash))) throw invalid("Your current password is incorrect.", { current: ["Incorrect password."] });
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } });
  await audit({ userId, action: "auth.password_change", metadata: {} });
}

export const profileSchema = z.object({ name: z.string().trim().min(1).max(80), bio: z.string().max(1000).default("") });

export async function updateProfile(userId: string, raw: unknown) {
  const input = profileSchema.parse(raw);
  return db.user.update({ where: { id: userId }, data: input, select: { id: true, name: true, bio: true } });
}

export async function getPreferences(userId: string) {
  return db.userPreference.upsert({ where: { userId }, create: { userId }, update: {} });
}

export const preferencesSchema = z.object({ reducedMotion: z.boolean(), directoryView: z.enum(["grid", "list"]) });

export async function updatePreferences(userId: string, raw: unknown) {
  const input = preferencesSchema.parse(raw);
  return db.userPreference.upsert({ where: { userId }, create: { userId, ...input }, update: input });
}
