import { BUILTIN_RELATIONSHIP_TYPES, DEPENDENCY_META, relationshipMeta, type DependencyTypeKey } from "./catalog";
import { DEFAULT_CALENDAR, formatEventDate, formatYear, type CalendarConfig } from "./chronology";
import { checkConsistency, startsAfterAtPrecision, type Finding } from "./consistency";
import { boundedBfs, pathTo } from "./graph";
import type { EventPatch, UniverseSettings } from "./schemas";
import { applyEventPatch, type FieldDiff } from "./timeline-resolution";
import { WorldIndex, type RecordKind, type RecordRef, type WEntity, type WEvent, type WorldSnapshot, type WRelationship } from "./world";

/**
 * Living World Engine — deterministic impact analysis.
 *
 * Given a proposed modification to one event, the engine walks explicit structure
 * (causal dependencies, participants, relationships established/ended by the event,
 * lifespans, exclusive roles, lore links) within fixed bounds and produces reviewable
 * impact items. It never claims certainty about fiction: every item states its basis
 * and a qualitative strength, and concrete changes are only *suggested*.
 * Identical input always yields identical output.
 */

export const IMPACT_CATEGORIES = [
  "DIRECT",
  "CONTRADICTION",
  "DEPENDENT_EVENT",
  "CHARACTER",
  "POLITICAL",
  "GEOGRAPHIC",
  "NARRATIVE",
  "POTENTIAL",
  "AI",
] as const;
export type ImpactCategory = (typeof IMPACT_CATEGORIES)[number];

export const IMPACT_CATEGORY_LABELS: Record<ImpactCategory, string> = {
  DIRECT: "Directly affected",
  CONTRADICTION: "Contradictions",
  DEPENDENT_EVENT: "Dependent events",
  CHARACTER: "Character changes",
  POLITICAL: "Political changes",
  GEOGRAPHIC: "Geographic changes",
  NARRATIVE: "Narrative references",
  POTENTIAL: "Potentially affected",
  AI: "AI-generated possibilities",
};

export type ImpactBasis =
  | "PRIMARY_CHANGE"
  | "EXPLICIT_DEPENDENCY"
  | "DETERMINISTIC_RULE"
  | "EXISTING_RELATIONSHIP"
  | "AI_INFERENCE"
  | "UNVERIFIED";

export const BASIS_LABELS: Record<ImpactBasis, string> = {
  PRIMARY_CHANGE: "Proposed change",
  EXPLICIT_DEPENDENCY: "Explicit dependency",
  DETERMINISTIC_RULE: "Deterministic rule",
  EXISTING_RELATIONSHIP: "Existing relationship",
  AI_INFERENCE: "AI inference",
  UNVERIFIED: "Unverified suggestion",
};

/** Qualitative strength — deliberately not a probability. */
export type ImpactStrength = "DIRECT" | "LIKELY" | "POSSIBLE" | "QUESTION";

export interface SuggestedChange {
  targetType: RecordKind;
  targetId: string;
  changeType: "UPDATE" | "DELETE";
  patch: Record<string, unknown>;
}

export interface EvidenceRef extends RecordRef {
  note?: string;
}

export interface ImpactDraft {
  key: string;
  category: ImpactCategory;
  title: string;
  description: string;
  basis: ImpactBasis;
  strength: ImpactStrength;
  affected: RecordRef[];
  evidence: EvidenceRef[];
  suggestedChange: SuggestedChange | null;
}

export interface ImpactReport {
  sourceEventId: string;
  cancelled: boolean;
  original: WEvent;
  modified: WEvent | null;
  fieldChanges: FieldDiff[];
  items: ImpactDraft[];
  newFindings: Finding[];
  resolvedFindings: Finding[];
  stats: { eventsTraversed: number; entitiesTouched: number; depthLimit: number; truncated: boolean };
}

export interface ImpactOptions {
  settings: UniverseSettings;
  calendar?: CalendarConfig;
  maxDepth?: number;
  maxNodes?: number;
  maxItems?: number;
}

const STRENGTH_ORDER: Record<ImpactStrength, number> = { DIRECT: 0, LIKELY: 1, QUESTION: 2, POSSIBLE: 3 };
const DEATH_EVENT_TYPES = new Set(["DEATH", "ASSASSINATION"]);
const ORDERED_FORWARD: DependencyTypeKey[] = ["CAUSES", "ENABLES", "PRECEDES", "CONTRIBUTES_TO", "PREVENTS"];

export class ImpactError extends Error {}

export function analyzeImpact(
  snapshot: WorldSnapshot,
  sourceEventId: string,
  rawPatch: EventPatch,
  opts: ImpactOptions,
): ImpactReport {
  const cal = opts.calendar ?? DEFAULT_CALENDAR;
  const maxDepth = Math.min(Math.max(opts.maxDepth ?? 3, 1), 6);
  const maxNodes = opts.maxNodes ?? 300;
  const maxItems = opts.maxItems ?? 200;
  const yr = (y: number) => formatYear(y, cal);

  const idx = new WorldIndex(snapshot);
  const original = idx.events.get(sourceEventId);
  if (!original) throw new ImpactError("The selected event is not part of this timeline.");

  const { cancelled = false, ...patch } = rawPatch;
  const modified = cancelled ? null : applyEventPatch(original, patch);
  const fieldChanges: FieldDiff[] = modified
    ? Object.keys(patch)
        .filter((k) => JSON.stringify((original as unknown as Record<string, unknown>)[k]) !== JSON.stringify((modified as unknown as Record<string, unknown>)[k]))
        .map((k) => ({
          field: k,
          before: (original as unknown as Record<string, unknown>)[k],
          after: (modified as unknown as Record<string, unknown>)[k],
        }))
    : [{ field: "exists", before: true, after: false }];

  if (!cancelled && fieldChanges.length === 0) {
    throw new ImpactError("The proposed values are identical to the current event.");
  }

  const items = new Map<string, ImpactDraft>();
  const add = (item: ImpactDraft) => {
    const existing = items.get(item.key);
    if (!existing || STRENGTH_ORDER[item.strength] < STRENGTH_ORDER[existing.strength]) items.set(item.key, item);
  };

  const dateChanged = !!modified && fieldChanges.some((f) => f.field.startsWith("start") || f.field.startsWith("end"));
  const deltaYears = modified ? modified.startYear - original.startYear : 0;
  const newYear = modified?.startYear ?? original.startYear;
  const evRef = idx.eventRef(original.id);
  const originalDate = formatEventDate(original, cal);
  const modifiedDate = modified ? formatEventDate({ ...modified, displayDate: null }, cal) : null;

  // ── 1. The primary change ──
  add({
    key: `primary:${original.id}`,
    category: "DIRECT",
    title: cancelled ? `“${original.title}” no longer happens` : `“${original.title}” is modified`,
    description: cancelled
      ? `In this timeline the event is removed from history (originally ${originalDate}).`
      : fieldChanges.map((f) => `${f.field}: ${fmt(f.before)} → ${fmt(f.after)}`).join("; ") +
        (dateChanged ? ` (${originalDate} → ${modifiedDate})` : ""),
    basis: "PRIMARY_CHANGE",
    strength: "DIRECT",
    affected: [evRef],
    evidence: [],
    suggestedChange: {
      targetType: "EVENT",
      targetId: original.id,
      changeType: cancelled ? "DELETE" : "UPDATE",
      patch: cancelled ? {} : patch,
    },
  });

  // Hypothetical world: primary change plus deterministic lifespan / dating consequences.
  const hypoEntities = new Map(snapshot.entities.map((e) => [e.id, { ...e }]));
  const hypoRels = new Map(snapshot.relationships.map((r) => [r.id, { ...r }]));
  const participants = idx.participantsByEvent.get(original.id) ?? [];

  // ── 2. Death / assassination: victims' lifespans ──
  const isDeath = DEATH_EVENT_TYPES.has(original.eventType);
  const victims = isDeath
    ? participants
        .filter((p) => p.role === "VICTIM")
        .map((p) => idx.entities.get(p.entityId))
        .filter((e): e is WEntity => !!e && (e.type === "CHARACTER" || e.type === "CREATURE"))
    : [];

  for (const victim of victims) {
    const vRef = idx.entityRef(victim.id);
    if (cancelled) {
      if (victim.endYear === original.startYear) {
        add({
          key: `victim-survives:${victim.id}`,
          category: "CHARACTER",
          title: `${victim.name} may survive`,
          description: `${victim.name}'s recorded death in ${yr(victim.endYear)} comes from this event. Without it, ${victim.name} may still be alive.`,
          basis: "DETERMINISTIC_RULE",
          strength: "LIKELY",
          affected: [vRef],
          evidence: [{ ...evRef, note: "Victim of the removed event" }],
          suggestedChange: { targetType: "ENTITY", targetId: victim.id, changeType: "UPDATE", patch: { status: "ALIVE", endYear: null } },
        });
        hypoEntities.set(victim.id, { ...victim, status: "ALIVE", endYear: null });
      }
    } else if (dateChanged && victim.endYear !== newYear) {
      add({
        key: `victim-death:${victim.id}`,
        category: "CHARACTER",
        title: `${victim.name} now dies in ${yr(newYear)}`,
        description: `${victim.name} is the victim of “${original.title}”. Their recorded death (${victim.endYear != null ? yr(victim.endYear) : "unrecorded"}) should follow the event.`,
        basis: "DETERMINISTIC_RULE",
        strength: "DIRECT",
        affected: [vRef],
        evidence: [{ ...evRef, note: "Victim participant" }],
        suggestedChange: { targetType: "ENTITY", targetId: victim.id, changeType: "UPDATE", patch: { status: "DECEASED", endYear: newYear } },
      });
      hypoEntities.set(victim.id, { ...victim, status: "DECEASED", endYear: newYear });

      // Relationships the victim holds beyond the new death year.
      for (const rel of idx.relsByEntity.get(victim.id) ?? []) {
        const meta = relationshipMeta(rel.type);
        if (["SUCCESSOR_OF", "PARENT_OF", "SIBLING_OF", "RELATED_TO", "CREATED", "BORN_IN"].includes(rel.type)) continue;
        // Relationships established or ended by this very event are handled in section 3.
        if (rel.originEventId === original.id || rel.endEventId === original.id) continue;
        const political = meta.category === "political";
        const category = political ? "POLITICAL" : "CHARACTER";
        if (rel.validFromYear != null && rel.validFromYear > newYear) {
          add({
            key: `rel-after-death:${rel.id}`,
            category,
            title: `${idx.relRef(rel).label} would begin after ${victim.name}'s death`,
            description: `This relationship starts in ${yr(rel.validFromYear)}, after ${victim.name} dies in ${yr(newYear)}. It may never form.`,
            basis: "DETERMINISTIC_RULE",
            strength: "LIKELY",
            affected: [idx.relRef(rel)],
            evidence: [vRef],
            suggestedChange: { targetType: "RELATIONSHIP", targetId: rel.id, changeType: "UPDATE", patch: { canonStatus: "DISPUTED" } },
          });
        } else if (rel.validToYear == null || rel.validToYear > newYear) {
          add({
            key: `rel-ends:${rel.id}`,
            category,
            title: `${idx.relRef(rel).label} ends in ${yr(newYear)}`,
            description: `${victim.name} can no longer sustain this relationship after their death.`,
            basis: "EXISTING_RELATIONSHIP",
            strength: "LIKELY",
            affected: [idx.relRef(rel)],
            evidence: [vRef],
            suggestedChange: { targetType: "RELATIONSHIP", targetId: rel.id, changeType: "UPDATE", patch: { validToYear: newYear } },
          });
        }
      }
    }

    // Succession questions for anything the victim rules or controls.
    for (const rel of (idx.relsByEntity.get(victim.id) ?? []).filter(
      (r) => r.sourceId === victim.id && (r.type === "RULES" || r.type === "CONTROLS"),
    )) {
      const realm = idx.entities.get(rel.targetId);
      if (!realm) continue;
      const successors = (idx.relsByEntity.get(victim.id) ?? [])
        .filter((r) => r.type === "SUCCESSOR_OF" && r.targetId === victim.id)
        .map((r) => idx.entityRef(r.sourceId));
      const otherRulers = (idx.relsByEntity.get(realm.id) ?? [])
        .filter((r) => r.type === rel.type && r.targetId === realm.id && r.sourceId !== victim.id)
        .map((r) => ({ ...idx.relRef(r), note: periodNote(r, yr) }));
      add({
        key: `succession:${realm.id}`,
        category: "POLITICAL",
        title: `Who ${rel.type === "RULES" ? "inherits the rule of" : "takes control of"} ${realm.name}?`,
        description: cancelled
          ? `${victim.name} ${rel.type === "RULES" ? "rules" : "controls"} ${realm.name}. If ${victim.name} survives, the recorded succession may not take place.`
          : `${victim.name} ${rel.type === "RULES" ? "rules" : "controls"} ${realm.name}. The succession now happens in ${yr(newYear)}.`,
        basis: "EXISTING_RELATIONSHIP",
        strength: "QUESTION",
        affected: [idx.entityRef(realm.id), idx.relRef(rel)],
        evidence: [...successors.map((s) => ({ ...s, note: "Recorded successor" })), ...otherRulers],
        suggestedChange: null,
      });
      // Alliances and enmities of the realm may shift with the succession.
      const pivotYear = cancelled ? original.startYear : newYear;
      for (const ally of (idx.relsByEntity.get(realm.id) ?? []).filter(
        (r) => (r.type === "ALLY_OF" || r.type === "ENEMY_OF") && (r.validToYear == null || r.validToYear >= pivotYear),
      )) {
        const a = idx.entities.get(ally.sourceId)?.name ?? "?";
        const b = idx.entities.get(ally.targetId)?.name ?? "?";
        add({
          key: `realm-alliance:${ally.id}`,
          category: "POLITICAL",
          title: `Does the succession change the ${ally.type === "ALLY_OF" ? "alliance" : "enmity"} between ${a} and ${b}?`,
          description: `${realm.name}'s ${relationshipMeta(ally.type).label.toLowerCase()} relationship was recorded under the previous order of succession.`,
          basis: "EXISTING_RELATIONSHIP",
          strength: "POSSIBLE",
          affected: [idx.relRef(ally)],
          evidence: [idx.relRef(rel)],
          suggestedChange: null,
        });
      }
    }
  }

  // ── 3. Relationships established or ended by this event ──
  for (const rel of idx.relsByOriginEvent.get(original.id) ?? []) {
    const political = relationshipMeta(rel.type).category === "political";
    if (cancelled) {
      add({
        key: `origin-gone:${rel.id}`,
        category: political ? "POLITICAL" : "CHARACTER",
        title: `${idx.relRef(rel).label} may never form`,
        description: `This relationship was established by “${original.title}”.`,
        basis: "EXPLICIT_DEPENDENCY",
        strength: "LIKELY",
        affected: [idx.relRef(rel)],
        evidence: [{ ...evRef, note: "Established by" }],
        suggestedChange: { targetType: "RELATIONSHIP", targetId: rel.id, changeType: "UPDATE", patch: { canonStatus: "DISPUTED" } },
      });
    } else if (dateChanged && rel.validFromYear !== newYear) {
      hypoRels.set(rel.id, { ...rel, validFromYear: newYear });
      add({
        key: `origin-date:${rel.id}`,
        category: political ? "POLITICAL" : "CHARACTER",
        title: `${idx.relRef(rel).label} now begins in ${yr(newYear)}`,
        description: `It was established by “${original.title}”, which moves from ${originalDate} to ${modifiedDate}.`,
        basis: "EXPLICIT_DEPENDENCY",
        strength: "DIRECT",
        affected: [idx.relRef(rel)],
        evidence: [{ ...evRef, note: "Established by" }],
        suggestedChange: { targetType: "RELATIONSHIP", targetId: rel.id, changeType: "UPDATE", patch: { validFromYear: newYear } },
      });
    }
  }
  for (const rel of idx.relsByEndEvent.get(original.id) ?? []) {
    // A relationship that would now end before it began is a lifetime contradiction, reported below.
    if (!cancelled && rel.validFromYear != null && rel.validFromYear > newYear) continue;
    if (!cancelled) hypoRels.set(rel.id, { ...rel, validToYear: newYear });
    const political = relationshipMeta(rel.type).category === "political";
    add({
      key: `end-${cancelled ? "gone" : "date"}:${rel.id}`,
      category: political ? "POLITICAL" : "CHARACTER",
      title: cancelled ? `${idx.relRef(rel).label} may continue` : `${idx.relRef(rel).label} now ends in ${yr(newYear)}`,
      description: `This relationship was ended by “${original.title}”.`,
      basis: "EXPLICIT_DEPENDENCY",
      strength: cancelled ? "POSSIBLE" : "DIRECT",
      affected: [idx.relRef(rel)],
      evidence: [{ ...evRef, note: "Ended by" }],
      suggestedChange:
        cancelled || rel.validToYear !== newYear
          ? { targetType: "RELATIONSHIP", targetId: rel.id, changeType: "UPDATE", patch: { validToYear: cancelled ? null : newYear } }
          : null,
    });
  }

  // ── 4. Causal dependency traversal (bounded) ──
  const traversal = boundedBfs(
    [original.id],
    (id) => (idx.depsOut.get(id) ?? []).filter((d) => ORDERED_FORWARD.includes(d.type)).map((d) => d.targetId),
    maxDepth,
    maxNodes,
  );
  for (const [eventId, depth] of traversal.depth) {
    if (depth === 0) continue;
    const target = idx.events.get(eventId);
    if (!target) continue;
    const path = pathTo(traversal.parent, eventId);
    const parentId = path[path.length - 2];
    const edge = (idx.depsOut.get(parentId) ?? []).find((d) => d.targetId === eventId)!;
    const pathEvidence: EvidenceRef[] = path.slice(0, -1).map((id, i) => {
      const e = (idx.depsOut.get(id) ?? []).find((d) => d.targetId === path[i + 1]);
      return { ...idx.eventRef(id), note: e ? DEPENDENCY_META[e.type].label : undefined };
    });
    const tRef = idx.eventRef(target.id);
    const otherCauses = (idx.depsIn.get(target.id) ?? []).filter(
      (d) => d.sourceId !== parentId && (d.type === "CAUSES" || d.type === "ENABLES"),
    ).length;
    const shift =
      deltaYears !== 0
        ? { startYear: target.startYear + deltaYears, endYear: target.endYear != null ? target.endYear + deltaYears : null }
        : null;

    if (depth === 1) {
      if (cancelled) {
        if (edge.type === "PREVENTS") {
          add({
            key: `dep:${target.id}`,
            category: "DEPENDENT_EVENT",
            title: `Could “${target.title}” now happen?`,
            description: `“${original.title}” prevented it. With the event gone, nothing recorded stops it.`,
            basis: "EXPLICIT_DEPENDENCY",
            strength: "QUESTION",
            affected: [tRef],
            evidence: pathEvidence,
            suggestedChange: null,
          });
        } else {
          add({
            key: `dep:${target.id}`,
            category: "DEPENDENT_EVENT",
            title: `Does “${target.title}” still happen?`,
            description:
              otherCauses > 0
                ? `It ${DEPENDENCY_META[edge.type].inverseLabel.toLowerCase()} “${original.title}”, but ${otherCauses} other recorded cause(s) may still lead to it.`
                : `It ${DEPENDENCY_META[edge.type].inverseLabel.toLowerCase()} “${original.title}” and has no other recorded cause.`,
            basis: "EXPLICIT_DEPENDENCY",
            strength: otherCauses > 0 ? "POSSIBLE" : "LIKELY",
            affected: [tRef],
            evidence: pathEvidence,
            suggestedChange: { targetType: "EVENT", targetId: target.id, changeType: "UPDATE", patch: { canonStatus: "DISPUTED" } },
          });
        }
      } else if (modified && dateChanged) {
        const violates = DEPENDENCY_META[edge.type].requiresOrder && startsAfterAtPrecision(modified, target);
        add({
          key: `dep:${target.id}`,
          category: "DEPENDENT_EVENT",
          title: violates
            ? `“${target.title}” would now happen before its ${edge.type === "CAUSES" ? "cause" : "prerequisite"}`
            : `Review the timing of “${target.title}”`,
          description: violates
            ? `“${original.title}” moves to ${modifiedDate}, after “${target.title}” (${formatEventDate(target, cal)}).`
            : `It ${DEPENDENCY_META[edge.type].inverseLabel.toLowerCase()} “${original.title}”, which moves by ${deltaYears >= 0 ? "+" : ""}${deltaYears} year(s).`,
          basis: violates ? "DETERMINISTIC_RULE" : "EXPLICIT_DEPENDENCY",
          strength: violates ? "LIKELY" : edge.type === "CAUSES" ? "POSSIBLE" : "QUESTION",
          affected: [tRef],
          evidence: pathEvidence,
          suggestedChange: shift && (violates || edge.type === "CAUSES") ? { targetType: "EVENT", targetId: target.id, changeType: "UPDATE", patch: shift } : null,
        });
      } else {
        add({
          key: `dep:${target.id}`,
          category: "DEPENDENT_EVENT",
          title: `“${target.title}” depends on this event`,
          description: `It ${DEPENDENCY_META[edge.type].inverseLabel.toLowerCase()} “${original.title}”. Review whether the change alters it.`,
          basis: "EXPLICIT_DEPENDENCY",
          strength: "POSSIBLE",
          affected: [tRef],
          evidence: pathEvidence,
          suggestedChange: null,
        });
      }
    } else {
      add({
        key: `dep:${target.id}`,
        category: "POTENTIAL",
        title: `“${target.title}” is ${depth} steps downstream`,
        description: `Linked through ${path.map((id) => `“${idx.events.get(id)?.title ?? "?"}”`).join(" → ")}.`,
        basis: "EXPLICIT_DEPENDENCY",
        strength: "POSSIBLE",
        affected: [tRef],
        evidence: pathEvidence,
        suggestedChange: null,
      });
    }
  }

  // ── 5. Other participants ──
  for (const p of participants) {
    const ent = idx.entities.get(p.entityId);
    if (!ent || victims.some((v) => v.id === ent.id)) continue;
    const isFaction = ent.type === "FACTION";
    add({
      key: `participant:${ent.id}`,
      category: isFaction ? "POLITICAL" : ent.type === "LOCATION" ? "GEOGRAPHIC" : "CHARACTER",
      title: isFaction ? `${ent.name}'s history includes this event` : `${ent.name}'s biography references this event`,
      description: `${ent.name} took part as ${p.role.toLowerCase()}. Review whether their account still holds.`,
      basis: "EXISTING_RELATIONSHIP",
      strength: "POSSIBLE",
      affected: [idx.entityRef(ent.id)],
      evidence: [{ ...evRef, note: p.role.toLowerCase() }],
      suggestedChange: null,
    });
  }

  // ── 6. Geography ──
  const newLocation = modified?.locationId ?? null;
  if (modified && newLocation !== original.locationId) {
    const refs = [original.locationId, newLocation].filter((x): x is string => !!x).map((id) => idx.entityRef(id));
    add({
      key: `location:${original.id}`,
      category: "GEOGRAPHIC",
      title: `The event moves ${original.locationId ? `from ${idx.entities.get(original.locationId)?.name}` : ""}${newLocation ? ` to ${idx.entities.get(newLocation)?.name}` : ""}`.replace("moves  to", "moves to"),
      description: "Participants must now be present at the new location; travel and territorial control may be affected.",
      basis: "DETERMINISTIC_RULE",
      strength: "DIRECT",
      affected: refs,
      evidence: participants.map((p) => idx.entityRef(p.entityId)),
      suggestedChange: null,
    });
  } else if (original.locationId && (cancelled || dateChanged)) {
    const loc = idx.entities.get(original.locationId);
    if (loc) {
      const control = (idx.relsByEntity.get(loc.id) ?? []).filter((r) => r.type === "CONTROLS" && r.targetId === loc.id);
      add({
        key: `location:${original.id}`,
        category: "GEOGRAPHIC",
        title: `${loc.name}'s history changes`,
        description: control.length
          ? `${loc.name} is controlled by ${control.map((r) => idx.entities.get(r.sourceId)?.name).join(", ")}. Check whether control depended on this event.`
          : `The event took place in ${loc.name}.`,
        basis: "EXISTING_RELATIONSHIP",
        strength: "POSSIBLE",
        affected: [idx.entityRef(loc.id)],
        evidence: control.map((r) => idx.relRef(r)),
        suggestedChange: null,
      });
    }
  }

  // ── 7. Lore references ──
  for (const link of idx.loreByEvent.get(original.id) ?? []) {
    add({
      key: `lore:${link.documentId}`,
      category: "NARRATIVE",
      title: `“${link.documentTitle}” references the original event`,
      description: "This lore document is linked to the event and may describe the original version of history.",
      basis: "EXISTING_RELATIONSHIP",
      strength: "DIRECT",
      affected: [{ type: "LORE", id: link.documentId, label: link.documentTitle }],
      evidence: [evRef],
      suggestedChange: null,
    });
  }
  for (const victim of victims) {
    for (const link of idx.loreByEntity.get(victim.id) ?? []) {
      add({
        key: `lore:${link.documentId}`,
        category: "NARRATIVE",
        title: `“${link.documentTitle}” describes ${victim.name}`,
        description: `${victim.name}'s fate changes; this document may need revision.`,
        basis: "EXISTING_RELATIONSHIP",
        strength: "POSSIBLE",
        affected: [{ type: "LORE", id: link.documentId, label: link.documentTitle }],
        evidence: [idx.entityRef(victim.id)],
        suggestedChange: null,
      });
    }
  }

  // ── 8. Consistency diff: contradictions introduced by the change ──
  const hypothetical: WorldSnapshot = {
    ...snapshot,
    entities: [...hypoEntities.values()],
    relationships: [...hypoRels.values()],
    events: modified ? snapshot.events.map((e) => (e.id === original.id ? modified : e)) : snapshot.events.filter((e) => e.id !== original.id),
    participants: modified ? snapshot.participants : snapshot.participants.filter((p) => p.eventId !== original.id),
    dependencies: modified
      ? snapshot.dependencies
      : snapshot.dependencies.filter((d) => d.sourceId !== original.id && d.targetId !== original.id),
  };
  const before = checkConsistency(snapshot, opts.settings, cal);
  const after = checkConsistency(hypothetical, opts.settings, cal);
  const beforeKeys = new Set(before.map((f) => f.key));
  const afterKeys = new Set(after.map((f) => f.key));
  const newFindings = after.filter((f) => !beforeKeys.has(f.key));
  const resolvedFindings = before.filter((f) => !afterKeys.has(f.key));

  const jeopardized = new Set<string>();
  for (const f of newFindings) {
    const eventRefs = f.refs.filter((r) => r.type === "EVENT" && r.id !== original.id);
    const relRefs = f.refs.filter((r) => r.type === "RELATIONSHIP");
    let suggestedChange: SuggestedChange | null = null;
    let title = f.title;
    if ((f.rule === "PARTICIPANT_DEAD" || f.rule === "PARTICIPANT_NOT_BORN") && eventRefs[0]) {
      suggestedChange = { targetType: "EVENT", targetId: eventRefs[0].id, changeType: "UPDATE", patch: { canonStatus: "DISPUTED" } };
      title = `Does “${eventRefs[0].label}” still happen? ${f.title}`;
      jeopardized.add(eventRefs[0].id);
    } else if (f.rule === "RELATIONSHIP_OUT_OF_LIFETIME" && relRefs[0]) {
      suggestedChange = { targetType: "RELATIONSHIP", targetId: relRefs[0].id, changeType: "UPDATE", patch: { canonStatus: "DISPUTED" } };
    }
    add({
      key: `finding:${f.key}`,
      category: "CONTRADICTION",
      title,
      description: f.explanation,
      basis: "DETERMINISTIC_RULE",
      strength: "DIRECT",
      affected: f.refs,
      evidence: [{ type: "TIMELINE", id: f.rule, label: f.rule.replace(/_/g, " ").toLowerCase(), note: "Consistency rule" }],
      suggestedChange,
    });
  }

  // ── 9. Second-order effects of jeopardized events (bounded) ──
  if (jeopardized.size) {
    const second = boundedBfs(
      [...jeopardized],
      (id) => (idx.depsOut.get(id) ?? []).filter((d) => d.type !== "PREVENTS").map((d) => d.targetId),
      Math.max(1, maxDepth - 1),
      maxNodes,
    );
    for (const [eventId, depth] of second.depth) {
      const ev = idx.events.get(eventId);
      if (!ev || eventId === original.id) continue;
      if (depth === 0) {
        for (const rel of idx.relsByOriginEvent.get(eventId) ?? []) {
          add({
            key: `origin-jeopardized:${rel.id}`,
            category: relationshipMeta(rel.type).category === "political" ? "POLITICAL" : "CHARACTER",
            title: `${idx.relRef(rel).label} depends on a contradicted event`,
            description: `It was established by “${ev.title}”, which may no longer happen as recorded.`,
            basis: "EXPLICIT_DEPENDENCY",
            strength: "POSSIBLE",
            affected: [idx.relRef(rel)],
            evidence: [{ ...idx.eventRef(eventId), note: "Established by" }],
            suggestedChange: { targetType: "RELATIONSHIP", targetId: rel.id, changeType: "UPDATE", patch: { canonStatus: "DISPUTED" } },
          });
        }
        continue;
      }
      const path = pathTo(second.parent, eventId);
      add({
        key: `dep:${eventId}`,
        category: "POTENTIAL",
        title: `“${ev.title}” depends on a contradicted event`,
        description: `Linked through ${path.map((id) => `“${idx.events.get(id)?.title ?? "?"}”`).join(" → ")}.`,
        basis: "EXPLICIT_DEPENDENCY",
        strength: "POSSIBLE",
        affected: [idx.eventRef(eventId)],
        evidence: path.slice(0, -1).map((id) => idx.eventRef(id)),
        suggestedChange: { targetType: "EVENT", targetId: eventId, changeType: "UPDATE", patch: { canonStatus: "DISPUTED" } },
      });
    }
  }

  const categoryOrder = new Map(IMPACT_CATEGORIES.map((c, i) => [c, i]));
  const ranked = [...items.values()].sort(
    (a, b) =>
      STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength] ||
      categoryOrder.get(a.category)! - categoryOrder.get(b.category)! ||
      a.key.localeCompare(b.key),
  );
  // When several items suggest the identical change to the same record, keep only the strongest.
  const seenSuggestion = new Set<string>();
  for (const item of ranked) {
    if (!item.suggestedChange) continue;
    const sig = `${item.suggestedChange.targetType}:${item.suggestedChange.targetId}:${item.suggestedChange.changeType}:${JSON.stringify(item.suggestedChange.patch)}`;
    if (seenSuggestion.has(sig)) items.delete(item.key);
    else seenSuggestion.add(sig);
  }
  const sorted = [...items.values()]
    .sort(
      (a, b) =>
        categoryOrder.get(a.category)! - categoryOrder.get(b.category)! ||
        STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength] ||
        a.title.localeCompare(b.title) ||
        a.key.localeCompare(b.key),
    )
    .slice(0, maxItems);

  const touched = new Set<string>();
  for (const it of sorted) for (const r of it.affected) if (r.type === "ENTITY") touched.add(r.id);

  return {
    sourceEventId: original.id,
    cancelled,
    original,
    modified,
    fieldChanges,
    items: sorted,
    newFindings,
    resolvedFindings,
    stats: {
      eventsTraversed: traversal.depth.size,
      entitiesTouched: touched.size,
      depthLimit: maxDepth,
      truncated: traversal.truncated || items.size > maxItems,
    },
  };
}

function fmt(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return v.length > 60 ? `${v.slice(0, 57)}…` : v;
  return String(v);
}

function periodNote(r: WRelationship, yr: (y: number) => string): string {
  const from = r.validFromYear != null ? yr(r.validFromYear) : "?";
  const to = r.validToYear != null ? yr(r.validToYear) : "present";
  return `${from} – ${to}`;
}

/** Whether a relationship type allows only one holder per target at a time (e.g. RULES). */
export function isExclusiveType(type: string): boolean {
  const meta = BUILTIN_RELATIONSHIP_TYPES[type as keyof typeof BUILTIN_RELATIONSHIP_TYPES];
  return !!meta && "exclusiveTarget" in meta && !!meta.exclusiveTarget;
}
