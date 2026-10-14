import Link from "next/link";
import { Pencil, Flame, MapPin, GitBranch, Clock3, BookOpen } from "lucide-react";
import { entityHref, humanize, relationshipMeta, type DependencyTypeKey, type EntityTypeKey } from "@/domain/catalog";
import { formatEventDate } from "@/domain/chronology";
import { getWorldContext, guard } from "@/server/page-context";
import { getEvent, eventOptions } from "@/server/services/events";
import { listRevisions } from "@/server/services/revisions";
import { Button } from "@/components/ui/button";
import { Badge, CanonBadge } from "@/components/ui/badge";
import { EntityIcon } from "@/components/world/entity-visual";
import { DetailTabs } from "@/components/common/detail-tabs";
import { RevisionHistory } from "@/components/common/revision-history";
import { ArchiveButton } from "@/components/common/archive-button";
import { DependencyManager } from "@/components/events/dependency-manager";

export default async function EventPage(props: PageProps<"/worlds/[worldId]/events/[eventId]">) {
  const { worldId, eventId } = await props.params;
  const ctx = await getWorldContext(worldId);
  const [{ event: e }, events, revisions] = await Promise.all([
    guard(() => getEvent(ctx.user.id, worldId, eventId)),
    eventOptions(ctx.user.id, worldId),
    listRevisions(worldId, "EVENT", eventId),
  ]);
  const cal = ctx.calendar;
  const canWrite = ctx.can("content:write");
  const w = (p: string) => `/worlds/${worldId}${p}`;
  const byRole = new Map<string, typeof e.participants>();
  for (const p of e.participants) byRole.set(p.role, [...(byRole.get(p.role) ?? []), p]);

  const overview = (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-6">
        {e.description ? <p className="whitespace-pre-line leading-relaxed text-text-2">{e.description}</p> : <p className="text-sm text-muted">No description yet.</p>}
        <section>
          <h2 className="wf-eyebrow mb-2">Participants</h2>
          {e.participants.length === 0 ? <p className="text-sm text-muted">No participants recorded.</p> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {[...byRole.entries()].map(([role, list]) => (
                <div key={role} className="wf-panel p-3">
                  <div className="mb-1.5 text-xs text-muted">{humanize(role)}</div>
                  <ul className="flex flex-col gap-1">
                    {list.map((p) => (
                      <li key={p.id}>
                        <Link href={entityHref(worldId, p.entity.type as EntityTypeKey, p.entity.id)} className="flex items-center gap-2 text-sm hover:text-gold">
                          <EntityIcon type={p.entity.type as EntityTypeKey} /> {p.entity.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
        {e.originOf.length || e.endOf.length ? (
          <section>
            <h2 className="wf-eyebrow mb-2">Relationships shaped by this event</h2>
            <ul className="flex flex-col gap-1.5 text-sm">
              {e.originOf.map((r) => <li key={r.id} className="flex flex-wrap items-center gap-2"><Badge tone="success">began</Badge> {r.source.name} <span className="text-muted">{relationshipMeta(r.type).label.toLowerCase()}</span> {r.target.name}</li>)}
              {e.endOf.map((r) => <li key={r.id} className="flex flex-wrap items-center gap-2"><Badge tone="danger">ended</Badge> {r.source.name} <span className="text-muted">{relationshipMeta(r.type).label.toLowerCase()}</span> {r.target.name}</li>)}
            </ul>
          </section>
        ) : null}
      </div>
      <aside className="flex flex-col gap-3">
        <dl className="wf-panel grid gap-3 p-4 text-sm">
          <div><dt className="text-xs text-muted">Date</dt><dd>{formatEventDate(e, cal)}</dd></div>
          <div><dt className="text-xs text-muted">Precision</dt><dd>{humanize(e.precision)}</dd></div>
          <div><dt className="text-xs text-muted">Type</dt><dd>{humanize(e.eventType)}</dd></div>
          <div><dt className="text-xs text-muted">Importance</dt><dd>{"◆".repeat(e.importance)}<span className="text-border-strong">{"◆".repeat(5 - e.importance)}</span></dd></div>
          {e.location ? <div><dt className="text-xs text-muted">Location</dt><dd><Link href={entityHref(worldId, "LOCATION", e.location.id)} className="inline-flex items-center gap-1 hover:text-gold"><MapPin className="size-3.5" /> {e.location.name}</Link></dd></div> : null}
          <div><dt className="text-xs text-muted">Timeline</dt><dd className="flex items-center gap-1">{e.timeline.isMain ? <Clock3 className="size-3.5 text-gold" /> : <GitBranch className="size-3.5 text-violet" />} {e.timeline.name}</dd></div>
        </dl>
        {e.branchPoints.length ? (
          <div className="wf-panel p-4 text-sm">
            <div className="mb-1 text-xs text-muted">Alternate timelines branch here</div>
            {e.branchPoints.map((b) => <Link key={b.id} href={w(`/branches?compare=${b.id}`)} className="flex items-center gap-1.5 hover:text-gold"><GitBranch className="size-3.5 text-violet" /> {b.name}</Link>)}
          </div>
        ) : null}
      </aside>
    </div>
  );

  const deps = [
    ...e.dependsOn.map((d) => ({ id: d.id, type: d.type as DependencyTypeKey, direction: "in" as const, other: { id: d.source.id, title: d.source.title, date: formatEventDate(d.source, cal) } })),
    ...e.enables.map((d) => ({ id: d.id, type: d.type as DependencyTypeKey, direction: "out" as const, other: { id: d.target.id, title: d.target.title, date: formatEventDate(d.target, cal) } })),
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted">
        <Link href={w("")} className="hover:text-text">{ctx.universe.name}</Link> / <Link href={w(`/timeline?focus=${e.id}`)} className="hover:text-text">Chronos</Link>
      </nav>
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="wf-eyebrow flex flex-wrap items-center gap-2">
            <span>{humanize(e.eventType)}</span><span>·</span><span>{formatEventDate(e, cal)}</span>
            <CanonBadge status={e.canonStatus} />
            {e.archivedAt ? <Badge tone="warning">archived</Badge> : null}
          </div>
          <h1 className="mt-1 font-serif text-4xl font-semibold leading-tight">{e.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" size="sm"><Link href={w(`/timeline?focus=${e.id}&tl=${e.timelineId}`)}><Clock3 /> On timeline</Link></Button>
          {canWrite ? <Button asChild variant="secondary" size="sm"><Link href={w(`/simulator?event=${e.id}`)}><Flame /> Simulate a change</Link></Button> : null}
          {canWrite ? <ArchiveButton worldId={worldId} id={e.id} kind="EVENT" archived={!!e.archivedAt} label={e.title} /> : null}
          {canWrite ? <Button asChild variant="primary" size="sm"><Link href={w(`/events/${e.id}/edit`)}><Pencil /> Edit</Link></Button> : null}
        </div>
      </header>
      <div className="mt-8">
        <DetailTabs
          tabs={[
            { id: "overview", label: "Overview", content: overview },
            { id: "causality", label: "Causes & consequences", count: deps.length, content: <DependencyManager worldId={worldId} eventId={e.id} rows={deps} events={events.map((x) => ({ id: x.id, name: x.title, hint: String(x.startYear) }))} canWrite={canWrite} timelineId={e.timelineId} /> },
            {
              id: "lore",
              label: "Lore",
              count: e.loreLinks.length,
              content: e.loreLinks.length ? (
                <ul className="grid gap-2 sm:grid-cols-2">{e.loreLinks.map((l) => <li key={l.id}><Link href={w(`/codex/${l.document.id}`)} className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3 text-sm hover:border-gold-dim"><BookOpen className="size-4 text-gold-dim" /> {l.document.title}</Link></li>)}</ul>
              ) : <p className="text-sm text-muted">No lore documents reference this event. Link it from a document in the Lore Codex.</p>,
            },
            {
              id: "history",
              label: "Revision history",
              count: revisions.length,
              content: <RevisionHistory worldId={worldId} recordId={e.id} recordType="EVENT" canRestore={canWrite} revisions={revisions.map((r) => ({ id: r.id, version: r.version, summary: r.summary, createdAt: r.createdAt.toISOString(), author: r.author?.name ?? null, snapshot: r.snapshot as Record<string, unknown> }))} />,
            },
          ]}
        />
      </div>
    </div>
  );
}
