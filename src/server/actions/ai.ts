"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../auth/session";
import { runAction } from "../action-utils";
import { db } from "../db";
import { invalid } from "../errors";
import { requireAccess } from "../services/access";
import { createEntity, patchEntityFields } from "../services/entities";
import { createRelationship } from "../services/relationships";
import { createEvent } from "../services/events";
import * as AI from "../ai/service";
import { backstorySchema, motivationsSchema, outlineSchema, relationshipSuggestionsSchema, traitsSchema } from "../ai/schemas";

const characterKind = z.enum(["CHARACTER_TRAITS", "CHARACTER_BACKSTORY", "CHARACTER_MOTIVATIONS", "CHARACTER_CONTRADICTIONS", "CHARACTER_RELATIONSHIPS"]);

export async function requestCharacterSuggestionAction(worldId: string, entityId: string, kind: string) {
  return runAction(async () => {
    const user = await requireUser();
    const s = await AI.suggestForCharacter(user.id, worldId, entityId, characterKind.parse(kind));
    return { id: s.id, kind: s.kind, output: s.output, isDemo: s.isDemo, model: s.model };
  });
}

/** Applies an edited, user-approved character suggestion through the normal validated write path. */
export async function acceptCharacterSuggestionAction(worldId: string, entityId: string, suggestionId: string, edited: unknown, expectedVersion: number) {
  return runAction(async () => {
    const user = await requireUser();
    await requireAccess(user.id, worldId, "content:write");
    const s = await db.aiSuggestion.findFirst({ where: { id: suggestionId, universeId: worldId, targetId: entityId, status: "PENDING" } });
    if (!s) throw invalid("This suggestion is no longer pending.");
    let final: unknown = edited;
    switch (s.kind) {
      case "CHARACTER_TRAITS": {
        const v = traitsSchema.parse(edited);
        await patchEntityFields(user.id, worldId, entityId, { attributes: v }, expectedVersion, "Accepted AI trait suggestion");
        break;
      }
      case "CHARACTER_BACKSTORY": {
        const v = backstorySchema.parse(edited);
        await patchEntityFields(user.id, worldId, entityId, { attributes: { backstory: v.backstory } }, expectedVersion, "Accepted AI backstory suggestion");
        break;
      }
      case "CHARACTER_MOTIVATIONS": {
        const v = motivationsSchema.parse(edited);
        await patchEntityFields(user.id, worldId, entityId, { attributes: v }, expectedVersion, "Accepted AI motivation suggestion");
        break;
      }
      case "CHARACTER_RELATIONSHIPS": {
        const v = relationshipSuggestionsSchema.parse(edited);
        // Never trust model-generated ids: keep only entities that exist in this universe.
        const valid = await AI.existingEntityIds(worldId, v.suggestions.map((x) => x.targetId));
        const accepted = v.suggestions.filter((x) => valid.has(x.targetId));
        if (accepted.length !== v.suggestions.length) throw invalid("Some suggested relationships reference records that do not exist. Remove them and try again.");
        await db.$transaction(async (tx) => {
          for (const r of accepted) {
            await createRelationship(user.id, worldId, { sourceId: entityId, targetId: r.targetId, type: r.type, description: r.description }, tx);
          }
        });
        final = { suggestions: accepted };
        break;
      }
      case "CHARACTER_CONTRADICTIONS":
        // Advisory only: acknowledging records the review without writing canon.
        break;
      default:
        throw invalid("Unsupported suggestion type.");
    }
    await AI.markAccepted(worldId, suggestionId, final);
    revalidatePath(`/worlds/${worldId}`, "layout");
    return null;
  });
}

export async function rejectSuggestionAction(worldId: string, suggestionId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await AI.rejectSuggestion(user.id, worldId, suggestionId);
    return null;
  });
}

export async function requestOutlineAction(worldId: string) {
  return runAction(async () => {
    const user = await requireUser();
    const s = await AI.suggestWorldOutline(user.id, worldId);
    return { id: s.id, output: s.output, isDemo: s.isDemo };
  });
}

/** Creates the selected (edited) outline records in one transaction. */
export async function acceptOutlineAction(worldId: string, suggestionId: string, edited: unknown) {
  return runAction(async () => {
    const user = await requireUser();
    await requireAccess(user.id, worldId, "content:write");
    const outline = outlineSchema.parse(edited);
    await AI.getPendingSuggestion(worldId, suggestionId, "WORLD_OUTLINE");
    await db.$transaction(
      async (tx) => {
        const factionIds = new Map<string, string>();
        for (const f of outline.factions) {
          const e = await createEntity(user.id, worldId, { type: "FACTION", name: f.name, summary: f.summary, status: "ACTIVE" }, tx);
          factionIds.set(f.name, e.id);
        }
        for (const c of outline.characters) {
          const e = await createEntity(user.id, worldId, { type: "CHARACTER", name: c.name, summary: c.summary, status: "ALIVE" }, tx);
          const fid = c.faction ? factionIds.get(c.faction) : undefined;
          if (fid) await createRelationship(user.id, worldId, { sourceId: e.id, targetId: fid, type: "MEMBER_OF" }, tx);
        }
        for (const l of outline.locations) await createEntity(user.id, worldId, { type: "LOCATION", name: l.name, summary: l.summary, status: "INHABITED" }, tx);
        for (const ev of outline.events) await createEvent(user.id, worldId, { title: ev.title, description: ev.description, startYear: ev.year, precision: "YEAR" }, tx);
      },
      { timeout: 30_000 },
    );
    await AI.markAccepted(worldId, suggestionId, outline);
    await AI.logAiActivity(worldId, user.id, "Accepted an AI world outline");
    revalidatePath(`/worlds/${worldId}`, "layout");
    return null;
  });
}
