import { eventOrdinals, type DatePrecision } from "@/domain/chronology";
import type { WEntity, WEvent, WorldSnapshot } from "@/domain/world";

/** Small builders for hand-made world snapshots in unit tests. */
export function entity(id: string, over: Partial<WEntity> = {}): WEntity {
  return { id, type: "CHARACTER", name: id, status: "ALIVE", beginYear: null, endYear: null, timelineId: "main", canonStatus: "CANON", version: 1, ...over };
}

export function event(id: string, start: [number, number?, number?], over: Partial<WEvent> & { end?: [number, number?, number?]; precision?: DatePrecision } = {}): WEvent {
  const { end, ...rest } = over;
  const d = {
    startYear: start[0], startMonth: start[1] ?? null, startDay: start[2] ?? null,
    endYear: end?.[0] ?? null, endMonth: end?.[1] ?? null, endDay: end?.[2] ?? null,
  };
  return {
    id, title: id, eventType: "OTHER", ...d, ...eventOrdinals(d), precision: start[2] != null ? "DAY" : start[1] != null ? "MONTH" : "YEAR",
    displayDate: null, importance: 3, locationId: null, canonStatus: "CANON", timelineId: "main", version: 1, ...rest,
  };
}

export function world(parts: Partial<WorldSnapshot>): WorldSnapshot {
  return { entities: [], events: [], participants: [], relationships: [], dependencies: [], loreLinks: [], ...parts };
}
