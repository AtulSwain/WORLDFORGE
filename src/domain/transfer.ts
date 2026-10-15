import { z } from "zod";
import { GENRES } from "./catalog";
import { isBuiltinRelationship } from "./schemas";

/**
 * WorldForge universe export format (version 1).
 *
 * A single JSON document, `universe.json`, holds everything needed to recreate a universe:
 * timelines (including alternate branches and their overlay changes), entities, relationships,
 * events with participants, causal dependencies, lore, maps and an asset manifest. Record IDs
 * are only meaningful inside the file: on import every ID is replaced with a fresh one and all
 * references are rewritten, so a file can be imported any number of times.
 *
 * Not included: revision history, proposals, AI suggestions, activity, members and the binary
 * contents of uploaded assets (the manifest lists them so they can be re-uploaded).
 */
export const EXPORT_FORMAT = "worldforge.universe";
export const EXPORT_VERSION = 1;

const idStr = z.string().min(1).max(64);
const nullableId = idStr.nullable().optional().default(null);
const int = z.number().int();
const nInt = int.nullable().optional().default(null);
const text = (max: number) => z.string().max(max);
const canon = z.enum(["CANON", "DRAFT", "DISPUTED", "NON_CANON"]);
const isoDate = z.string().max(40).nullable().optional().default(null);

const timelineSchema = z.object({
  id: idStr,
  name: text(200).min(1),
  description: text(4000).default(""),
  isMain: z.boolean(),
  parentId: nullableId,
  branchEventId: nullableId,
  status: z.enum(["ACTIVE", "ARCHIVED"]).default("ACTIVE"),
});

const entitySchema = z.object({
  id: idStr,
  timelineId: idStr,
  type: z.enum(["CHARACTER", "FACTION", "LOCATION", "ARTIFACT", "SPECIES", "CREATURE", "CULTURE", "RELIGION", "LANGUAGE", "TECHNOLOGY", "MAGIC_SYSTEM", "CUSTOM"]),
  customTypeLabel: text(60).nullable().optional().default(null),
  name: text(200).min(1),
  slug: text(220).min(1),
  summary: text(2000).default(""),
  description: text(50000).default(""),
  status: text(60).default("UNKNOWN"),
  beginYear: nInt,
  endYear: nInt,
  portrait: text(500).nullable().optional().default(null),
  attributes: z.record(z.string(), z.unknown()).default({}),
  canonStatus: canon.default("CANON"),
  archivedAt: isoDate,
});

const relationshipSchema = z.object({
  id: idStr,
  timelineId: idStr,
  sourceId: idStr,
  targetId: idStr,
  type: text(60).min(1),
  description: text(4000).default(""),
  validFromYear: nInt,
  validToYear: nInt,
  originEventId: nullableId,
  endEventId: nullableId,
  canonStatus: canon.default("CANON"),
  archivedAt: isoDate,
});

const participantSchema = z.object({
  entityId: idStr,
  role: z.enum(["PROTAGONIST", "ANTAGONIST", "VICTIM", "INSTIGATOR", "WITNESS", "COMMANDER", "ALLY", "OBSERVER", "SIGNATORY", "PARTICIPANT"]).default("PARTICIPANT"),
  note: text(500).nullable().optional().default(null),
});

const eventSchema = z.object({
  id: idStr,
  timelineId: idStr,
  title: text(300).min(1),
  slug: text(320).min(1),
  description: text(50000).default(""),
  eventType: text(60).default("OTHER"),
  startYear: int,
  startMonth: nInt,
  startDay: nInt,
  endYear: nInt,
  endMonth: nInt,
  endDay: nInt,
  precision: z.enum(["DAY", "MONTH", "YEAR", "CIRCA", "DECADE", "CENTURY", "ERA"]).default("YEAR"),
  displayDate: text(120).nullable().optional().default(null),
  importance: int.min(1).max(5).default(3),
  locationId: nullableId,
  canonStatus: canon.default("CANON"),
  archivedAt: isoDate,
  participants: z.array(participantSchema).max(500).default([]),
});

const dependencySchema = z.object({
  id: idStr,
  timelineId: idStr,
  sourceId: idStr,
  targetId: idStr,
  type: z.enum(["CAUSES", "ENABLES", "PREVENTS", "PRECEDES", "CONTRIBUTES_TO"]),
  note: text(1000).nullable().optional().default(null),
});

const changeSchema = z.object({
  id: idStr,
  timelineId: idStr,
  targetType: z.enum(["ENTITY", "EVENT", "RELATIONSHIP"]),
  targetId: idStr,
  changeType: z.enum(["CREATE", "UPDATE", "DELETE"]),
  previousState: z.unknown().optional().default(null),
  proposedState: z.unknown().optional().default(null),
  sourceEventId: nullableId,
  reason: text(4000).default(""),
});

const loreSchema = z.object({
  id: idStr,
  title: text(300).min(1),
  slug: text(320).min(1),
  body: text(200000).default(""),
  category: text(60).default("HISTORY"),
  tags: z.array(text(60)).max(50).default([]),
  canonStatus: canon.default("CANON"),
  archivedAt: isoDate,
  links: z.array(z.object({ entityId: nullableId, eventId: nullableId })).max(500).default([]),
});

const point = z.tuple([z.number(), z.number()]);
const mapSchema = z.object({
  id: idStr,
  title: text(200).min(1),
  mapType: text(30).default("IMAGE"),
  coordinateSystem: text(30).default("IMAGE_PIXELS"),
  imageSource: text(500),
  width: int.min(1).max(100000),
  height: int.min(1).max(100000),
  layerConfig: z.unknown().optional().default({}),
  defaultViewport: z.unknown().optional().default({}),
  isDefault: z.boolean().default(false),
  placements: z.array(z.object({ entityId: idStr, x: z.number(), y: z.number() })).max(5000).default([]),
  routes: z.array(z.object({ name: text(200), kind: text(30).default("ROAD"), points: z.array(point).max(2000) })).max(1000).default([]),
  regions: z.array(z.object({ name: text(200), factionId: nullableId, color: text(20).default("#D6BD8D"), polygon: z.array(point).max(2000) })).max(1000).default([]),
});

const assetManifestSchema = z.object({
  id: idStr,
  kind: text(30),
  filename: text(300),
  mimeType: text(100),
  sizeBytes: int.min(0),
  altText: text(1000).default(""),
});

export const exportSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.string().max(40).optional(),
  universe: z.object({
    name: text(120).min(2),
    description: text(4000).default(""),
    genre: z.enum(GENRES).catch("CUSTOM"),
    customGenre: text(60).nullable().optional().default(null),
    tone: text(200).nullable().optional().default(null),
    mainConflict: text(1000).nullable().optional().default(null),
    timePeriod: text(200).nullable().optional().default(null),
    coreRules: text(4000).nullable().optional().default(null),
    currentEra: text(120).nullable().optional().default(null),
    calendar: z.unknown().optional().default({}),
    settings: z.unknown().optional().default({}),
    defaultTimelineId: nullableId,
  }),
  timelines: z.array(timelineSchema).min(1).max(200),
  relationshipTypes: z.array(z.object({ key: text(60).min(1), label: text(60).min(1), inverse: text(60).nullable().optional().default(null) })).max(200).default([]),
  entities: z.array(entitySchema).max(20000).default([]),
  relationships: z.array(relationshipSchema).max(50000).default([]),
  events: z.array(eventSchema).max(20000).default([]),
  dependencies: z.array(dependencySchema).max(50000).default([]),
  changes: z.array(changeSchema).max(50000).default([]),
  lore: z.array(loreSchema).max(10000).default([]),
  maps: z.array(mapSchema).max(100).default([]),
  assets: z.array(assetManifestSchema).max(10000).default([]),
});
export type UniverseExport = z.infer<typeof exportSchema>;
export type UniverseExportInput = z.input<typeof exportSchema>;

export interface ImportIssue {
  path: string;
  message: string;
}

export type ValidationResult = { ok: true; data: UniverseExport } | { ok: false; issues: ImportIssue[] };

const MAX_ISSUES = 50;

/** Validates structure, format version, duplicate IDs and every cross-reference. Pure. */
export function validateExport(raw: unknown): ValidationResult {
  if (typeof raw !== "object" || raw === null) return { ok: false, issues: [{ path: "", message: "The file is not a JSON object." }] };
  const head = raw as { format?: unknown; version?: unknown };
  if (head.format !== EXPORT_FORMAT) {
    return { ok: false, issues: [{ path: "format", message: `Not a WorldForge universe export (expected format "${EXPORT_FORMAT}").` }] };
  }
  if (head.version !== EXPORT_VERSION) {
    return {
      ok: false,
      issues: [{ path: "version", message: `Unsupported export version ${JSON.stringify(head.version)}. This WorldForge reads version ${EXPORT_VERSION}.` }],
    };
  }
  const parsed = exportSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.slice(0, MAX_ISSUES).map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  }
  const data = parsed.data;
  const issues: ImportIssue[] = [];
  const push = (path: string, message: string) => {
    if (issues.length < MAX_ISSUES) issues.push({ path, message });
  };

  // Duplicate IDs anywhere in the file.
  const seen = new Map<string, string>();
  const register = (path: string, id: string) => {
    const prev = seen.get(id);
    if (prev) push(path, `Duplicate ID "${id}" (also used at ${prev}).`);
    else seen.set(id, path);
  };
  data.timelines.forEach((t, i) => register(`timelines.${i}`, t.id));
  data.entities.forEach((e, i) => register(`entities.${i}`, e.id));
  data.relationships.forEach((r, i) => register(`relationships.${i}`, r.id));
  data.events.forEach((e, i) => register(`events.${i}`, e.id));
  data.dependencies.forEach((d, i) => register(`dependencies.${i}`, d.id));
  data.changes.forEach((c, i) => register(`changes.${i}`, c.id));
  data.lore.forEach((d, i) => register(`lore.${i}`, d.id));
  data.maps.forEach((m, i) => register(`maps.${i}`, m.id));
  data.assets.forEach((a, i) => register(`assets.${i}`, a.id));

  const timelines = new Set(data.timelines.map((t) => t.id));
  const entities = new Map(data.entities.map((e) => [e.id, e]));
  const events = new Set(data.events.map((e) => e.id));
  const relationships = new Set(data.relationships.map((r) => r.id));
  const customTypes = new Set(data.relationshipTypes.map((t) => t.key));
  const ref = (path: string, value: string | null, set: { has(v: string): boolean }, what: string) => {
    if (value != null && !set.has(value)) push(path, `References a missing ${what} "${value}".`);
  };

  const mains = data.timelines.filter((t) => t.isMain);
  if (mains.length !== 1) push("timelines", `Exactly one main (canon) timeline is required; found ${mains.length}.`);
  data.timelines.forEach((t, i) => {
    ref(`timelines.${i}.parentId`, t.parentId, timelines, "timeline");
    ref(`timelines.${i}.branchEventId`, t.branchEventId, events, "event");
    if (t.isMain && t.parentId) push(`timelines.${i}.parentId`, "The main timeline cannot have a parent.");
    if (!t.isMain && !t.parentId) push(`timelines.${i}.parentId`, "Alternate timelines must name the timeline they branch from.");
  });
  // Parent chains must terminate (no cycles).
  const parentOf = new Map(data.timelines.map((t) => [t.id, t.parentId]));
  for (const t of data.timelines) {
    const visited = new Set<string>();
    let cur: string | null | undefined = t.id;
    while (cur) {
      if (visited.has(cur)) {
        push(`timelines`, `Timeline "${t.name}" has a cyclic parent chain.`);
        break;
      }
      visited.add(cur);
      cur = parentOf.get(cur);
    }
  }
  ref("universe.defaultTimelineId", data.universe.defaultTimelineId, timelines, "timeline");

  const slugs = (rows: { slug: string }[], path: string) => {
    const s = new Set<string>();
    rows.forEach((r, i) => {
      if (s.has(r.slug)) push(`${path}.${i}.slug`, `Duplicate slug "${r.slug}".`);
      s.add(r.slug);
    });
  };
  slugs(data.entities, "entities");
  slugs(data.events, "events");
  slugs(data.lore, "lore");

  data.entities.forEach((e, i) => ref(`entities.${i}.timelineId`, e.timelineId, timelines, "timeline"));
  data.relationships.forEach((r, i) => {
    ref(`relationships.${i}.timelineId`, r.timelineId, timelines, "timeline");
    ref(`relationships.${i}.sourceId`, r.sourceId, entities, "entity");
    ref(`relationships.${i}.targetId`, r.targetId, entities, "entity");
    ref(`relationships.${i}.originEventId`, r.originEventId, events, "event");
    ref(`relationships.${i}.endEventId`, r.endEventId, events, "event");
    if (!isBuiltinRelationship(r.type) && !customTypes.has(r.type)) push(`relationships.${i}.type`, `Unknown relationship type "${r.type}".`);
  });
  data.events.forEach((e, i) => {
    ref(`events.${i}.timelineId`, e.timelineId, timelines, "timeline");
    ref(`events.${i}.locationId`, e.locationId, entities, "entity");
    if (e.locationId && entities.has(e.locationId) && entities.get(e.locationId)!.type !== "LOCATION") {
      push(`events.${i}.locationId`, "An event's location must be a location entity.");
    }
    e.participants.forEach((p, j) => ref(`events.${i}.participants.${j}.entityId`, p.entityId, entities, "entity"));
  });
  data.dependencies.forEach((d, i) => {
    ref(`dependencies.${i}.timelineId`, d.timelineId, timelines, "timeline");
    ref(`dependencies.${i}.sourceId`, d.sourceId, events, "event");
    ref(`dependencies.${i}.targetId`, d.targetId, events, "event");
    if (d.sourceId === d.targetId) push(`dependencies.${i}`, "An event cannot depend on itself.");
  });
  data.changes.forEach((c, i) => {
    ref(`changes.${i}.timelineId`, c.timelineId, timelines, "timeline");
    const set = c.targetType === "ENTITY" ? entities : c.targetType === "EVENT" ? events : relationships;
    ref(`changes.${i}.targetId`, c.targetId, set, c.targetType.toLowerCase());
    ref(`changes.${i}.sourceEventId`, c.sourceEventId, events, "event");
  });
  data.lore.forEach((d, i) =>
    d.links.forEach((l, j) => {
      ref(`lore.${i}.links.${j}.entityId`, l.entityId, entities, "entity");
      ref(`lore.${i}.links.${j}.eventId`, l.eventId, events, "event");
      if (!l.entityId && !l.eventId) push(`lore.${i}.links.${j}`, "A lore link must point at an entity or an event.");
    }),
  );
  data.maps.forEach((m, i) => {
    m.placements.forEach((p, j) => ref(`maps.${i}.placements.${j}.entityId`, p.entityId, entities, "entity"));
    m.regions.forEach((r, j) => ref(`maps.${i}.regions.${j}.factionId`, r.factionId, entities, "entity"));
  });

  return issues.length ? { ok: false, issues } : { ok: true, data };
}

/** Replaces every string that exactly equals a known ID, at any depth. Used to re-key an import. */
export function remapIds<T>(value: T, ids: ReadonlyMap<string, string>): T {
  if (typeof value === "string") return (ids.get(value) ?? value) as T;
  if (Array.isArray(value)) return value.map((v) => remapIds(v, ids)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = remapIds(v, ids);
    return out as T;
  }
  return value;
}

/** Every record ID declared in an export (the keys that get replaced on import). */
export function declaredIds(data: UniverseExport): string[] {
  return [
    ...data.timelines,
    ...data.entities,
    ...data.relationships,
    ...data.events,
    ...data.dependencies,
    ...data.changes,
    ...data.lore,
    ...data.maps,
    ...data.assets,
  ].map((r) => r.id);
}

// ── Flat projections used in the zip export ──

export function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  // Neutralise spreadsheet formula injection and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
