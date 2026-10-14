import { z } from "zod";

/** Validated output schemas for every AI operation. Model output that fails these is rejected. */

export const AI_KINDS = ["CHARACTER_TRAITS", "CHARACTER_BACKSTORY", "CHARACTER_MOTIVATIONS", "CHARACTER_CONTRADICTIONS", "CHARACTER_RELATIONSHIPS", "WORLD_OUTLINE", "IMPACT_SUGGESTIONS"] as const;
export type AiKind = (typeof AI_KINDS)[number];

const s = (max: number) => z.string().max(max);

export const traitsSchema = z.object({
  personality: s(2000),
  strengths: z.array(s(120)).max(8),
  flaws: z.array(s(120)).max(8),
  values: z.array(s(120)).max(8),
  fears: z.array(s(120)).max(8),
});
export const backstorySchema = z.object({ backstory: s(8000) });
export const motivationsSchema = z.object({ motivations: z.array(s(200)).max(8), goals: s(2000) });
export const contradictionsSchema = z.object({
  issues: z.array(z.object({ title: s(200), explanation: s(1000), references: z.array(s(64)).max(10) })).max(12),
});
export const relationshipSuggestionsSchema = z.object({
  suggestions: z.array(z.object({ targetId: s(64), type: s(40), description: s(500), reasoning: s(500) })).max(10),
});
export const outlineSchema = z.object({
  summary: s(2000),
  factions: z.array(z.object({ name: s(120), summary: s(400) })).max(8),
  characters: z.array(z.object({ name: s(120), summary: s(400), faction: s(120).optional() })).max(12),
  locations: z.array(z.object({ name: s(120), summary: s(400) })).max(10),
  events: z.array(z.object({ title: s(160), year: z.number().int(), description: s(600) })).max(12),
});
export const impactSuggestionsSchema = z.object({
  impacts: z
    .array(
      z.object({
        title: s(200),
        description: s(800),
        category: z.enum(["CHARACTER", "POLITICAL", "GEOGRAPHIC", "NARRATIVE", "DEPENDENT_EVENT"]),
        affectedIds: z.array(s(64)).max(10),
        reasoning: s(600),
      }),
    )
    .max(10),
});

export const SCHEMA_BY_KIND = {
  CHARACTER_TRAITS: traitsSchema,
  CHARACTER_BACKSTORY: backstorySchema,
  CHARACTER_MOTIVATIONS: motivationsSchema,
  CHARACTER_CONTRADICTIONS: contradictionsSchema,
  CHARACTER_RELATIONSHIPS: relationshipSuggestionsSchema,
  WORLD_OUTLINE: outlineSchema,
  IMPACT_SUGGESTIONS: impactSuggestionsSchema,
} as const;

export type AiOutput<K extends AiKind> = z.infer<(typeof SCHEMA_BY_KIND)[K]>;
