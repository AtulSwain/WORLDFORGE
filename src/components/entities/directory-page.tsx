import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight, Network, Users } from "lucide-react";
import { ENTITY_STATUSES, ENTITY_TYPE_META, ENTITY_TYPES, entityHref, type EntityTypeKey } from "@/domain/catalog";
import { getWorldContext, guard } from "@/server/page-context";
import { attributeValues, entityOptions, listEntities } from "@/server/services/entities";
import { Button } from "@/components/ui/button";
import { Badge, CanonBadge } from "@/components/ui/badge";
import { EmptyState, PageHeader, Avatar } from "@/components/ui/misc";
import { EntityIcon } from "@/components/world/entity-visual";
import { DirectoryToolbar, type FilterDef } from "./directory-toolbar";
import { humanize } from "@/domain/catalog";
import { plural } from "@/lib/utils";

type SP = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

const DESCRIPTIONS: Partial<Record<EntityTypeKey, string>> = {
  CHARACTER: "Every person in your universe — their identities, natures, arcs and connections.",
  FACTION: "Kingdoms, guilds, orders and secret societies — and how their power changes over time.",
  LOCATION: "Cities, ruins, passes and wildernesses. Place them on the Atlas.",
  ARTIFACT: "Relics, weapons, seals and objects of power.",
};

export async function DirectoryPage({ worldId, type, searchParams, route }: { worldId: string; type: EntityTypeKey | null; searchParams: SP; route: string }) {
  const ctx = await getWorldContext(worldId);
  const typeParam = str(searchParams.type) as EntityTypeKey | undefined;
  const effectiveType: EntityTypeKey | EntityTypeKey[] = type ?? (typeParam && ENTITY_TYPES.includes(typeParam) ? typeParam : (ENTITY_TYPES.filter((t) => ENTITY_TYPE_META[t].route === "entities") as EntityTypeKey[]));
  const page = Math.max(1, Number(str(searchParams.page) ?? 1) || 1);
  const view = str(searchParams.view) === "list" ? "list" : "grid";
  const faction = str(searchParams.faction);
  const location = str(searchParams.location);
  const isCharacters = type === "CHARACTER";

  const [result, factions, locations, species, roles] = await Promise.all([
    guard(() =>
      listEntities(ctx.user.id, worldId, {
        type: effectiveType,
        q: str(searchParams.q),
        status: str(searchParams.status),
        relatedTo: faction ?? location,
        relationType: faction ? "MEMBER_OF" : undefined,
        attrs: { species: str(searchParams.species) ?? "", role: str(searchParams.role) ?? "" },
        archived: str(searchParams.archived) === "1",
        sort: (str(searchParams.sort) as "name" | "updated" | "created") ?? "name",
        page,
        pageSize: view === "list" ? 50 : 24,
      }),
    ),
    isCharacters ? entityOptions(ctx.user.id, worldId, ["FACTION"]) : Promise.resolve([]),
    isCharacters ? entityOptions(ctx.user.id, worldId, ["LOCATION"]) : Promise.resolve([]),
    isCharacters ? attributeValues(ctx.user.id, worldId, "CHARACTER", "species") : Promise.resolve([]),
    isCharacters ? attributeValues(ctx.user.id, worldId, "CHARACTER", "role") : Promise.resolve([]),
  ]);

  const statusType: EntityTypeKey = type ?? (typeParam as EntityTypeKey) ?? "CUSTOM";
  const filters: FilterDef[] = [
    ...(type === null
      ? [{ key: "type", label: "Type", options: ENTITY_TYPES.filter((t) => ENTITY_TYPE_META[t].route === "entities").map((t) => ({ value: t, label: ENTITY_TYPE_META[t].plural })) }]
      : []),
    { key: "status", label: "Status", options: (ENTITY_STATUSES[statusType] ?? []).map((s) => ({ value: s, label: humanize(s) })) },
    ...(isCharacters
      ? [
          { key: "faction", label: "Faction", options: factions.map((f) => ({ value: f.id, label: f.name })) },
          { key: "location", label: "Location", options: locations.map((l) => ({ value: l.id, label: l.name })) },
          { key: "species", label: "Species", options: species.map((s) => ({ value: s, label: s })) },
          { key: "role", label: "Role", options: roles.map((r) => ({ value: r, label: r })) },
        ]
      : []),
  ];
  const meta = type ? ENTITY_TYPE_META[type] : { label: "Entity", plural: "Other entities" };
  const canWrite = ctx.can("content:write");
  const newHref = `/worlds/${worldId}/${route}/new${type === null && typeParam ? `?type=${typeParam}` : ""}`;
  const base = new URLSearchParams(Object.entries(searchParams).filter((e): e is [string, string] => typeof e[1] === "string"));
  const pageHref = (p: number) => {
    const n = new URLSearchParams(base);
    n.set("page", String(p));
    return `?${n.toString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow={ctx.universe.name}
        title={meta.plural}
        description={type ? DESCRIPTIONS[type] : "Species, creatures, cultures, religions, languages, technologies, magic systems and your own custom types."}
        actions={
          <>
            {type === "FACTION" ? (
              <Button asChild variant="ghost" size="sm"><Link href={`/worlds/${worldId}/graph?types=FACTION&rels=ALLY_OF,ENEMY_OF,RIVAL_OF`}><Network /> Alliances & rivalries</Link></Button>
            ) : null}
            {canWrite ? (
              <Button asChild variant="primary"><Link href={newHref}><Plus /> New {meta.label.toLowerCase()}</Link></Button>
            ) : null}
          </>
        }
      />
      <div className="mt-6">
        <DirectoryToolbar filters={filters} sorts={[{ value: "name", label: "Name A–Z" }, { value: "updated", label: "Recently edited" }, { value: "created", label: "Newest" }]} />
      </div>
      <p className="mt-3 text-xs text-muted" aria-live="polite">{result.total} {result.total === 1 ? meta.label.toLowerCase() : meta.plural.toLowerCase()}</p>

      {result.rows.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={<Users />}
          title={str(searchParams.q) || faction || str(searchParams.status) ? "Nothing matches these filters" : `No ${meta.plural.toLowerCase()} yet`}
          description={str(searchParams.q) || faction ? "Try a different search or clear the filters." : `Create your first ${meta.label.toLowerCase()} — you can connect it to the rest of your world afterwards.`}
          action={canWrite && !str(searchParams.q) ? <Button asChild variant="primary"><Link href={newHref}><Plus /> New {meta.label.toLowerCase()}</Link></Button> : undefined}
        />
      ) : view === "grid" ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.rows.map((e) => (
            <li key={e.id}>
              <Link href={entityHref(worldId, e.type as EntityTypeKey, e.id)} className="group flex h-full flex-col rounded-xl border border-border bg-surface p-4 transition-colors hover:border-gold-dim">
                <div className="flex items-start gap-3">
                  {e.type === "CHARACTER" ? <Avatar name={e.name} src={e.portrait} size={44} /> : (
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-2"><EntityIcon type={e.type as EntityTypeKey} className="size-5" /></span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium group-hover:text-gold">{e.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <span>{humanize(e.status)}</span>
                      {e.beginYear != null ? <span>· {e.beginYear}{e.endYear != null ? `–${e.endYear}` : ""} {ctx.calendar.eraSuffix}</span> : null}
                    </div>
                  </div>
                </div>
                <p className="mt-3 line-clamp-3 flex-1 text-sm text-text-2">{e.summary || "No summary yet."}</p>
                <div className="mt-3 flex items-center gap-2 text-2xs text-muted">
                  <span>{plural(e._count.outgoing + e._count.incoming, "connection")}</span>
                  <span>· {plural(e._count.participation, "event")}</span>
                  <span className="ml-auto flex gap-1"><CanonBadge status={e.canonStatus} />{e.archivedAt ? <Badge>archived</Badge> : null}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Span</th>
                <th className="px-4 py-2.5 font-medium">Connections</th>
                <th className="px-4 py-2.5 font-medium">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.rows.map((e) => (
                <tr key={e.id} className="hover:bg-surface/60">
                  <td className="px-4 py-2.5">
                    <Link href={entityHref(worldId, e.type as EntityTypeKey, e.id)} className="flex items-center gap-2 font-medium hover:text-gold">
                      <EntityIcon type={e.type as EntityTypeKey} /> {e.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-text-2">{humanize(e.status)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-text-2">{e.beginYear ?? "?"}–{e.endYear ?? ""}</td>
                  <td className="px-4 py-2.5 text-text-2">{e._count.outgoing + e._count.incoming}</td>
                  <td className="max-w-md truncate px-4 py-2.5 text-text-2">{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.pages > 1 ? (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-2">
          <Button asChild variant="ghost" size="sm" aria-disabled={page <= 1} className={page <= 1 ? "pointer-events-none opacity-40" : ""}>
            <Link href={pageHref(page - 1)}><ChevronLeft /> Previous</Link>
          </Button>
          <span className="text-xs text-muted">Page {page} of {result.pages}</span>
          <Button asChild variant="ghost" size="sm" aria-disabled={page >= result.pages} className={page >= result.pages ? "pointer-events-none opacity-40" : ""}>
            <Link href={pageHref(page + 1)}>Next <ChevronRight /></Link>
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
