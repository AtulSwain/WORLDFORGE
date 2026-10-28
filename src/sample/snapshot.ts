import { eventOrdinals } from "@/domain/chronology";
import type { WorldSnapshot } from "@/domain/world";
import { DEPENDENCIES, ENTITIES, EVENTS, LORE, RELATIONSHIPS } from "./ashen-crown";

/** Builds an in-memory snapshot of the sample universe, using sample keys as ids. */
export function sampleSnapshot(timelineId = "main"): WorldSnapshot {
  return {
    entities: ENTITIES.map((e) => ({
      id: e.key, type: e.type, name: e.name, status: e.status, beginYear: e.beginYear ?? null, endYear: e.endYear ?? null,
      timelineId, canonStatus: "CANON", version: 1,
    })),
    events: EVENTS.map((e) => {
      const [sy, sm, sd] = e.start;
      const [ey, em, ed] = e.end ?? [];
      const d = { startYear: sy, startMonth: sm ?? null, startDay: sd ?? null, endYear: ey ?? null, endMonth: em ?? null, endDay: ed ?? null };
      return {
        id: e.key, title: e.title, eventType: e.eventType, ...d, ...eventOrdinals(d), precision: e.precision, displayDate: null,
        importance: e.importance, locationId: e.location ?? null, canonStatus: "CANON", timelineId, version: 1,
      };
    }),
    participants: EVENTS.flatMap((e) => (e.participants ?? []).map(([entityId, role]) => ({ eventId: e.key, entityId, role: role as never }))),
    relationships: RELATIONSHIPS.map((r, i) => ({
      id: `rel${i}:${r.source}:${r.type}:${r.target}`, sourceId: r.source, targetId: r.target, type: r.type,
      validFromYear: r.from ?? null, validToYear: r.to ?? null, originEventId: r.origin ?? null, endEventId: r.end ?? null,
      canonStatus: "CANON", timelineId, version: 1,
    })),
    dependencies: DEPENDENCIES.map(([s, type, t], i) => ({ id: `dep${i}`, sourceId: s, targetId: t, type, timelineId })),
    loreLinks: LORE.flatMap((doc, i) => [
      ...doc.entities.map((k) => ({ documentId: `lore${i}`, documentTitle: doc.title, entityId: k, eventId: null })),
      ...doc.events.map((k) => ({ documentId: `lore${i}`, documentTitle: doc.title, entityId: null, eventId: k })),
    ]),
  };
}
