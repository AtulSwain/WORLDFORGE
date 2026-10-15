import "server-only";
import type { Metadata } from "next";
import { ENTITY_TYPE_META, type EntityTypeKey } from "@/domain/catalog";
import { getCurrentUser } from "./auth/session";
import { db } from "./db";

/**
 * Page titles for universe records. Names are only revealed to members of the universe;
 * everyone else gets a generic title (the page itself responds with 404).
 */
async function memberOf(worldId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const m = await db.universeMember.findUnique({ where: { universeId_userId: { universeId: worldId, userId: user.id } }, select: { id: true } });
  return !!m;
}

export async function universeMetadata(worldId: string): Promise<Metadata> {
  if (!(await memberOf(worldId))) return { title: "Universe" };
  const u = await db.universe.findUnique({ where: { id: worldId }, select: { name: true } });
  return { title: u?.name ?? "Universe" };
}

export async function entityMetadata(worldId: string, entityId: string, action?: "Edit"): Promise<Metadata> {
  if (!(await memberOf(worldId))) return { title: "Not found" };
  const e = await db.entity.findFirst({ where: { id: entityId, universeId: worldId }, select: { name: true } });
  if (!e) return { title: "Not found" };
  return { title: action ? `${action} ${e.name}` : e.name };
}

export function newEntityMetadata(type: EntityTypeKey | null): Metadata {
  return { title: type ? `New ${ENTITY_TYPE_META[type].label.toLowerCase()}` : "New entity" };
}

export async function eventMetadata(worldId: string, eventId: string, action?: "Edit"): Promise<Metadata> {
  if (!(await memberOf(worldId))) return { title: "Not found" };
  const e = await db.historicalEvent.findFirst({ where: { id: eventId, universeId: worldId }, select: { title: true } });
  if (!e) return { title: "Not found" };
  return { title: action ? `${action} ${e.title}` : e.title };
}

export async function loreMetadata(worldId: string, documentId: string): Promise<Metadata> {
  if (!(await memberOf(worldId))) return { title: "Not found" };
  const d = await db.loreDocument.findFirst({ where: { id: documentId, universeId: worldId }, select: { title: true } });
  return { title: d?.title ?? "Not found" };
}
