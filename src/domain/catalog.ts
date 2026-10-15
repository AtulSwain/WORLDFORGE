/** Shared, presentation-independent catalogs of domain vocabulary. */

export const ENTITY_TYPES = [
  "CHARACTER",
  "FACTION",
  "LOCATION",
  "ARTIFACT",
  "SPECIES",
  "CREATURE",
  "CULTURE",
  "RELIGION",
  "LANGUAGE",
  "TECHNOLOGY",
  "MAGIC_SYSTEM",
  "CUSTOM",
] as const;
export type EntityTypeKey = (typeof ENTITY_TYPES)[number];

export const ENTITY_TYPE_META: Record<EntityTypeKey, { label: string; plural: string; route: string | null }> = {
  CHARACTER: { label: "Character", plural: "Characters", route: "characters" },
  FACTION: { label: "Faction", plural: "Factions", route: "factions" },
  LOCATION: { label: "Location", plural: "Locations", route: "locations" },
  ARTIFACT: { label: "Artifact", plural: "Artifacts", route: "artifacts" },
  SPECIES: { label: "Species", plural: "Species", route: "entities" },
  CREATURE: { label: "Creature", plural: "Creatures", route: "entities" },
  CULTURE: { label: "Culture", plural: "Cultures", route: "entities" },
  RELIGION: { label: "Religion", plural: "Religions", route: "entities" },
  LANGUAGE: { label: "Language", plural: "Languages", route: "entities" },
  TECHNOLOGY: { label: "Technology", plural: "Technologies", route: "entities" },
  MAGIC_SYSTEM: { label: "Magic system", plural: "Magic systems", route: "entities" },
  CUSTOM: { label: "Custom", plural: "Custom entities", route: "entities" },
};

export function entityHref(worldId: string, type: EntityTypeKey, id: string): string {
  const route = ENTITY_TYPE_META[type].route ?? "entities";
  return `/worlds/${worldId}/${route}/${id}`;
}

export const ENTITY_STATUSES: Record<EntityTypeKey, string[]> = {
  CHARACTER: ["ALIVE", "DECEASED", "MISSING", "UNKNOWN"],
  FACTION: ["ACTIVE", "DORMANT", "DISSOLVED", "UNKNOWN"],
  LOCATION: ["INHABITED", "ABANDONED", "DESTROYED", "UNKNOWN"],
  ARTIFACT: ["INTACT", "LOST", "DESTROYED", "UNKNOWN"],
  SPECIES: ["EXTANT", "ENDANGERED", "EXTINCT", "UNKNOWN"],
  CREATURE: ["EXTANT", "EXTINCT", "UNKNOWN"],
  CULTURE: ["ACTIVE", "DECLINING", "EXTINCT", "UNKNOWN"],
  RELIGION: ["ACTIVE", "SUPPRESSED", "EXTINCT", "UNKNOWN"],
  LANGUAGE: ["SPOKEN", "LITURGICAL", "DEAD", "UNKNOWN"],
  TECHNOLOGY: ["IN_USE", "EXPERIMENTAL", "LOST", "UNKNOWN"],
  MAGIC_SYSTEM: ["ACTIVE", "WANING", "LOST", "UNKNOWN"],
  CUSTOM: ["ACTIVE", "INACTIVE", "UNKNOWN"],
};

/** Statuses meaning the entity no longer exists / acts in the world. */
export const TERMINAL_STATUSES = new Set(["DECEASED", "DISSOLVED", "DESTROYED", "EXTINCT", "DEAD", "LOST"]);

export interface RelationshipTypeMeta {
  label: string;
  /** Phrase used when reading the relationship from the target's perspective. */
  inverseLabel: string;
  symmetric: boolean;
  /** Allowed source entity types (null = any). */
  source: EntityTypeKey[] | null;
  /** Allowed target entity types (null = any). */
  target: EntityTypeKey[] | null;
  /** At most one active relationship of this type per target at a time (e.g. one ruler). */
  exclusiveTarget?: boolean;
  category: "personal" | "political" | "spatial" | "ownership" | "lineage";
}

export const BUILTIN_RELATIONSHIP_TYPES = {
  ALLY_OF: { label: "Ally of", inverseLabel: "Ally of", symmetric: true, source: null, target: null, category: "political" },
  ENEMY_OF: { label: "Enemy of", inverseLabel: "Enemy of", symmetric: true, source: null, target: null, category: "political" },
  MEMBER_OF: { label: "Member of", inverseLabel: "Has member", symmetric: false, source: ["CHARACTER", "FACTION"], target: ["FACTION", "RELIGION", "CULTURE"], category: "political" },
  RULES: { label: "Rules", inverseLabel: "Ruled by", symmetric: false, source: ["CHARACTER", "FACTION"], target: ["FACTION", "LOCATION"], exclusiveTarget: true, category: "political" },
  LOCATED_IN: { label: "Located in", inverseLabel: "Contains", symmetric: false, source: null, target: ["LOCATION"], category: "spatial" },
  BORN_IN: { label: "Born in", inverseLabel: "Birthplace of", symmetric: false, source: ["CHARACTER", "CREATURE"], target: ["LOCATION"], category: "spatial" },
  RELATED_TO: { label: "Related to", inverseLabel: "Related to", symmetric: true, source: ["CHARACTER"], target: ["CHARACTER"], category: "lineage" },
  PARENT_OF: { label: "Parent of", inverseLabel: "Child of", symmetric: false, source: ["CHARACTER"], target: ["CHARACTER"], category: "lineage" },
  SIBLING_OF: { label: "Sibling of", inverseLabel: "Sibling of", symmetric: true, source: ["CHARACTER"], target: ["CHARACTER"], category: "lineage" },
  MARRIED_TO: { label: "Married to", inverseLabel: "Married to", symmetric: true, source: ["CHARACTER"], target: ["CHARACTER"], category: "personal" },
  FRIEND_OF: { label: "Friend of", inverseLabel: "Friend of", symmetric: true, source: ["CHARACTER"], target: ["CHARACTER"], category: "personal" },
  RIVAL_OF: { label: "Rival of", inverseLabel: "Rival of", symmetric: true, source: null, target: null, category: "personal" },
  MENTORS: { label: "Mentors", inverseLabel: "Mentored by", symmetric: false, source: ["CHARACTER"], target: ["CHARACTER"], category: "personal" },
  BETRAYS: { label: "Betrays", inverseLabel: "Betrayed by", symmetric: false, source: ["CHARACTER", "FACTION"], target: ["CHARACTER", "FACTION"], category: "personal" },
  OWNS: { label: "Owns", inverseLabel: "Owned by", symmetric: false, source: ["CHARACTER", "FACTION"], target: ["ARTIFACT", "LOCATION", "TECHNOLOGY"], category: "ownership" },
  CREATED: { label: "Created", inverseLabel: "Created by", symmetric: false, source: ["CHARACTER", "FACTION", "CULTURE"], target: null, category: "ownership" },
  CONTROLS: { label: "Controls", inverseLabel: "Controlled by", symmetric: false, source: ["CHARACTER", "FACTION"], target: ["LOCATION", "ARTIFACT", "TECHNOLOGY"], exclusiveTarget: true, category: "political" },
  WORSHIPS: { label: "Worships", inverseLabel: "Worshipped by", symmetric: false, source: ["CHARACTER", "FACTION", "CULTURE"], target: null, category: "personal" },
  SUCCESSOR_OF: { label: "Successor of", inverseLabel: "Succeeded by", symmetric: false, source: ["CHARACTER", "FACTION"], target: ["CHARACTER", "FACTION"], category: "lineage" },
  PRACTICES: { label: "Practices", inverseLabel: "Practised by", symmetric: false, source: ["CHARACTER", "FACTION", "CULTURE"], target: ["MAGIC_SYSTEM", "RELIGION", "TECHNOLOGY", "LANGUAGE"], category: "personal" },
} satisfies Record<string, RelationshipTypeMeta>;

export type BuiltinRelationshipType = keyof typeof BUILTIN_RELATIONSHIP_TYPES;
export const BUILTIN_RELATIONSHIP_KEYS = Object.keys(BUILTIN_RELATIONSHIP_TYPES) as BuiltinRelationshipType[];

export function relationshipMeta(type: string, custom: { key: string; label: string; inverse?: string | null }[] = []): RelationshipTypeMeta {
  if (type in BUILTIN_RELATIONSHIP_TYPES) return BUILTIN_RELATIONSHIP_TYPES[type as BuiltinRelationshipType];
  const def = custom.find((c) => c.key === type);
  return {
    label: def?.label ?? humanize(type),
    inverseLabel: def?.inverse ?? def?.label ?? humanize(type),
    symmetric: false,
    source: null,
    target: null,
    category: "personal",
  };
}

export function humanize(key: string): string {
  const s = key.toLowerCase().replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const EVENT_TYPES = [
  "BATTLE",
  "WAR",
  "TREATY",
  "ALLIANCE",
  "BIRTH",
  "DEATH",
  "ASSASSINATION",
  "CORONATION",
  "SUCCESSION",
  "FOUNDING",
  "DISSOLUTION",
  "DISCOVERY",
  "DISASTER",
  "CEREMONY",
  "POLITICAL",
  "MIGRATION",
  "BETRAYAL",
  "OTHER",
] as const;
export type EventTypeKey = (typeof EVENT_TYPES)[number];

export const PARTICIPANT_ROLES = [
  "PROTAGONIST",
  "ANTAGONIST",
  "VICTIM",
  "INSTIGATOR",
  "WITNESS",
  "COMMANDER",
  "ALLY",
  "OBSERVER",
  "SIGNATORY",
  "PARTICIPANT",
] as const;
export type ParticipantRoleKey = (typeof PARTICIPANT_ROLES)[number];

/** Roles that require the participant to be alive/active at the event. Victims may die *at* the event. */
export const ACTIVE_ROLES = new Set<ParticipantRoleKey>([
  "PROTAGONIST",
  "ANTAGONIST",
  "INSTIGATOR",
  "WITNESS",
  "COMMANDER",
  "ALLY",
  "OBSERVER",
  "SIGNATORY",
  "PARTICIPANT",
]);

export const DEPENDENCY_TYPES = ["CAUSES", "ENABLES", "PREVENTS", "PRECEDES", "CONTRIBUTES_TO"] as const;
export type DependencyTypeKey = (typeof DEPENDENCY_TYPES)[number];

export const DEPENDENCY_META: Record<DependencyTypeKey, { label: string; inverseLabel: string; requiresOrder: boolean }> = {
  CAUSES: { label: "Causes", inverseLabel: "Caused by", requiresOrder: true },
  ENABLES: { label: "Enables", inverseLabel: "Requires (prerequisite)", requiresOrder: true },
  PREVENTS: { label: "Prevents", inverseLabel: "Prevented by", requiresOrder: false },
  PRECEDES: { label: "Occurs before", inverseLabel: "Occurs after", requiresOrder: true },
  CONTRIBUTES_TO: { label: "Contributes to", inverseLabel: "Contributed to by", requiresOrder: true },
};

export const LORE_CATEGORIES = [
  "MYTHOLOGY",
  "HISTORY",
  "MAGIC_SYSTEMS",
  "TECHNOLOGY",
  "RELIGION",
  "LANGUAGES",
  "SPECIES",
  "CREATURES",
  "CULTURES",
  "POLITICAL_SYSTEMS",
  "LAWS",
  "ECONOMICS",
  "ARTIFACTS",
  "CUSTOMS",
  "GEOGRAPHY",
  "CUSTOM",
] as const;
export type LoreCategoryKey = (typeof LORE_CATEGORIES)[number];

export const GENRES = [
  "HIGH_FANTASY",
  "DARK_FANTASY",
  "SCIENCE_FICTION",
  "POST_APOCALYPTIC",
  "HISTORICAL_FICTION",
  "MYTHOLOGY",
  "SUPERHERO",
  "HORROR",
  "CONTEMPORARY",
  "CUSTOM",
] as const;
export type GenreKey = (typeof GENRES)[number];

export const GENRE_LABELS: Record<GenreKey, string> = {
  HIGH_FANTASY: "High fantasy",
  DARK_FANTASY: "Dark fantasy",
  SCIENCE_FICTION: "Science fiction",
  POST_APOCALYPTIC: "Post-apocalyptic",
  HISTORICAL_FICTION: "Historical fiction",
  MYTHOLOGY: "Mythology",
  SUPERHERO: "Superhero",
  HORROR: "Horror",
  CONTEMPORARY: "Contemporary fiction",
  CUSTOM: "Custom",
};

export const CANON_STATUSES = ["CANON", "DRAFT", "DISPUTED", "NON_CANON"] as const;
export type CanonStatusKey = (typeof CANON_STATUSES)[number];
