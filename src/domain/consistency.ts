import { BUILTIN_RELATIONSHIP_TYPES, DEPENDENCY_META, relationshipMeta } from "./catalog";
import { endOrdinal, eventSpan, formatYear, ordinalYear, type CalendarConfig, DEFAULT_CALENDAR } from "./chronology";
import { findCycles } from "./graph";
import { ruleEnabled, type ConsistencyRule, type UniverseSettings } from "./schemas";
import { WorldIndex, type RecordRef, type WEvent, type WorldSnapshot, type WRelationship } from "./world";

export type Severity = "ERROR" | "WARNING";

export interface Finding {
  /** Stable key so findings can be compared before/after a change. */
  key: string;
  rule: ConsistencyRule;
  severity: Severity;
  title: string;
  explanation: string;
  refs: RecordRef[];
}

export const RULE_DESCRIPTIONS: Record<ConsistencyRule, { title: string; description: string }> = {
  EVENT_ENDS_BEFORE_START: { title: "Event ends before it starts", description: "An event's end date precedes its start date." },
  PREREQUISITE_AFTER_EVENT: { title: "Prerequisite occurs later", description: "An event that causes, enables or precedes another is dated after it." },
  PARTICIPANT_DEAD: { title: "Participant already dead", description: "A character or faction takes part in an event after their recorded death or dissolution." },
  PARTICIPANT_NOT_BORN: { title: "Participant not yet born", description: "A character or faction takes part in an event before their birth or founding." },
  TRAVEL_CONFLICT: { title: "Travel conflict", description: "A character is recorded at two different places closer in time than the minimum travel time allows." },
  EXCLUSIVE_OVERLAP: { title: "Overlapping exclusive role", description: "Two different rulers or controllers hold the same exclusive role over the same target at the same time." },
  RELATIONSHIP_OUT_OF_LIFETIME: { title: "Relationship outside lifetime", description: "A relationship is dated when one of its parties did not exist." },
  DEPENDENCY_CYCLE: { title: "Circular dependency", description: "Events depend on each other in a loop, so no chronological order can satisfy them." },
  DUPLICATE_RELATIONSHIP: { title: "Duplicate relationship", description: "The same relationship is recorded twice for overlapping periods." },
};

const LIFESPAN_TYPES = new Set(["CHARACTER", "FACTION", "CREATURE"]);

/** Strict overlap: sharing a boundary year (e.g. a succession year) is not an overlap. */
function overlapsStrict(aFrom: number | null, aTo: number | null, bFrom: number | null, bTo: number | null): boolean {
  const af = aFrom ?? -Infinity;
  const at = aTo ?? Infinity;
  const bf = bFrom ?? -Infinity;
  const bt = bTo ?? Infinity;
  return af < bt && bf < at;
}

function overlaps(aFrom: number | null, aTo: number | null, bFrom: number | null, bTo: number | null): boolean {
  const af = aFrom ?? -Infinity;
  const at = aTo ?? Infinity;
  const bf = bFrom ?? -Infinity;
  const bt = bTo ?? Infinity;
  return af <= bt && bf <= at;
}

export function checkConsistency(
  snapshot: WorldSnapshot,
  settings: UniverseSettings,
  cal: CalendarConfig = DEFAULT_CALENDAR,
): Finding[] {
  const idx = new WorldIndex(snapshot);
  const findings: Finding[] = [];
  const on = (r: ConsistencyRule) => ruleEnabled(settings, r);
  const yr = (y: number) => formatYear(y, cal);

  if (on("EVENT_ENDS_BEFORE_START")) {
    for (const ev of snapshot.events) {
      if (ev.endOrdinal != null && ev.endOrdinal < ev.startOrdinal) {
        findings.push({
          key: `EVENT_ENDS_BEFORE_START:${ev.id}`,
          rule: "EVENT_ENDS_BEFORE_START",
          severity: "ERROR",
          title: `“${ev.title}” ends before it starts`,
          explanation: `It starts in ${yr(ev.startYear)} but ends in ${yr(ev.endYear ?? ev.startYear)}.`,
          refs: [idx.eventRef(ev.id)],
        });
      }
    }
  }

  if (on("PREREQUISITE_AFTER_EVENT")) {
    for (const d of snapshot.dependencies) {
      if (!DEPENDENCY_META[d.type].requiresOrder) continue;
      const src = idx.events.get(d.sourceId);
      const tgt = idx.events.get(d.targetId);
      if (!src || !tgt) continue;
      if (startsAfterAtPrecision(src, tgt)) {
        findings.push({
          key: `PREREQUISITE_AFTER_EVENT:${d.id}`,
          rule: "PREREQUISITE_AFTER_EVENT",
          severity: "WARNING",
          title: `“${src.title}” is dated after the event it ${DEPENDENCY_META[d.type].label.toLowerCase()}`,
          explanation: `“${src.title}” (${yr(src.startYear)}) is recorded as ${DEPENDENCY_META[d.type].label.toLowerCase()} “${tgt.title}” (${yr(tgt.startYear)}), but begins later.`,
          refs: [idx.eventRef(src.id), idx.eventRef(tgt.id)],
        });
      }
    }
  }

  if (on("PARTICIPANT_DEAD") || on("PARTICIPANT_NOT_BORN")) {
    for (const p of snapshot.participants) {
      const ent = idx.entities.get(p.entityId);
      const ev = idx.events.get(p.eventId);
      if (!ent || !ev || !LIFESPAN_TYPES.has(ent.type)) continue;
      const [s, e] = eventSpan(ev);
      const startYear = ordinalYear(s);
      const endYear = ordinalYear(e);
      if (on("PARTICIPANT_DEAD") && ent.endYear != null) {
        // A victim may die during the event itself (same year); nobody can take part after their end year.
        if (startYear > ent.endYear) {
          const verb = ent.type === "FACTION" ? "dissolved" : "died";
          findings.push({
            key: `PARTICIPANT_DEAD:${ev.id}:${ent.id}`,
            rule: "PARTICIPANT_DEAD",
            severity: "ERROR",
            title: `${ent.name} takes part in “${ev.title}” after they ${verb}`,
            explanation: `${ent.name} ${verb} in ${yr(ent.endYear)}, but is recorded as ${p.role.toLowerCase()} in “${ev.title}” (${yr(startYear)}).`,
            refs: [idx.entityRef(ent.id), idx.eventRef(ev.id)],
          });
        }
      }
      if (on("PARTICIPANT_NOT_BORN") && ent.beginYear != null && endYear < ent.beginYear && p.role !== "VICTIM") {
        const verb = ent.type === "FACTION" ? "was founded" : "was born";
        findings.push({
          key: `PARTICIPANT_NOT_BORN:${ev.id}:${ent.id}`,
          rule: "PARTICIPANT_NOT_BORN",
          severity: "ERROR",
          title: `${ent.name} takes part in “${ev.title}” before they ${verb.replace("was ", "were ")}`,
          explanation: `${ent.name} ${verb} in ${yr(ent.beginYear)}, but “${ev.title}” ends in ${yr(endYear)}.`,
          refs: [idx.entityRef(ent.id), idx.eventRef(ev.id)],
        });
      }
    }
  }

  if (on("TRAVEL_CONFLICT")) {
    for (const [entityId, parts] of idx.participantsByEntity) {
      const ent = idx.entities.get(entityId);
      if (!ent || ent.type !== "CHARACTER") continue;
      const located = parts
        .map((p) => idx.events.get(p.eventId))
        // Only day-precise events can establish where someone was on a given day.
        .filter((e): e is WEvent => !!e && !!e.locationId && e.precision === "DAY")
        .sort((a, b) => a.startOrdinal - b.startOrdinal);
      for (let i = 0; i < located.length; i++) {
        for (let j = i + 1; j < located.length; j++) {
          const a = located[i];
          const b = located[j];
          if (a.locationId === b.locationId) continue;
          const [, aE] = eventSpan(a);
          const [bS] = eventSpan(b);
          const gap = bS - aE; // approximate days
          const overlapping = bS <= aE;
          if (overlapping || (settings.minTravelDays > 0 && gap < settings.minTravelDays)) {
            const la = idx.entities.get(a.locationId!)?.name ?? "one place";
            const lb = idx.entities.get(b.locationId!)?.name ?? "another";
            findings.push({
              key: `TRAVEL_CONFLICT:${ent.id}:${a.id}:${b.id}`,
              rule: "TRAVEL_CONFLICT",
              severity: "WARNING",
              title: `${ent.name} cannot be in ${la} and ${lb} in time`,
              explanation: overlapping
                ? `“${a.title}” and “${b.title}” overlap but take place in different locations.`
                : `Only about ${gap} day(s) separate “${a.title}” and “${b.title}”; the universe requires at least ${settings.minTravelDays}.`,
              refs: [idx.entityRef(ent.id), idx.eventRef(a.id), idx.eventRef(b.id)],
            });
          }
        }
      }
    }
  }

  if (on("EXCLUSIVE_OVERLAP")) {
    const byKey = new Map<string, WRelationship[]>();
    for (const r of snapshot.relationships) {
      const meta = BUILTIN_RELATIONSHIP_TYPES[r.type as keyof typeof BUILTIN_RELATIONSHIP_TYPES];
      if (!meta || !("exclusiveTarget" in meta) || !meta.exclusiveTarget) continue;
      const key = `${r.type}:${r.targetId}`;
      byKey.set(key, [...(byKey.get(key) ?? []), r]);
    }
    for (const rels of byKey.values()) {
      for (let i = 0; i < rels.length; i++) {
        for (let j = i + 1; j < rels.length; j++) {
          const a = rels[i];
          const b = rels[j];
          if (a.sourceId === b.sourceId) continue;
          if (!overlapsStrict(a.validFromYear, a.validToYear, b.validFromYear, b.validToYear)) continue;
          const target = idx.entities.get(a.targetId)?.name ?? "the same target";
          const na = idx.entities.get(a.sourceId)?.name ?? "?";
          const nb = idx.entities.get(b.sourceId)?.name ?? "?";
          const verb = relationshipMeta(a.type).label.toLowerCase();
          findings.push({
            key: `EXCLUSIVE_OVERLAP:${[a.id, b.id].sort().join(":")}`,
            rule: "EXCLUSIVE_OVERLAP",
            severity: "WARNING",
            title: `${na} and ${nb} both ${verb.replace(/s$/, "")} ${target} at once`,
            explanation: `${na} (${periodLabel(a, yr)}) and ${nb} (${periodLabel(b, yr)}) hold the exclusive “${verb}” role over ${target} in overlapping periods. Record a succession or adjust the dates.`,
            refs: [idx.relRef(a), idx.relRef(b), idx.entityRef(a.targetId)],
          });
        }
      }
    }
  }

  if (on("RELATIONSHIP_OUT_OF_LIFETIME")) {
    for (const r of snapshot.relationships) {
      for (const endId of [r.sourceId, r.targetId]) {
        const ent = idx.entities.get(endId);
        if (!ent || !LIFESPAN_TYPES.has(ent.type)) continue;
        // A relationship with a dead person (e.g. "successor of") can legitimately start after death,
        // so only flag relationships that *begin* after death for lineage-neutral active types.
        const startsAfterEnd = ent.endYear != null && r.validFromYear != null && r.validFromYear > ent.endYear;
        const endsBeforeBegin = ent.beginYear != null && r.validToYear != null && r.validToYear < ent.beginYear;
        const activeType = !["SUCCESSOR_OF", "RELATED_TO", "PARENT_OF", "SIBLING_OF", "WORSHIPS", "CREATED"].includes(r.type);
        if ((startsAfterEnd && activeType) || endsBeforeBegin) {
          findings.push({
            key: `RELATIONSHIP_OUT_OF_LIFETIME:${r.id}:${ent.id}`,
            rule: "RELATIONSHIP_OUT_OF_LIFETIME",
            severity: "WARNING",
            title: `${ent.name}'s “${relationshipMeta(r.type).label.toLowerCase()}” relationship is outside their lifetime`,
            explanation: startsAfterEnd
              ? `The relationship begins in ${yr(r.validFromYear!)}, after ${ent.name}'s end in ${yr(ent.endYear!)}.`
              : `The relationship ends in ${yr(r.validToYear!)}, before ${ent.name} existed (${yr(ent.beginYear!)}).`,
            refs: [idx.relRef(r), idx.entityRef(ent.id)],
          });
        }
      }
    }
  }

  if (on("DEPENDENCY_CYCLE")) {
    const ordered = snapshot.dependencies.filter((d) => DEPENDENCY_META[d.type].requiresOrder);
    const cycles = findCycles(
      snapshot.events.map((e) => e.id),
      ordered.map((d) => ({ source: d.sourceId, target: d.targetId })),
    );
    for (const cycle of cycles) {
      findings.push({
        key: `DEPENDENCY_CYCLE:${[...cycle].sort().join(":")}`,
        rule: "DEPENDENCY_CYCLE",
        severity: "ERROR",
        title: "Events depend on each other in a loop",
        explanation: `${cycle.map((id) => `“${idx.events.get(id)?.title ?? id}”`).join(" → ")} form a cycle of causes or prerequisites.`,
        refs: cycle.map((id) => idx.eventRef(id)),
      });
    }
  }

  if (on("DUPLICATE_RELATIONSHIP")) {
    const seen = new Map<string, WRelationship[]>();
    for (const r of snapshot.relationships) {
      const meta = relationshipMeta(r.type);
      const pair = meta.symmetric ? [r.sourceId, r.targetId].sort().join(":") : `${r.sourceId}:${r.targetId}`;
      const key = `${r.type}:${pair}`;
      seen.set(key, [...(seen.get(key) ?? []), r]);
    }
    for (const rels of seen.values()) {
      for (let i = 0; i < rels.length; i++) {
        for (let j = i + 1; j < rels.length; j++) {
          const a = rels[i];
          const b = rels[j];
          if (!overlaps(a.validFromYear, a.validToYear, b.validFromYear, b.validToYear)) continue;
          findings.push({
            key: `DUPLICATE_RELATIONSHIP:${[a.id, b.id].sort().join(":")}`,
            rule: "DUPLICATE_RELATIONSHIP",
            severity: "WARNING",
            title: "Duplicate relationship",
            explanation: `${idx.relRef(a).label} is recorded twice with overlapping periods.`,
            refs: [idx.relRef(a), idx.relRef(b)],
          });
        }
      }
    }
  }

  return findings.sort((a, b) => (a.severity === b.severity ? a.key.localeCompare(b.key) : a.severity === "ERROR" ? -1 : 1));
}

/**
 * Whether `src` starts after `tgt`, judged at the coarser precision of the target's start
 * (a cause on the 3rd of a month does not contradict an effect dated only to that month).
 */
export function startsAfterAtPrecision(
  src: { startOrdinal: number },
  tgt: { startYear: number; startMonth: number | null; startDay: number | null },
): boolean {
  return src.startOrdinal > endOrdinal({ year: tgt.startYear, month: tgt.startMonth, day: tgt.startDay });
}

function periodLabel(r: WRelationship, yr: (y: number) => string): string {
  const from = r.validFromYear != null ? yr(r.validFromYear) : "the beginning";
  const to = r.validToYear != null ? yr(r.validToYear) : "the present";
  return `${from} – ${to}`;
}

// ── Relationship creation validation ──

export interface RelationshipCandidate {
  sourceId: string;
  targetId: string;
  type: string;
  validFromYear?: number | null;
  validToYear?: number | null;
}

export function validateRelationshipCandidate(
  candidate: RelationshipCandidate,
  source: { id: string; type: string; name: string } | undefined,
  target: { id: string; type: string; name: string } | undefined,
  existing: WRelationship[],
  ignoreId?: string,
): string[] {
  const errors: string[] = [];
  if (!source || !target) {
    errors.push("Both ends of the relationship must exist in this universe.");
    return errors;
  }
  if (candidate.sourceId === candidate.targetId) errors.push("An entity cannot have a relationship with itself.");
  const meta = BUILTIN_RELATIONSHIP_TYPES[candidate.type as keyof typeof BUILTIN_RELATIONSHIP_TYPES] as
    | (typeof BUILTIN_RELATIONSHIP_TYPES)[keyof typeof BUILTIN_RELATIONSHIP_TYPES]
    | undefined;
  if (meta) {
    const allowedSource = meta.source as readonly string[] | null;
    const allowedTarget = meta.target as readonly string[] | null;
    if (allowedSource && !allowedSource.includes(source.type)) {
      errors.push(`“${meta.label}” cannot start from a ${source.type.toLowerCase().replace("_", " ")}.`);
    }
    if (allowedTarget && !allowedTarget.includes(target.type)) {
      errors.push(`“${meta.label}” cannot point to a ${target.type.toLowerCase().replace("_", " ")}.`);
    }
  }
  const symmetric = meta?.symmetric ?? false;
  const dup = existing.find(
    (r) =>
      r.id !== ignoreId &&
      r.type === candidate.type &&
      ((r.sourceId === candidate.sourceId && r.targetId === candidate.targetId) ||
        (symmetric && r.sourceId === candidate.targetId && r.targetId === candidate.sourceId)) &&
      overlaps(r.validFromYear, r.validToYear, candidate.validFromYear ?? null, candidate.validToYear ?? null),
  );
  if (dup) errors.push(`${source.name} already has an active “${meta?.label ?? candidate.type}” relationship with ${target.name} in that period.`);
  return errors;
}
