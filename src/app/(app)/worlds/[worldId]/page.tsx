import Link from "next/link";
import {
  UserPlus, Shield, MapPin, Diamond, BookOpen, Network, Clock3, Flame, TriangleAlert, CheckCircle2, ArrowRight, GitBranch, Settings,
} from "lucide-react";
import { getWorldContext, guard, pickTimeline } from "@/server/page-context";
import { getUniverseOverview } from "@/server/services/universes";
import { loadSnapshot } from "@/server/services/snapshot";
import { checkConsistency, RULE_DESCRIPTIONS } from "@/domain/consistency";
import { ENTITY_TYPE_META, GENRE_LABELS, entityHref, type EntityTypeKey, type GenreKey } from "@/domain/catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/misc";
import { EntityIcon } from "@/components/world/entity-visual";
import { RecordReportButton } from "@/components/overview/record-report-button";
import { AiOutlinePanel } from "@/components/ai/ai-outline-panel";
import { publicAiStatus } from "@/server/ai/config";
import { timeAgo } from "@/lib/utils";

export default async function WorldOverviewPage(props: PageProps<"/worlds/[worldId]">) {
  const { worldId } = await props.params;
  const sp = await props.searchParams;
  const ctx = await getWorldContext(worldId);
  const o = await guard(() => getUniverseOverview(ctx.user.id, worldId));
  const timeline = pickTimeline(ctx, undefined);
  const findings = checkConsistency(await loadSnapshot(worldId, timeline.id), ctx.settings, ctx.calendar);
  const canWrite = ctx.can("content:write");
  const u = o.universe;
  const w = (p: string) => `/worlds/${worldId}${p}`;
  const otherEntities = Object.entries(o.counts).filter(([t]) => !["CHARACTER", "FACTION", "LOCATION", "ARTIFACT"].includes(t)).reduce((s, [, n]) => s + n, 0);
  const totalEntities = Object.values(o.counts).reduce((s, n) => s + n, 0);

  const quick = [
    { label: "Create character", icon: UserPlus, href: w("/characters/new"), write: true },
    { label: "Create faction", icon: Shield, href: w("/factions/new"), write: true },
    { label: "Add location", icon: MapPin, href: w("/locations/new"), write: true },
    { label: "Add historical event", icon: Diamond, href: w("/events/new"), write: true },
    { label: "Write lore", icon: BookOpen, href: w("/codex/new"), write: true },
    { label: "Open relationship graph", icon: Network, href: w("/graph") },
    { label: "Open timeline", icon: Clock3, href: w("/timeline") },
    { label: "Simulate an event change", icon: Flame, href: w("/simulator") },
  ].filter((q) => !q.write || canWrite);

  return (
    <div className="animate-fade-in">
      <section className="relative isolate overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center opacity-70"
          style={{ backgroundImage: u.coverImage ? `url(${u.coverImage})` : "radial-gradient(ellipse at 25% 0%, #2d2922, #101116 70%)" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-bg via-bg/85 to-bg/40" aria-hidden="true" />
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="wf-eyebrow flex flex-wrap items-center gap-2">
              <span>{u.genre === "CUSTOM" && u.customGenre ? u.customGenre : GENRE_LABELS[u.genre as GenreKey]}</span>
              {u.currentEra ? <><span aria-hidden="true">·</span><span>{u.currentEra}</span></> : null}
              <Badge tone="neutral">{o.role.toLowerCase()}</Badge>
            </div>
            <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight md:text-5xl">{u.name}</h1>
            <p className="mt-3 text-sm leading-relaxed text-text-2 md:text-base">{u.description || "No description yet. Add one in universe settings."}</p>
            {u.mainConflict ? <p className="mt-3 text-sm text-text-2"><span className="text-gold-dim">Main conflict — </span>{u.mainConflict}</p> : null}
          </div>
          {ctx.can("universe:settings") ? (
            <Button asChild variant="secondary" size="sm"><Link href={w("/settings")}><Settings /> Universe settings</Link></Button>
          ) : null}
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-bg/70 p-1 backdrop-blur sm:grid-cols-5 lg:grid-cols-9">
            <StatTile label="Characters" value={o.counts.CHARACTER ?? 0} href={w("/characters")} />
            <StatTile label="Factions" value={o.counts.FACTION ?? 0} href={w("/factions")} />
            <StatTile label="Locations" value={o.counts.LOCATION ?? 0} href={w("/locations")} />
            <StatTile label="Artifacts" value={o.counts.ARTIFACT ?? 0} href={w("/artifacts")} />
            <StatTile label="Other entities" value={otherEntities} href={w("/entities")} />
            <StatTile label="Events" value={o.eventCount} href={w("/timeline")} />
            <StatTile label="Relationships" value={o.relCount} href={w("/graph")} />
            <StatTile label="Timelines" value={o.timelineCount} href={w("/branches")} />
            <StatTile label="Lore documents" value={o.loreCount} href={w("/codex")} />
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          {sp.outline ? <AiOutlinePanel worldId={worldId} ai={publicAiStatus()} canWrite={canWrite} /> : null}

          <section aria-labelledby="quick-heading">
            <h2 id="quick-heading" className="wf-eyebrow mb-3">Quick actions</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {quick.map((q) => (
                <Link key={q.label} href={q.href} className="group flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-gold-dim">
                  <q.icon className="size-5 text-gold-dim group-hover:text-gold" aria-hidden="true" />
                  <span className="text-sm">{q.label}</span>
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="continue-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="continue-heading" className="wf-eyebrow">Continue working</h2>
            </div>
            {totalEntities === 0 && o.eventCount === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="font-serif text-xl">An empty archive</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-text-2">Start with a character or a faction — then connect them, record an event, and watch the graph and timeline come alive.</p>
                {canWrite ? (
                  <div className="mt-4 flex justify-center gap-2">
                    <Button asChild variant="primary" size="sm"><Link href={w("/characters/new")}>Create a character</Link></Button>
                    <Button asChild variant="secondary" size="sm"><Link href={w("/factions/new")}>Create a faction</Link></Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {o.recentEntities.map((e) => (
                  <Link key={e.id} href={entityHref(worldId, e.type as EntityTypeKey, e.id)} className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-gold-dim">
                    <EntityIcon type={e.type as EntityTypeKey} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{e.name}</div>
                      <div className="truncate text-xs text-muted">{ENTITY_TYPE_META[e.type as EntityTypeKey].label} · edited {timeAgo(e.updatedAt)}</div>
                    </div>
                  </Link>
                ))}
                {o.recentEvents.map((e) => (
                  <Link key={e.id} href={w(`/events/${e.id}`)} className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-gold-dim">
                    <Diamond className="mt-0.5 size-4 text-text-2" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{e.title}</div>
                      <div className="truncate text-xs text-muted">Event · edited {timeAgo(e.updatedAt)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="activity-heading" className="wf-panel p-4">
            <h2 id="activity-heading" className="wf-eyebrow mb-3">Recent activity</h2>
            {o.activity.length === 0 ? (
              <p className="text-sm text-muted">No activity yet.</p>
            ) : (
              <ol className="relative flex flex-col gap-3 border-l border-border pl-4">
                {o.activity.map((a) => (
                  <li key={a.id} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-border-strong" aria-hidden="true" />
                    <span className="text-text-2">{a.summary}</span>
                    <span className="ml-2 text-xs text-muted">{a.actor?.name ?? "Someone"} · {timeAgo(a.createdAt)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <section aria-labelledby="warnings-heading" className="wf-panel p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="warnings-heading" className="wf-eyebrow">Consistency · {timeline.name}</h2>
              <Badge tone={findings.some((f) => f.severity === "ERROR") ? "danger" : findings.length ? "warning" : "success"}>{findings.length} open</Badge>
            </div>
            {findings.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-text-2"><CheckCircle2 className="size-4 text-success" /> No contradictions detected by the enabled rules.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {findings.slice(0, 6).map((f) => (
                  <li key={f.key} className="rounded-md border border-border bg-bg-2 p-2.5">
                    <div className="flex items-start gap-2">
                      <TriangleAlert className={f.severity === "ERROR" ? "mt-0.5 size-4 shrink-0 text-danger" : "mt-0.5 size-4 shrink-0 text-warning"} aria-hidden="true" />
                      <div className="min-w-0">
                        <div className="text-sm leading-snug">{f.title}</div>
                        <div className="mt-0.5 text-xs text-muted">{f.explanation}</div>
                        <div className="mt-1 text-2xs uppercase tracking-wider text-muted">{RULE_DESCRIPTIONS[f.rule].title}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
              <span>{o.lastReport ? `Last recorded report ${timeAgo(o.lastReport.createdAt)}` : "No recorded report yet"}</span>
              <RecordReportButton worldId={worldId} timelineId={timeline.id} />
            </div>
            {ctx.can("universe:settings") ? (
              <Link href={w("/settings#rules")} className="mt-2 block text-xs text-gold hover:underline">Configure rules →</Link>
            ) : null}
          </section>

          <section className="wf-panel p-4">
            <h2 className="wf-eyebrow mb-3">Timelines</h2>
            <ul className="flex flex-col gap-1.5">
              {ctx.timelines.filter((t) => t.status === "ACTIVE").map((t) => (
                <li key={t.id}>
                  <Link href={w(`/timeline?tl=${t.id}`)} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2">
                    {t.isMain ? <Clock3 className="size-4 text-gold" /> : <GitBranch className="size-4 text-violet" />}
                    <span className="flex-1 truncate">{t.name}</span>
                    {t.isMain ? <Badge tone="gold">canon</Badge> : null}
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={w("/branches")} className="mt-3 flex items-center gap-1 text-xs text-gold hover:underline">Compare and manage timelines <ArrowRight className="size-3" /></Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
