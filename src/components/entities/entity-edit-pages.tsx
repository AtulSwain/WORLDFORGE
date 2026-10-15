import Link from "next/link";
import { redirect } from "next/navigation";
import { ENTITY_TYPE_META, ENTITY_TYPES, entityHref, type EntityTypeKey } from "@/domain/catalog";
import { getWorldContext, guard } from "@/server/page-context";
import { entityOptions, getEntity } from "@/server/services/entities";
import { PageHeader } from "@/components/ui/misc";
import { EntityForm } from "./entity-form";

export async function EntityNewPage({ worldId, type, typeParam }: { worldId: string; type: EntityTypeKey | null; typeParam?: string }) {
  const ctx = await getWorldContext(worldId);
  if (!ctx.can("content:write")) redirect(`/worlds/${worldId}`);
  const generic = ENTITY_TYPES.filter((t) => ENTITY_TYPE_META[t].route === "entities");
  const effective = type ?? (generic.includes(typeParam as EntityTypeKey) ? (typeParam as EntityTypeKey) : null);
  if (!effective) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <PageHeader eyebrow="New entity" title="What are you creating?" />
        <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {generic.map((t) => (
            <li key={t}>
              <Link href={`/worlds/${worldId}/entities/new?type=${t}`} className="block rounded-lg border border-border bg-surface p-4 text-sm hover:border-gold-dim">{ENTITY_TYPE_META[t].label}</Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const options = await entityOptions(ctx.user.id, worldId);
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader eyebrow={ctx.universe.name} title={`New ${ENTITY_TYPE_META[effective].label.toLowerCase()}`} description="Only a name is required. Everything else can be filled in as your world grows." />
      <div className="mt-6">
        <EntityForm worldId={worldId} type={effective} options={options.map((o) => ({ id: o.id, name: o.name, type: o.type }))} />
      </div>
    </div>
  );
}

export async function EntityEditPage({ worldId, entityId }: { worldId: string; entityId: string }) {
  const ctx = await getWorldContext(worldId);
  if (!ctx.can("content:write")) redirect(`/worlds/${worldId}`);
  const [{ entity: e }, options] = await Promise.all([guard(() => getEntity(ctx.user.id, worldId, entityId)), entityOptions(ctx.user.id, worldId)]);
  const type = e.type as EntityTypeKey;
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow={<Link href={entityHref(worldId, type, e.id)} className="hover:text-text">← Back to {e.name}</Link>}
        title={`Edit ${e.name}`}
        description={`Version ${e.version}. Saving creates a new revision; earlier versions stay restorable.`}
      />
      <div className="mt-6">
        <EntityForm
          worldId={worldId}
          type={type}
          options={options.filter((o) => o.id !== e.id).map((o) => ({ id: o.id, name: o.name, type: o.type }))}
          initial={{
            id: e.id, version: e.version, name: e.name, summary: e.summary, description: e.description, status: e.status, beginYear: e.beginYear,
            endYear: e.endYear, canonStatus: e.canonStatus, customTypeLabel: e.customTypeLabel, portrait: e.portrait, attributes: e.attributes as Record<string, unknown>,
          }}
        />
      </div>
    </div>
  );
}
