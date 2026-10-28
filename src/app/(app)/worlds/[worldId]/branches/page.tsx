import Link from "next/link";
import { Clock3, GitBranch, Flame, Minus, Plus, PenLine } from "lucide-react";
import { getWorldContext, guard } from "@/server/page-context";
import { compareWithParent, listTimelines } from "@/server/services/timelines";
import { listChanges } from "@/server/services/changes";
import { eventOptions } from "@/server/services/events";
import { db } from "@/server/db";
import { humanize } from "@/domain/catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { ChangeActions, NewBranchForm, PromoteRecordButton, TimelineAdmin } from "@/components/branches/branch-controls";
import { cn, timeAgo } from "@/lib/utils";

export const metadata = { title: "Alternate timelines" };

function fmt(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

export default async function BranchesPage(props: PageProps<"/worlds/[worldId]/branches">) {
  const { worldId } = await props.params;
  const sp = await props.searchParams;
  const ctx = await getWorldContext(worldId);
  const canBranch = ctx.can("timeline:branch");
  const [timelines, events] = await Promise.all([listTimelines(ctx.user.id, worldId), eventOptions(ctx.user.id, worldId)]);
  const selectedId = typeof sp.compare === "string" ? sp.compare : (timelines.find((t) => !t.isMain) ?? timelines[0])?.id;
  const selected = timelines.find((t) => t.id === selectedId) ?? null;

  const [comparison, changes, branchRecords] = selected
    ? await Promise.all([
        selected.parentId ? guard(() => compareWithParent(ctx.user.id, worldId, selected.id)) : Promise.resolve(null),
        listChanges(ctx.user.id, worldId, selected.id),
        selected.parentId
          ? Promise.all([
              db.historicalEvent.findMany({ where: { timelineId: selected.id, archivedAt: null }, select: { id: true, title: true } }),
              db.entity.findMany({ where: { timelineId: selected.id, archivedAt: null }, select: { id: true, name: true } }),
              db.relationship.findMany({ where: { timelineId: selected.id, archivedAt: null }, select: { id: true, type: true, source: { select: { name: true } }, target: { select: { name: true } } } }),
            ])
          : Promise.resolve(null),
      ])
    : [null, [], null];

  // Tree ordering: parents before children.
  const children = new Map<string | null, typeof timelines>();
  for (const t of timelines) children.set(t.parentId, [...(children.get(t.parentId) ?? []), t]);
  const ordered: { t: (typeof timelines)[number]; depth: number }[] = [];
  const walk = (pid: string | null, depth: number) => {
    for (const t of children.get(pid) ?? []) {
      ordered.push({ t, depth });
      walk(t.id, depth + 1);
    }
  };
  walk(null, 0);
  const diffs = comparison?.diffs ?? [];
  const counts = { added: diffs.filter((d) => d.status === "added").length, removed: diffs.filter((d) => d.status === "removed").length, modified: diffs.filter((d) => d.status === "modified").length };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow={ctx.universe.name}
        title="Alternate timelines"
        description="Branches inherit every record from their parent and store only their own changes. Canon is never modified by a branch."
        actions={canBranch ? <NewBranchForm worldId={worldId} timelines={timelines.filter((t) => t.status === "ACTIVE").map((t) => ({ id: t.id, name: t.name }))} events={events.map((e) => ({ id: e.id, name: e.title, hint: String(e.startYear) }))} /> : null}
      />
      <div className="mt-6 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <nav aria-label="Timelines" className="flex flex-col gap-1">
          {ordered.map(({ t, depth }) => (
            <Link
              key={t.id}
              href={`?compare=${t.id}`}
              className={cn("rounded-lg border px-3 py-2.5 transition-colors", t.id === selectedId ? "border-gold/50 bg-surface" : "border-transparent hover:bg-surface", t.status === "ARCHIVED" && "opacity-60")}
              style={{ marginLeft: depth * 16 }}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                {t.isMain ? <Clock3 className="size-4 text-gold" /> : <GitBranch className="size-4 text-violet" />}
                <span className="truncate">{t.name}</span>
                {t.isMain ? <Badge tone="gold">canon</Badge> : null}
                {t.status === "ARCHIVED" ? <Badge>archived</Badge> : null}
              </div>
              <div className="mt-0.5 text-2xs text-muted">
                {t.branchEvent ? `Diverges at “${t.branchEvent.title}” · ` : ""}{t._count.changes} change{t._count.changes === 1 ? "" : "s"}
              </div>
            </Link>
          ))}
        </nav>

        {selected ? (
          <div className="flex min-w-0 flex-col gap-6">
            <section className="wf-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="wf-eyebrow">{selected.isMain ? "Main timeline" : `Branch of ${selected.parent?.name ?? "?"}`}</div>
                  <h2 className="mt-1 font-serif text-3xl font-semibold">{selected.name}</h2>
                  {selected.description ? <p className="mt-1 max-w-2xl text-sm text-text-2">{selected.description}</p> : null}
                  {selected.branchEvent ? <p className="mt-2 text-xs text-muted">Point of divergence: <Link href={`/worlds/${worldId}/events/${selected.branchEvent.id}`} className="text-gold hover:underline">{selected.branchEvent.title}</Link></p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="secondary"><Link href={`/worlds/${worldId}/timeline?tl=${selected.id}`}><Clock3 /> Open in Chronos</Link></Button>
                  <Button asChild size="sm" variant="secondary"><Link href={`/worlds/${worldId}/graph?tl=${selected.id}`}>Graph</Link></Button>
                  {canBranch && selected.status === "ACTIVE" ? <Button asChild size="sm" variant="secondary"><Link href={`/worlds/${worldId}/simulator?new=1&tl=${selected.id}`}><Flame /> Simulate here</Link></Button> : null}
                  {canBranch ? <TimelineAdmin worldId={worldId} timeline={{ id: selected.id, name: selected.name, description: selected.description, status: selected.status, isMain: selected.isMain }} /> : null}
                </div>
              </div>
            </section>

            {comparison ? (
              <section aria-labelledby="cmp">
                <h2 id="cmp" className="wf-eyebrow mb-2">Compared with {selected.parent?.name}</h2>
                <div className="mb-3 flex flex-wrap gap-2 text-xs">
                  <Badge tone="success"><Plus className="size-3" /> {counts.added} added</Badge>
                  <Badge tone="danger"><Minus className="size-3" /> {counts.removed} removed</Badge>
                  <Badge tone="violet"><PenLine className="size-3" /> {counts.modified} modified</Badge>
                  <span className="text-muted">Everything else is inherited unchanged.</span>
                </div>
                {diffs.length === 0 ? <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">This branch has no differences from its parent yet.</p> : (
                  <ul className="flex flex-col gap-2">
                    {diffs.map((d) => (
                      <li key={`${d.kind}:${d.id}`} className="rounded-lg border border-border bg-surface p-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <Badge tone={d.status === "added" ? "success" : d.status === "removed" ? "danger" : "violet"}>{d.status}</Badge>
                          <Badge>{d.kind.toLowerCase()}</Badge>
                          {d.kind === "EVENT" ? <Link href={`/worlds/${worldId}/events/${d.id}`} className="font-medium hover:text-gold">{d.label}</Link> : d.kind === "ENTITY" ? <Link href={`/worlds/${worldId}/entities/${d.id}?tl=${selected.id}#timeline`} className="font-medium hover:text-gold">{d.label}</Link> : <span className="font-medium">{d.label}</span>}
                        </div>
                        {d.fields.length ? (
                          <table className="mt-2 w-full text-xs">
                            <tbody className="divide-y divide-border">
                              {d.fields.map((f) => (
                                <tr key={f.field}>
                                  <td className="w-40 py-1 pr-2 text-muted">{humanize(f.field.replace(/([A-Z])/g, "_$1"))}</td>
                                  <td className="py-1 pr-2 text-text-2 line-through decoration-danger/50">{fmt(f.before)}</td>
                                  <td className="py-1 text-gold">{fmt(f.after)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}

            {branchRecords && (branchRecords[0].length || branchRecords[1].length || branchRecords[2].length) ? (
              <section>
                <h2 className="wf-eyebrow mb-2">Records that exist only in this branch</h2>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {branchRecords[0].map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm"><span>◆ {r.title}</span>{canBranch ? <PromoteRecordButton worldId={worldId} timelineId={selected.id} type="EVENT" recordId={r.id} /> : null}</li>
                  ))}
                  {branchRecords[1].map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm"><span>{r.name}</span>{canBranch ? <PromoteRecordButton worldId={worldId} timelineId={selected.id} type="ENTITY" recordId={r.id} /> : null}</li>
                  ))}
                  {branchRecords[2].map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm"><span>{r.source.name} — {humanize(r.type).toLowerCase()} — {r.target.name}</span>{canBranch ? <PromoteRecordButton worldId={worldId} timelineId={selected.id} type="RELATIONSHIP" recordId={r.id} /> : null}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="history">
              <h2 id="history" className="wf-eyebrow mb-2">Change history</h2>
              {changes.length === 0 ? <p className="text-sm text-muted">No engine changes recorded in this timeline. Direct edits are kept in each record&apos;s revision history.</p> : (
                <ol className="flex flex-col gap-2">
                  {changes.map((c) => (
                    <li key={c.id} className={cn("flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-surface p-3", c.status !== "ACCEPTED" && "opacity-60")}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={c.status === "ACCEPTED" ? "success" : "neutral"}>{c.status.toLowerCase()}</Badge>
                          <Badge>{c.targetType.toLowerCase()} {c.changeType.toLowerCase()}</Badge>
                          <Badge tone={c.appliedToBase ? "gold" : "violet"}>{c.appliedToBase ? "written to record" : "branch overlay"}</Badge>
                          {c.promotedFromId ? <Badge tone="violet">promoted</Badge> : null}
                        </div>
                        <p className="mt-1 text-sm">{c.reason || "Change"}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {Object.entries((c.proposedState ?? {}) as Record<string, unknown>).map(([k, v]) => `${k}: ${fmt(((c.previousState ?? {}) as Record<string, unknown>)[k])} → ${fmt(v)}`).join(" · ") || (c.changeType === "DELETE" ? "removed in this timeline" : "")}
                        </p>
                        <p className="mt-0.5 text-2xs text-muted">{timeAgo(c.createdAt)}{c.proposal ? <> · from <Link className="hover:text-gold" href={`/worlds/${worldId}/simulator?proposal=${c.proposal.id}`}>{c.proposal.title}</Link></> : null}</p>
                      </div>
                      {canBranch && c.status === "ACCEPTED" ? <ChangeActions worldId={worldId} changeId={c.id} canPromote={!selected.isMain} label={c.reason} /> : null}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
