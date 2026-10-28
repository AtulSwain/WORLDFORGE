import { entityHref, type EntityTypeKey } from "@/domain/catalog";
import { getWorldContext, guard } from "@/server/page-context";
import { listAssets } from "@/server/services/assets";
import { entityOptions } from "@/server/services/entities";
import { MAX_UPLOAD_BYTES, storage } from "@/server/storage";
import { PageHeader } from "@/components/ui/misc";
import { AssetLibrary } from "@/components/assets/asset-library";

export const metadata = { title: "Assets" };

export default async function AssetsPage(props: PageProps<"/worlds/[worldId]/assets">) {
  const { worldId } = await props.params;
  const sp = await props.searchParams;
  const ctx = await getWorldContext(worldId);
  let storageError: string | null = null;
  try {
    storage();
  } catch (e) {
    storageError = e instanceof Error ? e.message : "Storage is not configured.";
  }
  const [assets, entities] = await Promise.all([guard(() => listAssets(ctx.user.id, worldId)), entityOptions(ctx.user.id, worldId)]);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader eyebrow={ctx.universe.name} title="Assets" description="Portraits, emblems, maps, concept art and reference documents — stored outside the database and visible only to members of this universe." />
      {storageError ? <p role="alert" className="mt-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-[#e7a3a3]">{storageError}</p> : null}
      <div className="mt-6">
        <AssetLibrary
          worldId={worldId}
          canWrite={ctx.can("content:write") && !storageError}
          attachTo={typeof sp.attach === "string" ? sp.attach : null}
          maxMb={Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}
          entities={entities.map((e) => ({ id: e.id, name: e.name, type: e.type }))}
          assets={assets.map((a) => ({
            id: a.id, kind: a.kind, filename: a.filename, mimeType: a.mimeType, sizeBytes: a.sizeBytes, width: a.width, height: a.height, altText: a.altText, hasThumb: !!a.thumbnailKey,
            links: a.links.map((l) => ({
              id: l.id,
              label: l.entity?.name ?? l.event?.title ?? l.document?.title ?? "record",
              href: l.entity ? entityHref(worldId, l.entity.type as EntityTypeKey, l.entity.id) : l.event ? `/worlds/${worldId}/events/${l.event.id}` : `/worlds/${worldId}/codex/${l.document?.id}`,
            })),
          }))}
        />
      </div>
    </div>
  );
}
