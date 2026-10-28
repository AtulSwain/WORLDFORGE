import "server-only";
import { can, type Capability, type Role } from "@/domain/permissions";
import { db, type DbOrTx } from "../db";
import { forbidden, notFound } from "../errors";

export interface AccessContext {
  userId: string;
  universeId: string;
  role: Role;
}

/**
 * Central authorization check. Non-members get NOT_FOUND (no information leak about a
 * universe's existence); members lacking the capability get FORBIDDEN.
 */
export async function requireAccess(
  userId: string,
  universeId: string,
  capability: Capability,
  client: DbOrTx = db,
): Promise<AccessContext> {
  if (!universeId || typeof universeId !== "string") throw notFound("Universe");
  const member = await client.universeMember.findUnique({
    where: { universeId_userId: { universeId, userId } },
    select: { role: true, universe: { select: { archivedAt: true } } },
  });
  if (!member) throw notFound("Universe");
  if (!can(member.role, capability)) {
    throw forbidden(member.role === "VIEWER" ? "Viewers can explore this universe but cannot change it." : undefined);
  }
  return { userId, universeId, role: member.role };
}

export async function getRole(userId: string, universeId: string): Promise<Role | null> {
  const m = await db.universeMember.findUnique({ where: { universeId_userId: { universeId, userId } }, select: { role: true } });
  return m?.role ?? null;
}

/** Verifies every id refers to a non-archived entity in this universe (prevents IDOR via foreign ids). */
export async function assertEntitiesInUniverse(client: DbOrTx, universeId: string, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unique.length) return;
  const count = await client.entity.count({ where: { id: { in: unique }, universeId } });
  if (count !== unique.length) throw notFound("Referenced entity");
}

export async function assertEventsInUniverse(client: DbOrTx, universeId: string, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unique.length) return;
  const count = await client.historicalEvent.count({ where: { id: { in: unique }, universeId } });
  if (count !== unique.length) throw notFound("Referenced event");
}
