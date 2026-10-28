import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getWorldContext, guard } from "@/server/page-context";
import { getAtlas } from "@/server/services/maps";
import { Button } from "@/components/ui/button";
import { GlobeLoader } from "@/components/atlas/globe-loader";

export const metadata = { title: "Globe (experimental)" };

export default async function GlobePage(props: PageProps<"/worlds/[worldId]/atlas/globe">) {
  const { worldId } = await props.params;
  const sp = await props.searchParams;
  const ctx = await getWorldContext(worldId);
  const { map } = await guard(() => getAtlas(ctx.user.id, worldId, typeof sp.map === "string" ? sp.map : null));
  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col">
      <div className="flex items-center gap-3 border-b border-border bg-bg-2 px-3 py-2">
        <Button asChild variant="ghost" size="sm"><Link href={`/worlds/${worldId}/atlas${map ? `?map=${map.id}` : ""}`}><ArrowLeft /> Atlas</Link></Button>
        <h1 className="font-serif text-xl font-semibold">{map?.title ?? "Globe"}</h1>
        <span className="text-xs text-muted">Experimental: the map is wrapped onto a sphere for an immersive overview. Editing happens in the 2D Atlas.</span>
      </div>
      <div className="min-h-0 flex-1 bg-[radial-gradient(circle_at_50%_40%,#1c1d24,#0b0c10)]">
        {map ? (
          <GlobeLoader image={map.imageSource} width={map.width} height={map.height} markers={map.placements.filter((p) => !p.entity.archivedAt).map((p) => ({ id: p.entityId, name: p.entity.name, x: p.x, y: p.y }))} />
        ) : (
          <p className="p-8 text-center text-sm text-text-2">No map to display.</p>
        )}
      </div>
    </div>
  );
}
