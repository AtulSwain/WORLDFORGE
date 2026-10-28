"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../auth/session";
import { runAction } from "../action-utils";
import { db } from "../db";
import * as E from "../services/entities";
import * as R from "../services/relationships";
import * as Ev from "../services/events";
import * as L from "../services/lore";
import type { EntityInput, EventInput, LoreInput, RelationshipInput } from "@/domain/schemas";

const id = z.string().min(1).max(64);
const version = z.number().int().min(0);
const refresh = (worldId: string) => revalidatePath(`/worlds/${worldId}`, "layout");

// ── Entities ──

export async function createEntityAction(
  worldId: string,
  input: EntityInput,
  initialRelationships: { type: string; targetId: string; direction: "out" | "in" }[] = [],
) {
  return runAction(async () => {
    const user = await requireUser();
    const entity = await db.$transaction(async (tx) => {
      const e = await E.createEntity(user.id, worldId, input, tx);
      for (const r of initialRelationships.slice(0, 50)) {
        await R.createRelationship(
          user.id,
          worldId,
          r.direction === "out" ? { sourceId: e.id, targetId: id.parse(r.targetId), type: r.type } : { sourceId: id.parse(r.targetId), targetId: e.id, type: r.type },
          tx,
        );
      }
      return e;
    });
    refresh(worldId);
    return { id: entity.id, type: entity.type };
  });
}

export async function updateEntityAction(worldId: string, entityId: string, input: EntityInput, expectedVersion: number) {
  return runAction(async () => {
    const user = await requireUser();
    const e = await E.updateEntity(user.id, worldId, id.parse(entityId), input, version.parse(expectedVersion));
    refresh(worldId);
    return { id: e.id, version: e.version };
  });
}

export async function setEntityArchivedAction(worldId: string, entityId: string, archived: boolean) {
  return runAction(async () => {
    const user = await requireUser();
    await E.setEntityArchived(user.id, worldId, id.parse(entityId), archived);
    refresh(worldId);
    return null;
  });
}

export async function restoreEntityRevisionAction(worldId: string, entityId: string, revisionId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await E.restoreEntityRevision(user.id, worldId, id.parse(entityId), id.parse(revisionId));
    refresh(worldId);
    return null;
  });
}

// ── Relationships ──

export async function createRelationshipAction(worldId: string, input: RelationshipInput & { timelineId?: string | null }) {
  return runAction(async () => {
    const user = await requireUser();
    const r = await R.createRelationship(user.id, worldId, input);
    refresh(worldId);
    return { id: r.id };
  });
}

export async function updateRelationshipAction(worldId: string, relId: string, input: RelationshipInput, expectedVersion: number) {
  return runAction(async () => {
    const user = await requireUser();
    await R.updateRelationship(user.id, worldId, id.parse(relId), input, version.parse(expectedVersion));
    refresh(worldId);
    return null;
  });
}

export async function archiveRelationshipAction(worldId: string, relId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await R.archiveRelationship(user.id, worldId, id.parse(relId));
    refresh(worldId);
    return null;
  });
}

// ── Events ──

export async function createEventAction(worldId: string, input: EventInput & { timelineId?: string | null }, links: { dependencies?: { otherId: string; type: string; direction: "in" | "out" }[]; loreIds?: string[] } = {}) {
  return runAction(async () => {
    const user = await requireUser();
    const ev = await Ev.createEvent(user.id, worldId, input);
    for (const d of links.dependencies ?? []) {
      await Ev.addDependency(user.id, worldId, d.direction === "in" ? { sourceId: d.otherId, targetId: ev.id, type: d.type } : { sourceId: ev.id, targetId: d.otherId, type: d.type }, input.timelineId);
    }
    const loreIds = [...new Set((links.loreIds ?? []).map((x) => id.parse(x)))];
    if (loreIds.length) {
      const docs = await db.loreDocument.findMany({ where: { id: { in: loreIds }, universeId: worldId }, select: { id: true } });
      await db.loreLink.createMany({ data: docs.map((d) => ({ documentId: d.id, eventId: ev.id })), skipDuplicates: true });
    }
    refresh(worldId);
    return { id: ev.id };
  });
}

export async function updateEventAction(worldId: string, eventId: string, input: EventInput, expectedVersion: number) {
  return runAction(async () => {
    const user = await requireUser();
    const ev = await Ev.updateEvent(user.id, worldId, id.parse(eventId), input, version.parse(expectedVersion));
    refresh(worldId);
    return { id: ev.id, version: ev.version };
  });
}

export async function setEventArchivedAction(worldId: string, eventId: string, archived: boolean) {
  return runAction(async () => {
    const user = await requireUser();
    await Ev.setEventArchived(user.id, worldId, id.parse(eventId), archived);
    refresh(worldId);
    return null;
  });
}

export async function restoreEventRevisionAction(worldId: string, eventId: string, revisionId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await Ev.restoreEventRevision(user.id, worldId, id.parse(eventId), id.parse(revisionId));
    refresh(worldId);
    return null;
  });
}

export async function addDependencyAction(worldId: string, input: { sourceId: string; targetId: string; type: string; note?: string }, timelineId?: string | null) {
  return runAction(async () => {
    const user = await requireUser();
    await Ev.addDependency(user.id, worldId, input, timelineId);
    refresh(worldId);
    return null;
  });
}

export async function removeDependencyAction(worldId: string, dependencyId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await Ev.removeDependency(user.id, worldId, id.parse(dependencyId));
    refresh(worldId);
    return null;
  });
}

// ── Lore ──

export async function createLoreAction(worldId: string, input: LoreInput) {
  return runAction(async () => {
    const user = await requireUser();
    const doc = await L.createLore(user.id, worldId, input);
    refresh(worldId);
    return { id: doc.id, version: doc.version };
  });
}

/** Autosave endpoint: no layout revalidation (keeps typing smooth); returns the confirmed version. */
export async function saveLoreAction(worldId: string, docId: string, input: LoreInput, expectedVersion: number) {
  return runAction(async () => {
    const user = await requireUser();
    const r = await L.updateLore(user.id, worldId, id.parse(docId), input, version.parse(expectedVersion));
    return { version: r.version, savedAt: r.updatedAt.toISOString() };
  });
}

export async function setLoreArchivedAction(worldId: string, docId: string, archived: boolean) {
  return runAction(async () => {
    const user = await requireUser();
    await L.setLoreArchived(user.id, worldId, id.parse(docId), archived);
    refresh(worldId);
    return null;
  });
}

export async function restoreLoreRevisionAction(worldId: string, docId: string, revisionId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await L.restoreLoreRevision(user.id, worldId, id.parse(docId), id.parse(revisionId));
    refresh(worldId);
    return null;
  });
}
