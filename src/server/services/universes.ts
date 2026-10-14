import "server-only";
import type { Genre } from "@/generated/prisma/client";
import { DEFAULT_CALENDAR } from "@/domain/chronology";
import { calendarSchema, universeCreateSchema, universeSettingsSchema, universeUpdateSchema, inviteSchema, type UniverseCreateInput } from "@/domain/schemas";
import { slugify, uniqueSlug } from "@/lib/slug";
import { db } from "../db";
import { conflict, forbidden, invalid, notFound } from "../errors";
import { randomToken, sha256 } from "../auth/password";
import { requireAccess } from "./access";
import { audit, recordActivity } from "./activity";
import { toJson } from "./revisions";
import { instantiateSampleUniverse } from "@/sample/instantiate";
import { checkConsistency } from "@/domain/consistency";
import { parseSettings } from "@/domain/schemas";
import { loadSnapshot, resolveTimelineId } from "./snapshot";

export async function uniqueUniverseSlug(name: string): Promise<string> {
  const base = slugify(name);
  const taken = await db.universe.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } });
  return uniqueSlug(base, taken.map((t) => t.slug));
}

export const DEFAULT_MAP = {
  title: "World map",
  imageSource: "/maps/parchment.svg",
  width: 2400,
  height: 1600,
};

export async function createUniverse(userId: string, raw: UniverseCreateInput) {
  const input = universeCreateSchema.parse(raw);
  if (input.startMethod === "TEMPLATE") {
    const id = await instantiateSampleUniverse(db, userId, { name: input.name });
    await audit({ userId, universeId: id, action: "universe.create_from_template", metadata: { name: input.name } });
    return { id };
  }
  const slug = await uniqueUniverseSlug(input.name);
  const universe = await db.$transaction(async (tx) => {
    const u = await tx.universe.create({
      data: {
        ownerId: userId,
        name: input.name,
        slug,
        description: input.description,
        genre: input.genre as Genre,
        customGenre: input.genre === "CUSTOM" ? input.customGenre || null : null,
        tone: input.tone || null,
        mainConflict: input.mainConflict || null,
        timePeriod: input.timePeriod || null,
        coreRules: input.coreRules || null,
        calendar: toJson(calendarSchema.parse(DEFAULT_CALENDAR)),
        settings: toJson(universeSettingsSchema.parse({})),
        members: { create: { userId, role: "OWNER" } },
      },
    });
    const main = await tx.timeline.create({
      data: { universeId: u.id, name: "Prime Canon", description: "The authoritative history of this universe.", isMain: true },
    });
    await tx.universe.update({ where: { id: u.id }, data: { defaultTimelineId: main.id } });
    await tx.worldMap.create({
      data: {
        universeId: u.id,
        ...DEFAULT_MAP,
        isDefault: true,
        layerConfig: { markers: true, routes: true, regions: true, labels: true },
        defaultViewport: { x: DEFAULT_MAP.width / 2, y: DEFAULT_MAP.height / 2, zoom: 0.5 },
      },
    });
    await recordActivity(tx, { universeId: u.id, actorId: userId, action: "universe.created", targetType: "UNIVERSE", targetId: u.id, summary: `Founded ${u.name}` });
    return u;
  });
  await audit({ userId, universeId: universe.id, action: "universe.create", metadata: { name: universe.name } });
  return { id: universe.id };
}

export async function listUniverses(userId: string, opts: { includeArchived?: boolean } = {}) {
  const memberships = await db.universeMember.findMany({
    where: { userId, universe: opts.includeArchived ? {} : { archivedAt: null } },
    include: {
      universe: {
        include: {
          _count: { select: { entities: { where: { archivedAt: null } }, events: { where: { archivedAt: null } }, timelines: true } },
        },
      },
    },
    orderBy: { universe: { updatedAt: "desc" } },
  });
  return memberships.map((m) => ({ ...m.universe, role: m.role }));
}

export async function getUniverse(userId: string, universeId: string) {
  const access = await requireAccess(userId, universeId, "universe:read");
  const universe = await db.universe.findUnique({ where: { id: universeId } });
  if (!universe) throw notFound("Universe");
  return { universe, role: access.role };
}

export async function getUniverseOverview(userId: string, universeId: string) {
  const { universe, role } = await getUniverse(userId, universeId);
  const [typeCounts, eventCount, timelineCount, loreCount, relCount, activity, recentEntities, recentEvents, lastReport] = await Promise.all([
    db.entity.groupBy({ by: ["type"], where: { universeId, archivedAt: null }, _count: { _all: true } }),
    db.historicalEvent.count({ where: { universeId, archivedAt: null } }),
    db.timeline.count({ where: { universeId, status: "ACTIVE" } }),
    db.loreDocument.count({ where: { universeId, archivedAt: null } }),
    db.relationship.count({ where: { universeId, archivedAt: null } }),
    db.universeActivity.findMany({
      where: { universeId },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { actor: { select: { name: true } } },
    }),
    db.entity.findMany({
      where: { universeId, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, name: true, type: true, summary: true, updatedAt: true },
    }),
    db.historicalEvent.findMany({
      where: { universeId, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: { id: true, title: true, startYear: true, updatedAt: true },
    }),
    db.consistencyReport.findFirst({ where: { universeId }, orderBy: { createdAt: "desc" } }),
  ]);
  const counts = Object.fromEntries(typeCounts.map((t) => [t.type, t._count._all])) as Record<string, number>;
  return { universe, role, counts, eventCount, timelineCount, loreCount, relCount, activity, recentEntities, recentEvents, lastReport };
}

/** Runs deterministic consistency checks for a timeline and persists the report. */
export async function runConsistencyReport(userId: string, universeId: string, timelineId?: string | null) {
  await requireAccess(userId, universeId, "universe:read");
  const universe = await db.universe.findUniqueOrThrow({ where: { id: universeId }, select: { calendar: true, settings: true } });
  const tid = await resolveTimelineId(universeId, timelineId);
  const snapshot = await loadSnapshot(universeId, tid);
  const findings = checkConsistency(snapshot, parseSettings(universe.settings), calendarSchema.parse(universe.calendar ?? {}));
  const report = await db.consistencyReport.create({
    data: {
      universeId,
      timelineId: tid,
      findings: toJson(findings),
      errorCount: findings.filter((f) => f.severity === "ERROR").length,
      warnCount: findings.filter((f) => f.severity === "WARNING").length,
    },
  });
  return { report, findings };
}

export async function updateUniverse(userId: string, universeId: string, raw: unknown) {
  await requireAccess(userId, universeId, "universe:settings");
  const input = universeUpdateSchema.parse(raw);
  if (input.defaultTimelineId) {
    const t = await db.timeline.findFirst({ where: { id: input.defaultTimelineId, universeId } });
    if (!t) throw invalid("Default timeline must belong to this universe.");
  }
  const u = await db.universe.update({
    where: { id: universeId },
    data: { ...input, genre: input.genre as Genre },
  });
  await recordActivity(db, { universeId, actorId: userId, action: "universe.updated", targetType: "UNIVERSE", targetId: universeId, summary: "Updated universe settings" });
  return u;
}

export async function updateUniverseRules(userId: string, universeId: string, raw: unknown) {
  await requireAccess(userId, universeId, "universe:settings");
  const settings = universeSettingsSchema.parse(raw);
  await db.universe.update({ where: { id: universeId }, data: { settings: toJson(settings) } });
  return settings;
}

export async function updateCalendar(userId: string, universeId: string, raw: unknown) {
  await requireAccess(userId, universeId, "universe:settings");
  const calendar = calendarSchema.parse(raw);
  await db.universe.update({ where: { id: universeId }, data: { calendar: toJson(calendar) } });
  return calendar;
}

export async function setArchived(userId: string, universeId: string, archived: boolean) {
  await requireAccess(userId, universeId, "universe:delete");
  await db.universe.update({ where: { id: universeId }, data: { archivedAt: archived ? new Date() : null } });
  await audit({ userId, universeId, action: archived ? "universe.archive" : "universe.restore", metadata: {} });
}

export async function deleteUniverse(userId: string, universeId: string, confirmName: string) {
  await requireAccess(userId, universeId, "universe:delete");
  const u = await db.universe.findUniqueOrThrow({ where: { id: universeId }, select: { name: true } });
  if (u.name !== confirmName) throw invalid("Type the universe name exactly to confirm deletion.");
  await audit({ userId, universeId: null, action: "universe.delete", metadata: { universeId, name: u.name } });
  await db.$transaction(async (tx) => {
    // Break self-references before cascading.
    await tx.timeline.updateMany({ where: { universeId }, data: { parentId: null } });
    await tx.universe.delete({ where: { id: universeId } });
  });
}

// ── Members & invitations ──

export async function listMembers(userId: string, universeId: string) {
  await requireAccess(userId, universeId, "universe:read");
  const [members, invitations] = await Promise.all([
    db.universeMember.findMany({ where: { universeId }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
    db.invitation.findMany({ where: { universeId, status: "PENDING", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
  ]);
  return { members, invitations };
}

export async function createInvitation(userId: string, universeId: string, raw: unknown) {
  await requireAccess(userId, universeId, "members:manage");
  const input = inviteSchema.parse(raw);
  const existingMember = await db.universeMember.findFirst({ where: { universeId, user: { email: input.email } } });
  if (existingMember) throw conflict("That person is already a member.");
  const token = randomToken(24);
  const invitation = await db.invitation.create({
    data: {
      universeId,
      email: input.email,
      role: input.role,
      tokenHash: sha256(token),
      invitedById: userId,
      expiresAt: new Date(Date.now() + 14 * 86_400_000),
    },
  });
  await audit({ userId, universeId, action: "member.invite", metadata: { email: input.email, role: input.role } });
  return { invitation, token };
}

export async function revokeInvitation(userId: string, universeId: string, invitationId: string) {
  await requireAccess(userId, universeId, "members:manage");
  const r = await db.invitation.updateMany({ where: { id: invitationId, universeId, status: "PENDING" }, data: { status: "REVOKED" } });
  if (!r.count) throw notFound("Invitation");
  await audit({ userId, universeId, action: "member.invite_revoke", metadata: { invitationId } });
}

export async function getInvitationByToken(token: string) {
  return db.invitation.findUnique({
    where: { tokenHash: sha256(token) },
    include: { universe: { select: { id: true, name: true } }, invitedBy: { select: { name: true } } },
  });
}

export async function acceptInvitation(userId: string, userEmail: string, token: string) {
  return db.$transaction(async (tx) => {
    const inv = await tx.invitation.findUnique({ where: { tokenHash: sha256(token) } });
    if (!inv || inv.status !== "PENDING" || inv.expiresAt < new Date()) throw notFound("Invitation");
    if (inv.email !== userEmail.toLowerCase()) throw forbidden("This invitation was sent to a different email address.");
    const claimed = await tx.invitation.updateMany({ where: { id: inv.id, status: "PENDING" }, data: { status: "ACCEPTED", acceptedAt: new Date() } });
    if (!claimed.count) throw conflict("This invitation was already used.");
    await tx.universeMember.upsert({
      where: { universeId_userId: { universeId: inv.universeId, userId } },
      create: { universeId: inv.universeId, userId, role: inv.role },
      update: {},
    });
    await audit({ userId, universeId: inv.universeId, action: "member.join", metadata: { role: inv.role } }, tx);
    await recordActivity(tx, { universeId: inv.universeId, actorId: userId, action: "member.joined", summary: `Joined as ${inv.role.toLowerCase()}` });
    return inv.universeId;
  });
}

export async function changeMemberRole(userId: string, universeId: string, memberUserId: string, role: "EDITOR" | "VIEWER") {
  await requireAccess(userId, universeId, "members:manage");
  const target = await db.universeMember.findUnique({ where: { universeId_userId: { universeId, userId: memberUserId } } });
  if (!target) throw notFound("Member");
  if (target.role === "OWNER") throw forbidden("Transfer ownership before changing the owner's role.");
  await db.universeMember.update({ where: { id: target.id }, data: { role } });
  await audit({ userId, universeId, action: "member.role_change", metadata: { memberUserId, role } });
}

export async function removeMember(userId: string, universeId: string, memberUserId: string) {
  const access = await requireAccess(userId, universeId, "universe:read");
  // Members may leave; managing others requires the capability.
  if (memberUserId !== userId) await requireAccess(userId, universeId, "members:manage");
  const target = await db.universeMember.findUnique({ where: { universeId_userId: { universeId, userId: memberUserId } } });
  if (!target) throw notFound("Member");
  if (target.role === "OWNER") throw forbidden("The owner cannot be removed. Transfer ownership first.");
  await db.universeMember.delete({ where: { id: target.id } });
  await audit({ userId, universeId, action: "member.remove", metadata: { memberUserId, by: access.role } });
}

export async function transferOwnership(userId: string, universeId: string, newOwnerId: string) {
  await requireAccess(userId, universeId, "universe:delete");
  await db.$transaction(async (tx) => {
    const target = await tx.universeMember.findUnique({ where: { universeId_userId: { universeId, userId: newOwnerId } } });
    if (!target) throw notFound("Member");
    await tx.universeMember.update({ where: { id: target.id }, data: { role: "OWNER" } });
    await tx.universeMember.update({ where: { universeId_userId: { universeId, userId } }, data: { role: "EDITOR" } });
    await tx.universe.update({ where: { id: universeId }, data: { ownerId: newOwnerId } });
    await audit({ userId, universeId, action: "universe.transfer", metadata: { newOwnerId } }, tx);
  });
}
