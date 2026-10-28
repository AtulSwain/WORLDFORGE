import Link from "next/link";
import { Globe2 } from "lucide-react";
import { getWorldContext, guard } from "@/server/page-context";
import { getAtlas } from "@/server/services/maps";
import { db } from "@/server/db";
import { formatEventDate } from "@/domain/chronology";
import { readAttributes } from "@/domain/schemas";
import { AtlasCanvas, type AtlasMarker } from "@/components/atlas/atlas-canvas";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { MapSwitcher } from "@/components/atlas/map-switcher";

export const metadata = { title: "Atlas" };

export default async function AtlasPage(props: PageProps<"/worlds/[worldId]/atlas">) {
  const { worldId } = await props.params;
  const sp = await props.searchParams;
  const ctx = await getWorldContext(worldId);
  const { maps, map } = await guard(() => getAtlas(ctx.user.id, worldId, typeof sp.map === "string" ? sp.map : null));
  const canWrite = ctx.can("content:write");
  if (!map) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState icon={<Globe2 />} title="No maps yet" description="Create a map from a built-in survey sheet or upload your own artwork in the Assets library." action={canWrite ? <MapSwitcher worldId={worldId} maps={[]} currentId={null} canWrite /> : undefined} />
      </div>
    );
  }
  const placed = map.placements.filter((p) => !p.entity.archivedAt);
  const ids = placed.map((p) => p.entityId);
  const [rels, events, locations, factions] = await Promise.all([
    db.relationship.findMany({
      where: { universeId: worldId, archivedAt: null, OR: [{ targetId: { in: ids } }], type: { in: ["CONTROLS", "LOCATED_IN", "BORN_IN", "RULES"] } },
      select: { type: true, targetId: true, source: { select: { id: true, name: true, type: true } } },
    }),
    db.historicalEvent.findMany({ where: { universeId: worldId, archivedAt: null, locationId: { in: ids } }, orderBy: { startOrdinal: "asc" } }),
    db.entity.findMany({ where: { universeId: worldId, archivedAt: null, type: "LOCATION" }, select: { id: true, name: true, type: true } }),
    db.entity.findMany({ where: { universeId: worldId, archivedAt: null, type: "FACTION" }, select: { id: true, name: true, type: true } }),
  ]);
  const markers: AtlasMarker[] = placed.map((p) => {
    const attrs = p.entity.type === "LOCATION" ? readAttributes("LOCATION", p.entity.attributes) : null;
    return {
      entityId: p.entityId,
      name: p.entity.name,
      type: p.entity.type,
      x: p.x,
      y: p.y,
      summary: p.entity.summary,
      status: p.entity.status,
      category: attrs?.category,
      controlledBy: rels.filter((r) => r.targetId === p.entityId && (r.type === "CONTROLS" || r.type === "RULES")).map((r) => ({ id: r.source.id, name: r.source.name })),
      people: rels.filter((r) => r.targetId === p.entityId && (r.type === "LOCATED_IN" || r.type === "BORN_IN")).map((r) => r.source).slice(0, 12),
      events: events.filter((e) => e.locationId === p.entityId).slice(0, 12).map((e) => ({ id: e.id, title: e.title, date: formatEventDate(e, ctx.calendar) })),
    };
  });
  const placedSet = new Set(ids);
  const layers = (map.layerConfig ?? {}) as { markers?: boolean; routes?: boolean; regions?: boolean; labels?: boolean };
  const vp = (map.defaultViewport ?? {}) as { x?: number; y?: number; zoom?: number };
  return (
    <div className="relative">
      <div className="absolute right-3 top-14 z-20 md:top-[54px]">
        <MapSwitcher worldId={worldId} maps={maps} currentId={map.id} canWrite={canWrite} />
      </div>
      <AtlasCanvas
        key={map.id}
        worldId={worldId}
        map={{
          id: map.id, title: map.title, imageSource: map.imageSource, width: map.width, height: map.height,
          layers: { markers: layers.markers ?? true, routes: layers.routes ?? true, regions: layers.regions ?? true, labels: layers.labels ?? true },
          viewport: { x: vp.x ?? map.width / 2, y: vp.y ?? map.height / 2, zoom: vp.zoom ?? 0.5 },
        }}
        markers={markers}
        routes={map.routes.map((r) => ({ id: r.id, name: r.name, kind: r.kind, points: r.points as [number, number][] }))}
        regions={map.regions.map((r) => ({ id: r.id, name: r.name, color: r.color, faction: r.faction, polygon: r.polygon as [number, number][] }))}
        unplaced={locations.filter((l) => !placedSet.has(l.id))}
        factions={factions}
        canWrite={canWrite}
        focusId={typeof sp.focus === "string" ? sp.focus : null}
      />
      <div className="pointer-events-none absolute bottom-3 left-3 z-10">
        <Button asChild variant="secondary" size="sm" className="pointer-events-auto">
          <Link href={`/worlds/${worldId}/atlas/globe?map=${map.id}`}><Globe2 /> 3D globe (experimental)</Link>
        </Button>
      </div>
    </div>
  );
}
