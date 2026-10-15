import "server-only";
import { db } from "@/server/db";
import { entityOptions } from "@/server/services/entities";
import { eventOptions } from "@/server/services/events";

/** Picker data for the event form (bounded lists). */
export async function eventFormData(userId: string, worldId: string) {
  const [entities, events, lore] = await Promise.all([
    entityOptions(userId, worldId),
    eventOptions(userId, worldId),
    db.loreDocument.findMany({ where: { universeId: worldId, archivedAt: null }, select: { id: true, title: true }, orderBy: { title: "asc" }, take: 500 }),
  ]);
  return {
    entities: entities.map((e) => ({ id: e.id, name: e.name, type: e.type })),
    locations: entities.filter((e) => e.type === "LOCATION").map((e) => ({ id: e.id, name: e.name, type: e.type })),
    events: events.map((e) => ({ id: e.id, name: e.title, hint: String(e.startYear) })),
    loreDocs: lore.map((d) => ({ id: d.id, name: d.title })),
  };
}
