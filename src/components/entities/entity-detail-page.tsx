import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil, Network, Map, Diamond, BookOpen, Images, GitBranch, Flame } from "lucide-react";
import { ENTITY_TYPE_META, entityHref, humanize, relationshipMeta, type EntityTypeKey } from "@/domain/catalog";
import { formatEventDate, formatYear } from "@/domain/chronology";
import { readAttributes } from "@/domain/schemas";
import { getWorldContext, guard, pickTimeline } from "@/server/page-context";
import { entityOptions, getEntity } from "@/server/services/entities";
import { eventOptions } from "@/server/services/events";
import { listRelationshipTypes } from "@/server/services/relationships";
import { listRevisions } from "@/server/services/revisions";
import { loadSnapshot } from "@/server/services/snapshot";
import { publicAiStatus } from "@/server/ai/config";
import { Button } from "@/components/ui/button";
import { Badge, CanonBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";
import { EntityIcon } from "@/components/world/entity-visual";
import { DetailTabs } from "@/components/common/detail-tabs";
import { RevisionHistory } from "@/components/common/revision-history";
import { ArchiveButton } from "@/components/common/archive-button";
import { RelationshipManager, type RelRow } from "./relationship-manager";
import { AiAssistPanel } from "@/components/ai/ai-assist-panel";
import { cn } from "@/lib/utils";

type SP = Record<string, string | string[] | undefined>;

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  if (children == null || children === "" || (Array.isArray(children) && children.length === 0)) return null;
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-text">{children}</dd>
    </div>
  );
}

function Chips({ items }: { items: string[] | undefined }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => <span key={i} className="rounded border border-border bg-surface-2 px-2 py-0.5 text-xs">{i}</span>)}
    </div>
  );
}

function Prose({ title, text }: { title: string; text: string | undefined }) {
  if (!text) return null;
  return (
    <section>
      <h3 className="wf-eyebrow mb-1.5">{title}</h3>
      <p className="whitespace-pre-line text-sm leading-relaxed text-text-2">{text}</p>
    </section>
  );
}

export async function EntityDetailPage({ worldId, entityId, expected, searchParams }: { worldId: string; entityId: string; expected: EntityTypeKey | null; searchParams: SP }) {
  const ctx = await getWorldContext(worldId);
  const { entity: e } = await guard(() => getEntity(ctx.user.id, worldId, entityId));
  const type = e.type as EntityTypeKey;
  // Keep URLs canonical: a faction opened under /characters redirects to /factions.
  if (expected && expected !== type) redirect(entityHref(worldId, type, e.id));
  if (!expected && ENTITY_TYPE_META[type].route !== "entities") redirect(entityHref(worldId, type, e.id));

  const timeline = pickTimeline(ctx, searchParams.tl);
  const [options, events, customTypes, revisions, snapshot] = await Promise.all([
    entityOptions(ctx.user.id, worldId),
    eventOptions(ctx.user.id, worldId),
    listRelationshipTypes(ctx.user.id, worldId),
    listRevisions(worldId, "ENTITY", e.id),
    loadSnapshot(worldId, timeline.id),
  ]);
  const canWrite = ctx.can("content:write");
  const cal = ctx.calendar;
  const meta = ENTITY_TYPE_META[type];
  const w = (p: string) => `/worlds/${worldId}${p}`;

  const rows: RelRow[] = [
    ...e.outgoing.map((r) => ({ id: r.id, version: r.version, type: r.type, direction: "out" as const, other: r.target, validFromYear: r.validFromYear, validToYear: r.validToYear, description: r.description, canonStatus: r.canonStatus, originEvent: r.originEvent, originEventId: r.originEventId, endEventId: r.endEventId })),
    ...e.incoming.map((r) => ({ id: r.id, version: r.version, type: r.type, direction: "in" as const, other: r.source, validFromYear: r.validFromYear, validToYear: r.validToYear, description: r.description, canonStatus: r.canonStatus, originEvent: r.originEvent, originEventId: r.originEventId, endEventId: r.endEventId })),
  ];
  const relsOf = (t: string, dir: "out" | "in") => rows.filter((r) => r.type === t && r.direction === dir);
  const entityOpts = options.map((o) => ({ id: o.id, name: o.name, type: o.type }));
  const eventOpts = events.map((ev) => ({ id: ev.id, name: ev.title, hint: String(ev.startYear) }));

  // ── Timeline-aware state from the resolved snapshot of the selected timeline ──
  const resolved = snapshot.entities.find((x) => x.id === e.id);
  const names = new globalThis.Map(snapshot.entities.map((x) => [x.id, x.name]));
  const evById = new globalThis.Map(snapshot.events.map((x) => [x.id, x]));
  const myEvents = snapshot.participants
    .filter((p) => p.entityId === e.id)
    .map((p) => ({ p, ev: evById.get(p.eventId)! }))
    .filter((x) => x.ev)
    .sort((a, b) => a.ev.startOrdinal - b.ev.startOrdinal);
  const myRels = snapshot.relationships.filter((r) => r.sourceId === e.id || r.targetId === e.id);
  type Entry = { year: number; ordinal: number; label: React.ReactNode; kind: "event" | "rel" | "life"; modified?: boolean };
  const entries: Entry[] = [];
  if (resolved?.beginYear != null) entries.push({ year: resolved.beginYear, ordinal: resolved.beginYear * 1000, kind: "life", label: type === "CHARACTER" ? "Born" : type === "FACTION" ? "Founded" : "Begins" });
  if (resolved?.endYear != null) entries.push({ year: resolved.endYear, ordinal: resolved.endYear * 1000 + 999, kind: "life", label: type === "CHARACTER" ? "Dies" : type === "FACTION" ? "Dissolved" : "Ends", modified: snapshot.overridden.has(e.id) });
  for (const { p, ev } of myEvents) {
    entries.push({ year: ev.startYear, ordinal: ev.startOrdinal, kind: "event", modified: snapshot.overridden.has(ev.id), label: <><Link href={w(`/events/${ev.id}`)} className="hover:text-gold">{ev.title}</Link> <span className="text-muted">as {p.role.toLowerCase()}</span></> });
  }
  for (const r of myRels) {
    const out = r.sourceId === e.id;
    const other = names.get(out ? r.targetId : r.sourceId) ?? "?";
    const m = relationshipMeta(r.type, customTypes);
    const verb = out || m.symmetric ? m.label : m.inverseLabel;
    if (r.validFromYear != null) entries.push({ year: r.validFromYear, ordinal: r.validFromYear * 1000 + 1, kind: "rel", modified: snapshot.overridden.has(r.id), label: <>Becomes <span className="text-text">{verb.toLowerCase()} {other}</span></> });
    if (r.validToYear != null) entries.push({ year: r.validToYear, ordinal: r.validToYear * 1000 + 998, kind: "rel", label: <>No longer {verb.toLowerCase()} {other}</> });
  }
  entries.sort((a, b) => a.ordinal - b.ordinal);

  const attrs = readAttributes(type, e.attributes) as Record<string, unknown>;
  const str = (k: string) => (typeof attrs[k] === "string" ? (attrs[k] as string) : undefined);
  const list = (k: string) => (Array.isArray(attrs[k]) ? (attrs[k] as string[]) : undefined);

  const overview = (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-5">
        {e.description ? <p className="whitespace-pre-line leading-relaxed text-text-2">{e.description}</p> : <p className="text-sm text-muted">No description yet.</p>}
        {type === "FACTION" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <section className="wf-panel p-4">
              <h3 className="wf-eyebrow mb-2">Leadership & succession</h3>
              {relsOf("RULES", "in").length === 0 ? <p className="text-sm text-muted">No recorded leaders.</p> : (
                <ol className="flex flex-col gap-1.5 border-l border-border pl-3">
                  {[...relsOf("RULES", "in")].sort((a, b) => (a.validFromYear ?? -1e9) - (b.validFromYear ?? -1e9)).map((r) => (
                    <li key={r.id} className="text-sm"><Link className="hover:text-gold" href={entityHref(worldId, r.other.type as EntityTypeKey, r.other.id)}>{r.other.name}</Link> <span className="text-xs text-muted">{r.validFromYear ?? "?"} – {r.validToYear ?? "present"}</span></li>
                  ))}
                </ol>
              )}
            </section>
            <section className="wf-panel p-4">
              <h3 className="wf-eyebrow mb-2">Members</h3>
              <ul className="flex flex-wrap gap-1.5">
                {relsOf("MEMBER_OF", "in").map((r) => <li key={r.id}><Link href={entityHref(worldId, r.other.type as EntityTypeKey, r.other.id)} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs hover:border-gold-dim"><EntityIcon type={r.other.type as EntityTypeKey} className="size-3" />{r.other.name}</Link></li>)}
                {relsOf("MEMBER_OF", "in").length === 0 ? <li className="text-sm text-muted">None recorded.</li> : null}
              </ul>
            </section>
            <section className="wf-panel p-4">
              <h3 className="wf-eyebrow mb-2">Allies & enemies over time</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {rows.filter((r) => ["ALLY_OF", "ENEMY_OF", "RIVAL_OF"].includes(r.type)).map((r) => (
                  <li key={r.id} className="flex items-center gap-2">
                    <Badge tone={r.type === "ALLY_OF" ? "success" : r.type === "ENEMY_OF" ? "danger" : "warning"}>{relationshipMeta(r.type).label}</Badge>
                    <Link href={entityHref(worldId, r.other.type as EntityTypeKey, r.other.id)} className="truncate hover:text-gold">{r.other.name}</Link>
                    <span className="ml-auto shrink-0 text-xs text-muted">{r.validFromYear ?? "?"}–{r.validToYear ?? "now"}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="wf-panel p-4">
              <h3 className="wf-eyebrow mb-2">Controlled territory</h3>
              <ul className="flex flex-wrap gap-1.5">
                {relsOf("CONTROLS", "out").map((r) => <li key={r.id}><Link href={entityHref(worldId, r.other.type as EntityTypeKey, r.other.id)} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs hover:border-gold-dim"><EntityIcon type={r.other.type as EntityTypeKey} className="size-3" />{r.other.name}</Link></li>)}
                {relsOf("CONTROLS", "out").length === 0 ? <li className="text-sm text-muted">None recorded.</li> : null}
              </ul>
            </section>
          </div>
        ) : null}
        {type === "LOCATION" ? (
          <section className="wf-panel p-4">
            <h3 className="wf-eyebrow mb-2">Events at this location</h3>
            {e.eventsHere.length === 0 ? <p className="text-sm text-muted">No events recorded here.</p> : (
              <ul className="flex flex-col gap-1.5">
                {e.eventsHere.map((ev) => <li key={ev.id} className="flex items-center justify-between gap-3 text-sm"><Link href={w(`/events/${ev.id}`)} className="hover:text-gold">{ev.title}</Link><span className="shrink-0 text-xs text-muted">{formatEventDate({ ...ev, precision: ev.precision }, cal)}</span></li>)}
              </ul>
            )}
          </section>
        ) : null}
        <section>
          <h3 className="wf-eyebrow mb-2">Connections at a glance</h3>
          <div className="flex flex-wrap gap-1.5">
            {rows.slice(0, 24).map((r) => {
              const m = relationshipMeta(r.type, customTypes);
              return (
                <Link key={r.id} href={entityHref(worldId, r.other.type as EntityTypeKey, r.other.id)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs hover:border-gold-dim">
                  <span className="text-muted">{(r.direction === "out" || m.symmetric ? m.label : m.inverseLabel).toLowerCase()}</span>
                  <EntityIcon type={r.other.type as EntityTypeKey} className="size-3" /> {r.other.name}
                </Link>
              );
            })}
            {rows.length === 0 ? <span className="text-sm text-muted">No connections yet.</span> : null}
          </div>
        </section>
      </div>
      <aside className="flex flex-col gap-4">
        <dl className="wf-panel grid gap-3 p-4">
          <Prop label="Type">{type === "CUSTOM" ? e.customTypeLabel : meta.label}</Prop>
          <Prop label="Status">{humanize(e.status)}</Prop>
          <Prop label={type === "CHARACTER" ? "Born" : "Begins"}>{e.beginYear != null ? formatYear(e.beginYear, cal) : undefined}</Prop>
          <Prop label={type === "CHARACTER" ? "Died" : "Ends"}>{e.endYear != null ? formatYear(e.endYear, cal) : undefined}</Prop>
          <Prop label="Aliases"><Chips items={list("aliases")} /></Prop>
          <Prop label="Species">{str("species")}</Prop>
          <Prop label="Occupation">{str("occupation")}</Prop>
          <Prop label="Birthplace">{relsOf("BORN_IN", "out").map((r) => r.other.name).join(", ") || undefined}</Prop>
          <Prop label="Residence">{relsOf("LOCATED_IN", "out").map((r) => r.other.name).join(", ") || undefined}</Prop>
          <Prop label="Factions">{relsOf("MEMBER_OF", "out").map((r) => r.other.name).join(", ") || undefined}</Prop>
          <Prop label="Kind">{str("kind")}</Prop>
          <Prop label="Government">{str("government")}</Prop>
          <Prop label="Emblem">{str("emblem")}</Prop>
          <Prop label="Category">{str("category")}</Prop>
          <Prop label="Climate">{str("climate")}</Prop>
          <Prop label="Population">{str("population")}</Prop>
          <Prop label="Material">{str("material")}</Prop>
          <Prop label="Timeline of origin">{e.timeline.isMain ? undefined : <span className="text-violet">{e.timeline.name} (branch only)</span>}</Prop>
        </dl>
        {e.placements.length ? (
          <Link href={w(`/atlas?focus=${e.id}`)} className="wf-panel flex items-center gap-2 p-3 text-sm hover:border-gold-dim"><Map className="size-4 text-gold" /> Show on {e.placements[0]!.map.title}</Link>
        ) : null}
        {type === "CHARACTER" ? (
          <AiAssistPanel worldId={worldId} entityId={e.id} entityVersion={e.version} ai={publicAiStatus()} canUse={ctx.can("ai:use") && ctx.settings.aiEnabled} entityOptions={entityOpts} />
        ) : null}
      </aside>
    </div>
  );

  const biography = (
    <div className="grid gap-6 lg:grid-cols-2">
      {type === "CHARACTER" ? (
        <>
          <div className="flex flex-col gap-5">
            <Prose title="Personality" text={str("personality")} />
            {(["motivations", "fears", "strengths", "flaws", "beliefs", "values", "turningPoints"] as const).map((k) =>
              list(k)?.length ? <section key={k}><h3 className="wf-eyebrow mb-1.5">{humanize(k.replace(/([A-Z])/g, "_$1"))}</h3><Chips items={list(k)} /></section> : null,
            )}
          </div>
          <div className="flex flex-col gap-5">
            <Prose title="Backstory" text={str("backstory")} />
            <Prose title="Goals" text={str("goals")} />
            <Prose title="Internal conflict" text={str("internalConflict")} />
            <Prose title="External conflict" text={str("externalConflict")} />
            <Prose title="Character arc" text={str("arc")} />
            <Prose title="Secrets" text={str("secrets")} />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-5 lg:col-span-2">
          {["ideology", "reputation", "internalDivisions", "secretObjectives", "powers", "origin", "notes"].map((k) => <Prose key={k} title={humanize(k.replace(/([A-Z])/g, "_$1"))} text={str(k)} />)}
          {["resources", "notableFeatures"].map((k) => (list(k)?.length ? <section key={k}><h3 className="wf-eyebrow mb-1.5">{humanize(k.replace(/([A-Z])/g, "_$1"))}</h3><Chips items={list(k)} /></section> : null))}
          {Array.isArray(attrs.properties) && (attrs.properties as { key: string; value: string }[]).length ? (
            <dl className="wf-panel grid gap-3 p-4 sm:grid-cols-2">
              {(attrs.properties as { key: string; value: string }[]).map((p) => <Prop key={p.key} label={p.key}>{p.value}</Prop>)}
            </dl>
          ) : null}
        </div>
      )}
    </div>
  );

  const timelineTab = (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Viewing in:</span>
        {ctx.timelines.filter((t) => t.status === "ACTIVE").map((t) => (
          <Link key={t.id} href={`?tl=${t.id}#timeline`} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs", t.id === timeline.id ? "border-gold/60 bg-gold/10 text-gold" : "border-border text-text-2 hover:border-border-strong")}>
            {t.isMain ? null : <GitBranch className="size-3" />} {t.name}
          </Link>
        ))}
      </div>
      {!resolved ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted">This record does not exist in “{timeline.name}”.</p>
      ) : (
        <>
          {snapshot.overridden.has(e.id) ? (
            <p className="mb-3 rounded-md border border-violet/40 bg-violet/10 px-3 py-2 text-xs text-[#b9afdc]">
              In “{timeline.name}” this record differs from its parent timeline: status {humanize(resolved.status).toLowerCase()}{resolved.endYear != null ? `, ends ${formatYear(resolved.endYear, cal)}` : ""}.
            </p>
          ) : null}
          {entries.length === 0 ? <p className="text-sm text-muted">No dated events or relationships yet.</p> : (
            <ol className="relative flex flex-col gap-3 border-l border-border pl-5">
              {entries.map((en, i) => (
                <li key={i} className="relative">
                  <span className={cn("absolute -left-[26px] top-1 size-2.5 rotate-45 border", en.kind === "event" ? "border-gold bg-gold/30" : en.kind === "life" ? "border-text-2 bg-surface-3" : "border-border-strong bg-bg")} aria-hidden="true" />
                  <div className="text-xs text-muted">{formatYear(en.year, cal)} {en.modified ? <Badge tone="violet" className="ml-1">branch change</Badge> : null}</div>
                  <div className="text-sm text-text-2">{en.label}</div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );

  const appearances = (
    <div>
      {e.participation.length === 0 ? <p className="text-sm text-muted">Not recorded in any event yet. Add {e.name} as a participant from an event.</p> : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {e.participation.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Diamond className="size-4 text-gold-dim" aria-hidden="true" />
              <Link href={w(`/events/${p.event.id}`)} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-gold">{p.event.title}</Link>
              <Badge>{p.role.toLowerCase()}</Badge>
              {p.event.location ? <span className="text-xs text-muted">{p.event.location.name}</span> : null}
              <span className="text-xs text-muted">{formatEventDate(p.event, cal)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const lore = e.loreLinks.length === 0 ? (
    <p className="text-sm text-muted">No lore documents reference this record. {canWrite ? <Link href={w("/codex/new")} className="text-gold hover:underline">Write one</Link> : null}</p>
  ) : (
    <ul className="grid gap-2 sm:grid-cols-2">
      {e.loreLinks.map((l) => (
        <li key={l.id}><Link href={w(`/codex/${l.document.id}`)} className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3 text-sm hover:border-gold-dim"><BookOpen className="size-4 text-gold-dim" /> {l.document.title} <span className="ml-auto text-2xs uppercase text-muted">{l.document.category.replace("_", " ").toLowerCase()}</span></Link></li>
      ))}
    </ul>
  );

  const assets = e.assetLinks.length === 0 ? (
    <p className="text-sm text-muted">No images or documents attached. <Link href={w(`/assets?attach=${e.id}`)} className="text-gold hover:underline">Open the asset library</Link> to upload and link one.</p>
  ) : (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {e.assetLinks.map((l) => (
        <li key={l.id} className="overflow-hidden rounded-lg border border-border bg-surface">
          {l.asset.mimeType.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element -- served from our authenticated asset route
            <img src={`/api/assets/${l.asset.id}?thumb=1`} alt={l.asset.altText || l.asset.filename} className="aspect-square w-full object-cover" />
          ) : <div className="flex aspect-square items-center justify-center"><Images className="size-6 text-muted" /></div>}
          <div className="truncate px-2 py-1.5 text-xs text-text-2">{l.asset.filename}</div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted">
        <Link href={w("")} className="hover:text-text">{ctx.universe.name}</Link> / <Link href={w(`/${meta.route ?? "entities"}`)} className="hover:text-text">{meta.route === "entities" ? "Other entities" : meta.plural}</Link>
      </nav>
      <header className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {type === "CHARACTER" ? <Avatar name={e.name} src={e.portrait} size={72} /> : (
            <span className="flex size-[72px] shrink-0 items-center justify-center rounded-xl border border-border bg-surface"><EntityIcon type={type} className="size-8" /></span>
          )}
          <div className="min-w-0">
            <div className="wf-eyebrow flex flex-wrap items-center gap-2">
              <span>{type === "CUSTOM" ? e.customTypeLabel : meta.label}</span>
              <span>·</span>
              <span>{humanize(e.status)}</span>
              {e.beginYear != null ? <><span>·</span><span>{formatYear(e.beginYear, cal)}{e.endYear != null ? ` – ${formatYear(e.endYear, cal)}` : ""}</span></> : null}
              <CanonBadge status={e.canonStatus} />
              {e.archivedAt ? <Badge tone="warning">archived</Badge> : null}
            </div>
            <h1 className="mt-1 font-serif text-4xl font-semibold leading-tight">{e.name}</h1>
            {e.summary ? <p className="mt-1.5 max-w-2xl text-text-2">{e.summary}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" size="sm"><Link href={w(`/graph?focus=${e.id}`)}><Network /> Graph</Link></Button>
          {canWrite && type === "CHARACTER" ? <Button asChild variant="ghost" size="sm"><Link href={w(`/simulator`)}><Flame /> Simulate</Link></Button> : null}
          {canWrite ? <ArchiveButton worldId={worldId} id={e.id} kind="ENTITY" archived={!!e.archivedAt} label={e.name} /> : null}
          {canWrite ? <Button asChild variant="primary" size="sm"><Link href={`${entityHref(worldId, type, e.id)}/edit`}><Pencil /> Edit</Link></Button> : null}
        </div>
      </header>

      <div className="mt-8">
        <DetailTabs
          tabs={[
            { id: "overview", label: "Overview", content: overview },
            { id: "biography", label: type === "CHARACTER" ? "Biography" : "Details", content: biography },
            { id: "relationships", label: "Relationships", count: rows.length, content: <RelationshipManager worldId={worldId} entity={{ id: e.id, name: e.name, type }} rows={rows} entityOptions={entityOpts} eventOptions={eventOpts} customTypes={customTypes} canWrite={canWrite} /> },
            { id: "timeline", label: "Timeline", content: timelineTab },
            { id: "appearances", label: "Appearances", count: e.participation.length, content: appearances },
            { id: "lore", label: "Lore references", count: e.loreLinks.length, content: lore },
            { id: "assets", label: "Assets", count: e.assetLinks.length, content: assets },
            {
              id: "history",
              label: "Revision history",
              count: revisions.length,
              content: (
                <RevisionHistory
                  worldId={worldId}
                  recordId={e.id}
                  recordType="ENTITY"
                  canRestore={canWrite}
                  revisions={revisions.map((r) => ({ id: r.id, version: r.version, summary: r.summary, createdAt: r.createdAt.toISOString(), author: r.author?.name ?? null, snapshot: r.snapshot as Record<string, unknown> }))}
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

export function assertEntityType(t: string | undefined): EntityTypeKey {
  if (!t) notFound();
  return t as EntityTypeKey;
}
