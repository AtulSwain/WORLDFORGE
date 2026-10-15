import { getWorldContext, pickTimeline } from "@/server/page-context";
import { loadSnapshot } from "@/server/services/snapshot";
import { db } from "@/server/db";
import { eventSpan, formatEventDate } from "@/domain/chronology";
import { Chronos, type ChronoEvent } from "@/components/timeline/chronos";

export const metadata = { title: "Chronos" };

export default async function TimelinePage(props: PageProps<"/worlds/[worldId]/timeline">) {
  const { worldId } = await props.params;
  const sp = await props.searchParams;
  const ctx = await getWorldContext(worldId);
  const timeline = pickTimeline(ctx, sp.tl);
  const snap = await loadSnapshot(worldId, timeline.id);
  const descriptions = await db.historicalEvent.findMany({
    where: { id: { in: snap.events.map((e) => e.id) } },
    select: { id: true, description: true },
  });
  const desc = new Map(descriptions.map((d) => [d.id, d.description]));
  const parts = new Map<string, { id: string; role: string }[]>();
  for (const p of snap.participants) parts.set(p.eventId, [...(parts.get(p.eventId) ?? []), { id: p.entityId, role: p.role }]);
  const memberships: Record<string, string[]> = {};
  for (const r of snap.relationships) if (r.type === "MEMBER_OF" || r.type === "RULES") (memberships[r.sourceId] ??= []).push(r.targetId);

  const events: ChronoEvent[] = snap.events.map((e) => {
    const [start, end] = eventSpan(e);
    return {
      id: e.id,
      title: e.title,
      type: e.eventType,
      start,
      end,
      hasSpan: e.endYear != null,
      dateLabel: formatEventDate(e, ctx.calendar),
      importance: e.importance,
      locationId: e.locationId,
      participants: parts.get(e.id) ?? [],
      canonStatus: e.canonStatus,
      modified: snap.overridden.has(e.id),
      branchOnly: e.timelineId === timeline.id && !timeline.isMain,
      description: (snap.overridden.has(e.id) ? undefined : desc.get(e.id)) ?? desc.get(e.id) ?? "",
    };
  });
  const by = (t: string) => snap.entities.filter((e) => e.type === t).map((e) => ({ id: e.id, name: e.name })).sort((a, b) => a.name.localeCompare(b.name));
  const sf = typeof sp.focus === "string" ? sp.focus : null;

  return (
    <Chronos
      worldId={worldId}
      timeline={{ id: timeline.id, name: timeline.name, isMain: timeline.isMain }}
      timelines={ctx.timelines.filter((t) => t.status === "ACTIVE").map((t) => ({ id: t.id, name: t.name, isMain: t.isMain }))}
      events={events}
      calendar={ctx.calendar}
      names={Object.fromEntries(snap.entities.map((e) => [e.id, e.name]))}
      factions={by("FACTION")}
      characters={by("CHARACTER")}
      locations={by("LOCATION")}
      memberships={memberships}
      canWrite={ctx.can("content:write")}
      focusId={sf}
    />
  );
}
