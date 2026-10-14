import "server-only";
import { ancestorChain, resolveSnapshot, type Overlay, type ResolvedSnapshot } from "@/domain/timeline-resolution";
import type { WorldSnapshot } from "@/domain/world";
import { db, type DbOrTx } from "../db";
import { notFound } from "../errors";

export async function getTimelines(universeId: string, client: DbOrTx = db) {
  return client.timeline.findMany({ where: { universeId }, orderBy: [{ isMain: "desc" }, { createdAt: "asc" }] });
}

export async function mainTimeline(universeId: string, client: DbOrTx = db) {
  const t = await client.timeline.findFirst({ where: { universeId, isMain: true } });
  if (!t) throw notFound("Main timeline");
  return t;
}

/** Resolves the requested timeline id (or the universe default / main timeline). */
export async function resolveTimelineId(universeId: string, requested?: string | null, client: DbOrTx = db): Promise<string> {
  if (requested) {
    const t = await client.timeline.findFirst({ where: { id: requested, universeId }, select: { id: true } });
    if (t) return t.id;
  }
  const u = await client.universe.findUnique({ where: { id: universeId }, select: { defaultTimelineId: true } });
  if (u?.defaultTimelineId) {
    const t = await client.timeline.findFirst({ where: { id: u.defaultTimelineId, universeId }, select: { id: true } });
    if (t) return t.id;
  }
  return (await mainTimeline(universeId, client)).id;
}

export async function timelineChain(universeId: string, timelineId: string, client: DbOrTx = db): Promise<string[]> {
  const timelines = await client.timeline.findMany({ where: { universeId }, select: { id: true, parentId: true } });
  const chain = ancestorChain(timelines, timelineId);
  if (!chain.length) throw notFound("Timeline");
  return chain;
}

/**
 * Loads the world as seen from one timeline: base records from the ancestor chain with
 * branch overlays applied. Bounded to a single universe and a few indexed queries (no N+1).
 */
export async function loadSnapshot(universeId: string, timelineId: string, client: DbOrTx = db): Promise<ResolvedSnapshot & { chain: string[] }> {
  const chain = await timelineChain(universeId, timelineId, client);
  const inChain = { in: chain };
  const [entities, events, relationships, dependencies, overlays] = await Promise.all([
    client.entity.findMany({
      where: { universeId, timelineId: inChain, archivedAt: null },
      select: { id: true, type: true, name: true, status: true, beginYear: true, endYear: true, timelineId: true, canonStatus: true, version: true },
    }),
    client.historicalEvent.findMany({
      where: { universeId, timelineId: inChain, archivedAt: null },
      select: {
        id: true, title: true, eventType: true, startYear: true, startMonth: true, startDay: true, endYear: true, endMonth: true,
        endDay: true, precision: true, startOrdinal: true, endOrdinal: true, displayDate: true, importance: true, locationId: true,
        canonStatus: true, timelineId: true, version: true,
      },
      orderBy: { startOrdinal: "asc" },
    }),
    client.relationship.findMany({
      where: { universeId, timelineId: inChain, archivedAt: null },
      select: {
        id: true, sourceId: true, targetId: true, type: true, validFromYear: true, validToYear: true, originEventId: true,
        endEventId: true, canonStatus: true, timelineId: true, version: true,
      },
    }),
    client.eventDependency.findMany({
      where: { universeId, timelineId: inChain },
      select: { id: true, sourceId: true, targetId: true, type: true, timelineId: true },
    }),
    client.timelineChange.findMany({
      where: { universeId, timelineId: inChain, status: "ACCEPTED", appliedToBase: false },
      select: { id: true, timelineId: true, targetType: true, targetId: true, changeType: true, proposedState: true, createdAt: true },
    }),
  ]);
  const eventIds = events.map((e) => e.id);
  const [participants, loreLinks] = await Promise.all([
    client.eventParticipant.findMany({ where: { eventId: { in: eventIds } }, select: { eventId: true, entityId: true, role: true } }),
    client.loreLink.findMany({
      where: { document: { universeId, archivedAt: null } },
      select: { documentId: true, entityId: true, eventId: true, document: { select: { title: true } } },
    }),
  ]);
  const base: WorldSnapshot = {
    entities,
    events,
    relationships,
    dependencies,
    participants,
    loreLinks: loreLinks.map((l) => ({ documentId: l.documentId, documentTitle: l.document.title, entityId: l.entityId, eventId: l.eventId })),
  };
  const resolved = resolveSnapshot(base, chain, overlays.map((o) => ({ ...o, proposedState: (o.proposedState ?? null) as Overlay["proposedState"] })));
  return { ...resolved, chain };
}
