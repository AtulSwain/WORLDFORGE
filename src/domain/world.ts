import type { DatePrecision } from "./chronology";
import type { CanonStatusKey, DependencyTypeKey, EntityTypeKey, ParticipantRoleKey } from "./catalog";

/**
 * Plain, serializable snapshot of the world as seen from one timeline.
 * All deterministic analysis (consistency, impact) runs on this structure so it can be
 * unit-tested without a database.
 */

export interface WEntity {
  id: string;
  type: EntityTypeKey;
  name: string;
  status: string;
  beginYear: number | null;
  endYear: number | null;
  timelineId: string;
  canonStatus: CanonStatusKey;
  version: number;
}

export interface WEvent {
  id: string;
  title: string;
  eventType: string;
  startYear: number;
  startMonth: number | null;
  startDay: number | null;
  endYear: number | null;
  endMonth: number | null;
  endDay: number | null;
  precision: DatePrecision;
  startOrdinal: number;
  endOrdinal: number | null;
  displayDate: string | null;
  importance: number;
  locationId: string | null;
  canonStatus: CanonStatusKey;
  timelineId: string;
  version: number;
}

export interface WParticipant {
  eventId: string;
  entityId: string;
  role: ParticipantRoleKey;
}

export interface WRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  validFromYear: number | null;
  validToYear: number | null;
  originEventId: string | null;
  endEventId: string | null;
  canonStatus: CanonStatusKey;
  timelineId: string;
  version: number;
}

export interface WDependency {
  id: string;
  sourceId: string;
  targetId: string;
  type: DependencyTypeKey;
  timelineId: string;
}

export interface WLoreLink {
  documentId: string;
  documentTitle: string;
  entityId: string | null;
  eventId: string | null;
}

export interface WorldSnapshot {
  entities: WEntity[];
  events: WEvent[];
  participants: WParticipant[];
  relationships: WRelationship[];
  dependencies: WDependency[];
  loreLinks: WLoreLink[];
}

export type RecordKind = "ENTITY" | "EVENT" | "RELATIONSHIP";

export interface RecordRef {
  type: RecordKind | "LORE" | "TIMELINE";
  id: string;
  label: string;
}

export class WorldIndex {
  readonly entities = new Map<string, WEntity>();
  readonly events = new Map<string, WEvent>();
  readonly relationships = new Map<string, WRelationship>();
  readonly participantsByEvent = new Map<string, WParticipant[]>();
  readonly participantsByEntity = new Map<string, WParticipant[]>();
  readonly relsByEntity = new Map<string, WRelationship[]>();
  readonly relsByOriginEvent = new Map<string, WRelationship[]>();
  readonly relsByEndEvent = new Map<string, WRelationship[]>();
  readonly depsOut = new Map<string, WDependency[]>();
  readonly depsIn = new Map<string, WDependency[]>();
  readonly loreByEvent = new Map<string, WLoreLink[]>();
  readonly loreByEntity = new Map<string, WLoreLink[]>();

  constructor(readonly snapshot: WorldSnapshot) {
    for (const e of snapshot.entities) this.entities.set(e.id, e);
    for (const e of snapshot.events) this.events.set(e.id, e);
    for (const r of snapshot.relationships) {
      this.relationships.set(r.id, r);
      push(this.relsByEntity, r.sourceId, r);
      if (r.targetId !== r.sourceId) push(this.relsByEntity, r.targetId, r);
      if (r.originEventId) push(this.relsByOriginEvent, r.originEventId, r);
      if (r.endEventId) push(this.relsByEndEvent, r.endEventId, r);
    }
    for (const p of snapshot.participants) {
      push(this.participantsByEvent, p.eventId, p);
      push(this.participantsByEntity, p.entityId, p);
    }
    for (const d of snapshot.dependencies) {
      push(this.depsOut, d.sourceId, d);
      push(this.depsIn, d.targetId, d);
    }
    for (const l of snapshot.loreLinks) {
      if (l.eventId) push(this.loreByEvent, l.eventId, l);
      if (l.entityId) push(this.loreByEntity, l.entityId, l);
    }
  }

  entityRef(id: string): RecordRef {
    return { type: "ENTITY", id, label: this.entities.get(id)?.name ?? "Unknown entity" };
  }
  eventRef(id: string): RecordRef {
    return { type: "EVENT", id, label: this.events.get(id)?.title ?? "Unknown event" };
  }
  relRef(r: WRelationship, label?: string): RecordRef {
    const s = this.entities.get(r.sourceId)?.name ?? "?";
    const t = this.entities.get(r.targetId)?.name ?? "?";
    return { type: "RELATIONSHIP", id: r.id, label: label ?? `${s} — ${r.type} — ${t}` };
  }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
