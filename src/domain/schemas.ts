import { z } from "zod";
import {
  BUILTIN_RELATIONSHIP_KEYS,
  CANON_STATUSES,
  DEPENDENCY_TYPES,
  ENTITY_TYPES,
  GENRES,
  LORE_CATEGORIES,
  PARTICIPANT_ROLES,
} from "./catalog";
import { DATE_PRECISIONS, MAX_DAYS, MAX_MONTHS, validateDateOrder } from "./chronology";

/** Shared Zod schemas. Used by server actions (authoritative) and client forms (UX). */

const id = z.string().min(1).max(64);
const shortText = (max = 200) => z.string().trim().max(max);
const longText = (max = 20000) => z.string().max(max);
const optionalYear = z.number().int().min(-1_000_000).max(1_000_000).nullable().optional();
const stringList = z.array(z.string().trim().min(1).max(200)).max(50).default([]);

// ── Calendar & universe settings ──

export const calendarSchema = z.object({
  yearLabel: shortText(30).default("Year"),
  eraSuffix: shortText(20).default(""),
  negativeEraSuffix: shortText(30).default("before reckoning"),
  monthNames: z.array(shortText(30).min(1)).max(MAX_MONTHS).default([]),
  eras: z.array(z.object({ name: shortText(80).min(1), startYear: z.number().int() })).max(50).default([]),
  currentYear: z.number().int().nullable().optional(),
});

export const CONSISTENCY_RULES = [
  "EVENT_ENDS_BEFORE_START",
  "PREREQUISITE_AFTER_EVENT",
  "PARTICIPANT_DEAD",
  "PARTICIPANT_NOT_BORN",
  "TRAVEL_CONFLICT",
  "EXCLUSIVE_OVERLAP",
  "RELATIONSHIP_OUT_OF_LIFETIME",
  "DEPENDENCY_CYCLE",
  "DUPLICATE_RELATIONSHIP",
] as const;
export type ConsistencyRule = (typeof CONSISTENCY_RULES)[number];

export const universeSettingsSchema = z.object({
  rules: z
    .record(z.enum(CONSISTENCY_RULES), z.boolean())
    .default({} as Record<ConsistencyRule, boolean>),
  /** Minimum days a character needs between two distinct locations (travel constraint). */
  minTravelDays: z.number().int().min(0).max(3650).default(0),
  aiEnabled: z.boolean().default(true),
});
export type UniverseSettings = z.infer<typeof universeSettingsSchema>;

export function parseSettings(raw: unknown): UniverseSettings {
  const r = universeSettingsSchema.safeParse(raw ?? {});
  return r.success ? r.data : universeSettingsSchema.parse({});
}

export function ruleEnabled(settings: UniverseSettings, rule: ConsistencyRule): boolean {
  return settings.rules[rule] ?? true;
}

export const universeCreateSchema = z.object({
  name: shortText(120).min(2, "Give your universe a name of at least 2 characters."),
  genre: z.enum(GENRES),
  customGenre: shortText(60).optional(),
  startMethod: z.enum(["BLANK", "TEMPLATE", "AI"]).default("BLANK"),
  description: longText(4000).default(""),
  mainConflict: shortText(1000).optional(),
  timePeriod: shortText(200).optional(),
  tone: shortText(200).optional(),
  coreRules: longText(4000).optional(),
});
export type UniverseCreateInput = z.infer<typeof universeCreateSchema>;

export const universeUpdateSchema = z.object({
  name: shortText(120).min(2),
  description: longText(4000).default(""),
  genre: z.enum(GENRES),
  customGenre: shortText(60).nullable().optional(),
  tone: shortText(200).nullable().optional(),
  mainConflict: shortText(1000).nullable().optional(),
  timePeriod: shortText(200).nullable().optional(),
  coreRules: longText(4000).nullable().optional(),
  currentEra: shortText(120).nullable().optional(),
  coverImage: shortText(500).nullable().optional(),
  defaultTimelineId: id.nullable().optional(),
});

// ── Entity attributes (type-specific, validated) ──

export const characterAttributesSchema = z.object({
  aliases: stringList,
  species: shortText(120).optional(),
  gender: shortText(60).optional(),
  occupation: shortText(160).optional(),
  birthDateLabel: shortText(120).optional(),
  personality: longText(4000).optional(),
  motivations: stringList,
  fears: stringList,
  strengths: stringList,
  flaws: stringList,
  beliefs: stringList,
  values: stringList,
  backstory: longText(20000).optional(),
  goals: longText(4000).optional(),
  internalConflict: longText(4000).optional(),
  externalConflict: longText(4000).optional(),
  arc: longText(4000).optional(),
  secrets: longText(4000).optional(),
  turningPoints: stringList,
  role: shortText(80).optional(),
});

export const factionAttributesSchema = z.object({
  emblem: shortText(200).optional(),
  ideology: longText(4000).optional(),
  government: shortText(200).optional(),
  resources: stringList,
  militaryStrength: shortText(200).optional(),
  internalDivisions: longText(4000).optional(),
  reputation: longText(2000).optional(),
  secretObjectives: longText(4000).optional(),
  kind: shortText(80).optional(),
});

export const locationAttributesSchema = z.object({
  category: shortText(80).optional(),
  climate: shortText(120).optional(),
  population: shortText(120).optional(),
  notableFeatures: stringList,
});

export const artifactAttributesSchema = z.object({
  material: shortText(120).optional(),
  powers: longText(4000).optional(),
  origin: longText(4000).optional(),
});

export const genericAttributesSchema = z.object({
  notes: longText(8000).optional(),
  properties: z.array(z.object({ key: shortText(80).min(1), value: shortText(500) })).max(40).default([]),
});

export const ATTRIBUTE_SCHEMAS = {
  CHARACTER: characterAttributesSchema,
  FACTION: factionAttributesSchema,
  LOCATION: locationAttributesSchema,
  ARTIFACT: artifactAttributesSchema,
  SPECIES: genericAttributesSchema,
  CREATURE: genericAttributesSchema,
  CULTURE: genericAttributesSchema,
  RELIGION: genericAttributesSchema,
  LANGUAGE: genericAttributesSchema,
  TECHNOLOGY: genericAttributesSchema,
  MAGIC_SYSTEM: genericAttributesSchema,
  CUSTOM: genericAttributesSchema,
} as const;

export type CharacterAttributes = z.infer<typeof characterAttributesSchema>;
export type FactionAttributes = z.infer<typeof factionAttributesSchema>;
export type LocationAttributes = z.infer<typeof locationAttributesSchema>;
export type ArtifactAttributes = z.infer<typeof artifactAttributesSchema>;
export type GenericAttributes = z.infer<typeof genericAttributesSchema>;

export function parseAttributes(type: keyof typeof ATTRIBUTE_SCHEMAS, raw: unknown) {
  return ATTRIBUTE_SCHEMAS[type].parse(raw ?? {});
}

/** Lenient parse used when reading stored data: falls back to defaults rather than throwing. */
export function readAttributes<T extends keyof typeof ATTRIBUTE_SCHEMAS>(
  type: T,
  raw: unknown,
): z.infer<(typeof ATTRIBUTE_SCHEMAS)[T]> {
  const schema = ATTRIBUTE_SCHEMAS[type];
  const r = schema.safeParse(raw ?? {});
  return (r.success ? r.data : schema.parse({})) as z.infer<(typeof ATTRIBUTE_SCHEMAS)[T]>;
}

export const entityInputSchema = z
  .object({
    type: z.enum(ENTITY_TYPES),
    customTypeLabel: shortText(60).nullable().optional(),
    name: shortText(160).min(1, "Name is required."),
    summary: shortText(600).default(""),
    description: longText(20000).default(""),
    status: shortText(40).default("UNKNOWN"),
    beginYear: optionalYear,
    endYear: optionalYear,
    portrait: shortText(500).nullable().optional(),
    canonStatus: z.enum(CANON_STATUSES).default("CANON"),
    attributes: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((v, ctx) => {
    if (v.beginYear != null && v.endYear != null && v.endYear < v.beginYear) {
      ctx.addIssue({ code: "custom", path: ["endYear"], message: "End year cannot be before the begin year." });
    }
    const r = ATTRIBUTE_SCHEMAS[v.type].safeParse(v.attributes);
    if (!r.success) {
      for (const issue of r.error.issues) {
        ctx.addIssue({ code: "custom", path: ["attributes", ...issue.path.map(String)], message: issue.message });
      }
    }
  });
export type EntityInput = z.input<typeof entityInputSchema>;

// ── Relationships ──

export const relationshipTypeKey = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[A-Z][A-Z0-9_]*$/, "Relationship types use UPPER_SNAKE_CASE.");

export const relationshipInputSchema = z
  .object({
    sourceId: id,
    targetId: id,
    type: relationshipTypeKey,
    description: shortText(2000).default(""),
    validFromYear: optionalYear,
    validToYear: optionalYear,
    originEventId: id.nullable().optional(),
    endEventId: id.nullable().optional(),
    canonStatus: z.enum(CANON_STATUSES).default("CANON"),
  })
  .superRefine((v, ctx) => {
    if (v.validFromYear != null && v.validToYear != null && v.validToYear < v.validFromYear) {
      ctx.addIssue({ code: "custom", path: ["validToYear"], message: "A relationship cannot end before it begins." });
    }
  });
export type RelationshipInput = z.input<typeof relationshipInputSchema>;

export const isBuiltinRelationship = (t: string) => (BUILTIN_RELATIONSHIP_KEYS as string[]).includes(t);

// ── Events ──

const month = z.number().int().min(1).max(MAX_MONTHS).nullable().optional();
const day = z.number().int().min(1).max(MAX_DAYS).nullable().optional();

export const eventBaseSchema = z.object({
  title: shortText(200).min(1, "Title is required."),
  description: longText(20000).default(""),
  eventType: shortText(40).default("OTHER"),
  startYear: z.number().int().min(-1_000_000).max(1_000_000),
  startMonth: month,
  startDay: day,
  endYear: optionalYear,
  endMonth: month,
  endDay: day,
  precision: z.enum(DATE_PRECISIONS).default("YEAR"),
  displayDate: shortText(120).nullable().optional(),
  importance: z.number().int().min(1).max(5).default(3),
  locationId: id.nullable().optional(),
  canonStatus: z.enum(CANON_STATUSES).default("CANON"),
});

export const eventInputSchema = eventBaseSchema
  .extend({
    participants: z
      .array(z.object({ entityId: id, role: z.enum(PARTICIPANT_ROLES), note: shortText(500).nullable().optional() }))
      .max(200)
      .default([]),
  })
  .superRefine((v, ctx) => {
    const err = validateDateOrder(v);
    if (err) ctx.addIssue({ code: "custom", path: ["endYear"], message: err });
    if (v.startDay != null && v.startMonth == null) {
      ctx.addIssue({ code: "custom", path: ["startMonth"], message: "A day requires a month." });
    }
  });
export type EventInput = z.input<typeof eventInputSchema>;

/** Patch of an event used by the Living World Engine. */
export const eventPatchSchema = eventBaseSchema
  .pick({
    title: true,
    description: true,
    eventType: true,
    startYear: true,
    startMonth: true,
    startDay: true,
    endYear: true,
    endMonth: true,
    endDay: true,
    precision: true,
    locationId: true,
    canonStatus: true,
    importance: true,
  })
  .partial()
  .extend({ cancelled: z.boolean().optional() })
  .refine((p) => Object.keys(p).length > 0, "Propose at least one change.");
export type EventPatch = z.infer<typeof eventPatchSchema>;

export const dependencyInputSchema = z
  .object({
    sourceId: id,
    targetId: id,
    type: z.enum(DEPENDENCY_TYPES),
    note: shortText(500).nullable().optional(),
  })
  .refine((v) => v.sourceId !== v.targetId, { message: "An event cannot depend on itself.", path: ["targetId"] });

// ── Lore ──

export const loreInputSchema = z.object({
  title: shortText(200).min(1, "Title is required."),
  body: longText(200_000).default(""),
  category: z.enum(LORE_CATEGORIES).default("HISTORY"),
  tags: z.array(shortText(40).min(1)).max(30).default([]),
  canonStatus: z.enum(CANON_STATUSES).default("CANON"),
  entityIds: z.array(id).max(100).default([]),
  eventIds: z.array(id).max(100).default([]),
});
export type LoreInput = z.input<typeof loreInputSchema>;

// ── Timelines ──

export const branchCreateSchema = z.object({
  name: shortText(120).min(2, "Name the branch."),
  description: shortText(2000).default(""),
  parentId: id,
  branchEventId: id.nullable().optional(),
});

// ── Auth ──

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200, "Password is too long.");

export const signupSchema = z.object({
  name: shortText(80).min(1, "Tell us what to call you."),
  email: emailSchema,
  password: passwordSchema,
});
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(200),
});

export const memberRoleSchema = z.enum(["OWNER", "EDITOR", "VIEWER"]);

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(["EDITOR", "VIEWER"]),
});
