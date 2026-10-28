import { eventOrdinals } from "./chronology";
import type { RecordKind, WEntity, WEvent, WorldSnapshot, WRelationship } from "./world";

/**
 * Alternate-timeline resolution.
 *
 * A timeline sees every record that originates in itself or in one of its ancestors.
 * Records originating in an ancestor are inherited unchanged unless this timeline (or an
 * intermediate ancestor) holds an ACCEPTED overlay change for them:
 *   - UPDATE: shallow patch of fields
 *   - DELETE: tombstone — the record does not exist in this branch
 * Overlays are applied from the root down, so the deepest timeline wins. Branches never clone
 * records and never modify their parent's rows.
 */

export interface TimelineNode {
  id: string;
  parentId: string | null;
}

export interface Overlay {
  id: string;
  timelineId: string;
  targetType: RecordKind;
  targetId: string;
  changeType: "CREATE" | "UPDATE" | "DELETE";
  proposedState: Record<string, unknown> | null;
  createdAt: Date | string;
}

/** Returns [root, …, timelineId]. Guards against malformed cyclic parent chains. */
export function ancestorChain(timelines: TimelineNode[], timelineId: string): string[] {
  const byId = new Map(timelines.map((t) => [t.id, t]));
  const chain: string[] = [];
  const seen = new Set<string>();
  let cur = byId.get(timelineId);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.unshift(cur.id);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain;
}

export interface ResolvedSnapshot extends WorldSnapshot {
  /** Records whose effective state differs from the inherited state because of an overlay in this chain. */
  overridden: Map<string, { timelineId: string; changeIds: string[] }>;
  /** Records hidden by a tombstone. */
  removed: Set<string>;
}

const EVENT_DATE_FIELDS = new Set(["startYear", "startMonth", "startDay", "endYear", "endMonth", "endDay"]);

export function applyEventPatch(ev: WEvent, patch: Record<string, unknown>): WEvent {
  const next = { ...ev, ...pickKnown(ev, patch) } as WEvent;
  if (Object.keys(patch).some((k) => EVENT_DATE_FIELDS.has(k))) {
    const o = eventOrdinals(next);
    next.startOrdinal = o.startOrdinal;
    next.endOrdinal = o.endOrdinal;
  }
  return next;
}

function pickKnown<T extends object>(base: T, patch: Record<string, unknown>): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k in base) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export function resolveSnapshot(base: WorldSnapshot, chain: string[], overlays: Overlay[]): ResolvedSnapshot {
  const depthOf = new Map(chain.map((id, i) => [id, i]));
  const inChain = (tid: string) => depthOf.has(tid);

  const entities = new Map<string, WEntity>();
  const events = new Map<string, WEvent>();
  const relationships = new Map<string, WRelationship>();
  for (const e of base.entities) if (inChain(e.timelineId)) entities.set(e.id, { ...e });
  for (const e of base.events) if (inChain(e.timelineId)) events.set(e.id, { ...e });
  for (const r of base.relationships) if (inChain(r.timelineId)) relationships.set(r.id, { ...r });

  const relevant = overlays
    .filter((o) => inChain(o.timelineId) && o.changeType !== "CREATE")
    .sort((a, b) => {
      const d = depthOf.get(a.timelineId)! - depthOf.get(b.timelineId)!;
      if (d !== 0) return d;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  const overridden = new Map<string, { timelineId: string; changeIds: string[] }>();
  const removed = new Set<string>();

  for (const o of relevant) {
    const store: Map<string, WEntity | WEvent | WRelationship> =
      o.targetType === "ENTITY" ? entities : o.targetType === "EVENT" ? events : relationships;
    const current = store.get(o.targetId);
    if (!current) continue;
    // A record can only be overridden by a timeline at or below the one it originates in.
    if (depthOf.get(o.timelineId)! < depthOf.get(current.timelineId)!) continue;
    const mark = overridden.get(o.targetId) ?? { timelineId: o.timelineId, changeIds: [] };
    mark.timelineId = o.timelineId;
    mark.changeIds.push(o.id);
    overridden.set(o.targetId, mark);
    if (o.changeType === "DELETE") {
      store.delete(o.targetId);
      removed.add(o.targetId);
      continue;
    }
    const patch = o.proposedState ?? {};
    if (o.targetType === "EVENT") events.set(o.targetId, applyEventPatch(current as WEvent, patch));
    else store.set(o.targetId, { ...current, ...pickKnown(current, patch) } as typeof current);
  }

  // Drop dangling links to removed or invisible records.
  const participants = base.participants.filter((p) => events.has(p.eventId) && entities.has(p.entityId));
  const dependencies = base.dependencies.filter(
    (d) => inChain(d.timelineId) && events.has(d.sourceId) && events.has(d.targetId),
  );
  for (const [id, r] of relationships) {
    if (!entities.has(r.sourceId) || !entities.has(r.targetId)) relationships.delete(id);
  }
  const loreLinks = base.loreLinks.filter(
    (l) => (l.eventId == null || events.has(l.eventId)) && (l.entityId == null || entities.has(l.entityId)),
  );

  return {
    entities: [...entities.values()],
    events: [...events.values()].sort((a, b) => a.startOrdinal - b.startOrdinal),
    relationships: [...relationships.values()],
    participants,
    dependencies,
    loreLinks,
    overridden,
    removed,
  };
}

export interface FieldDiff {
  field: string;
  before: unknown;
  after: unknown;
}

export interface RecordDiff {
  kind: RecordKind;
  id: string;
  label: string;
  status: "added" | "removed" | "modified";
  fields: FieldDiff[];
}

const IGNORED_DIFF_FIELDS = new Set(["version", "timelineId", "startOrdinal", "endOrdinal"]);

export function diffRecords<T extends { id: string }>(
  kind: RecordKind,
  before: T[],
  after: T[],
  label: (r: T) => string,
): RecordDiff[] {
  const a = new Map(before.map((r) => [r.id, r]));
  const b = new Map(after.map((r) => [r.id, r]));
  const out: RecordDiff[] = [];
  for (const [id, rec] of b) {
    const prev = a.get(id);
    if (!prev) {
      out.push({ kind, id, label: label(rec), status: "added", fields: [] });
      continue;
    }
    const fields: FieldDiff[] = [];
    for (const key of Object.keys(rec) as (keyof T & string)[]) {
      if (IGNORED_DIFF_FIELDS.has(key)) continue;
      if (JSON.stringify(prev[key]) !== JSON.stringify(rec[key])) {
        fields.push({ field: key, before: prev[key], after: rec[key] });
      }
    }
    if (fields.length) out.push({ kind, id, label: label(rec), status: "modified", fields });
  }
  for (const [id, rec] of a) {
    if (!b.has(id)) out.push({ kind, id, label: label(rec), status: "removed", fields: [] });
  }
  return out;
}

export function diffSnapshots(parent: WorldSnapshot, branch: WorldSnapshot): RecordDiff[] {
  const names = new Map([...parent.entities, ...branch.entities].map((e) => [e.id, e.name]));
  return [
    ...diffRecords("EVENT", parent.events, branch.events, (e) => e.title),
    ...diffRecords("ENTITY", parent.entities, branch.entities, (e) => e.name),
    ...diffRecords(
      "RELATIONSHIP",
      parent.relationships,
      branch.relationships,
      (r) => `${names.get(r.sourceId) ?? "?"} — ${r.type} — ${names.get(r.targetId) ?? "?"}`,
    ),
  ];
}
