"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, CheckCheck, GitBranch, Info, Pencil, RefreshCw, Sparkles, Trash2, TriangleAlert, X, CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { BASIS_LABELS, IMPACT_CATEGORIES, IMPACT_CATEGORY_LABELS, type ImpactBasis, type ImpactCategory } from "@/domain/impact";
import { humanize } from "@/domain/catalog";
import { addAiPossibilitiesAction, analyzeProposalAction, commitProposalAction, discardProposalAction, reviewAllAction, reviewItemAction } from "@/server/actions/engine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface ReviewItem {
  id: string;
  category: ImpactCategory;
  title: string;
  description: string;
  basis: ImpactBasis;
  strength: string;
  affected: { type: string; id: string; label: string }[];
  evidence: { type: string; id: string; label: string; note?: string }[];
  suggestedChange: { targetType: string; targetId: string; changeType: "UPDATE" | "DELETE"; patch: Record<string, unknown>; before?: Record<string, unknown> } | null;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
}

interface Props {
  worldId: string;
  proposal: {
    id: string;
    title: string;
    rationale: string;
    status: "DRAFT" | "ANALYZED" | "COMMITTED" | "DISCARDED";
    timeline: { id: string; name: string; isMain: boolean };
    sourceEvent: { id: string; title: string };
    committedTimelineId: string | null;
    stale: boolean;
  };
  report: {
    fieldChanges: { field: string; before: unknown; after: unknown }[];
    cancelled: boolean;
    newFindings: { key: string; title: string }[];
    resolvedFindings: { key: string; title: string; explanation: string }[];
    stats: { eventsTraversed: number; entitiesTouched: number; depthLimit: number; truncated: boolean };
    analyzedAt: string;
  } | null;
  items: ReviewItem[];
  ai: { available: boolean; demo: boolean };
  canWrite: boolean;
}

const BASIS_TONE: Record<ImpactBasis, "gold" | "violet" | "neutral" | "warning" | "success"> = {
  PRIMARY_CHANGE: "gold",
  DETERMINISTIC_RULE: "gold",
  EXPLICIT_DEPENDENCY: "violet",
  EXISTING_RELATIONSHIP: "neutral",
  AI_INFERENCE: "warning",
  UNVERIFIED: "warning",
};

const STRENGTH_LABEL: Record<string, string> = { DIRECT: "Direct", LIKELY: "Likely", POSSIBLE: "Possible", QUESTION: "Open question" };

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

function refHref(worldId: string, r: { type: string; id: string }) {
  if (r.type === "ENTITY") return `/worlds/${worldId}/entities/${r.id}`;
  if (r.type === "EVENT") return `/worlds/${worldId}/events/${r.id}`;
  if (r.type === "LORE") return `/worlds/${worldId}/codex/${r.id}`;
  return null;
}

export function ProposalReview({ worldId, proposal, report, items, ai, canWrite }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; conflict: boolean } | null>(null);
  const [target, setTarget] = useState<"CURRENT" | "NEW_BRANCH">(proposal.timeline.isMain ? "NEW_BRANCH" : "CURRENT");
  const [branchName, setBranchName] = useState(`What if: ${proposal.title}`.slice(0, 120));
  const [confirmCommit, setConfirmCommit] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "CHANGES">("ALL");

  const open = proposal.status === "ANALYZED" && canWrite;
  const grouped = useMemo(() => {
    const m = new Map<ImpactCategory, ReviewItem[]>();
    for (const i of items) {
      if (filter === "PENDING" && i.status !== "PENDING") continue;
      if (filter === "CHANGES" && !i.suggestedChange) continue;
      m.set(i.category, [...(m.get(i.category) ?? []), i]);
    }
    return IMPACT_CATEGORIES.filter((c) => m.has(c)).map((c) => [c, m.get(c)!] as const);
  }, [items, filter]);

  const accepted = items.filter((i) => i.status === "ACCEPTED" && i.suggestedChange).length;
  const pendingChanges = items.filter((i) => i.status === "PENDING" && i.suggestedChange).length;
  const run = (key: string, fn: () => Promise<{ ok: boolean; error?: string; code?: string } & Record<string, unknown>>, success?: string) =>
    start(async () => {
      setBusy(key);
      setError(null);
      const r = await fn();
      setBusy(null);
      if (!r.ok) {
        setError({ message: r.error ?? "Something went wrong.", conflict: r.code === "CONFLICT" });
        return;
      }
      if (success) toast.success(success);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-6">
      <header className="wf-panel overflow-hidden">
        <div className="border-b border-border p-5">
          <div className="wf-eyebrow flex flex-wrap items-center gap-2">
            <span>Proposal</span>
            <span>·</span>
            <span>{proposal.timeline.isMain ? "Prime canon" : `Branch: ${proposal.timeline.name}`}</span>
            <Badge tone={proposal.status === "COMMITTED" ? "success" : proposal.status === "DISCARDED" ? "neutral" : "gold"}>{proposal.status.toLowerCase()}</Badge>
          </div>
          <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight">{proposal.title}</h1>
          {proposal.rationale ? <p className="mt-1 text-sm text-text-2">{proposal.rationale}</p> : null}
        </div>
        {report ? (
          <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <div className="wf-eyebrow mb-2">The change to <Link href={`/worlds/${worldId}/events/${proposal.sourceEvent.id}`} className="normal-case tracking-normal text-text hover:text-gold">“{proposal.sourceEvent.title}”</Link></div>
              {report.cancelled ? (
                <p className="text-sm"><span className="text-[#e7a3a3]">The event is removed from this timeline.</span></p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {report.fieldChanges.map((f) => (
                    <li key={f.field} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="w-28 text-muted">{humanize(f.field.replace(/([A-Z])/g, "_$1"))}</span>
                      <span className="text-text-2 line-through decoration-danger/60">{fmt(f.before)}</span>
                      <ArrowRight className="size-3.5 text-gold" />
                      <span className="text-gold">{fmt(f.after)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <dl className="grid grid-cols-3 gap-4 text-center lg:min-w-80">
              <div><dt className="text-2xs text-muted">Impacts</dt><dd className="font-serif text-2xl">{items.length}</dd></div>
              <div><dt className="text-2xs text-muted">New contradictions</dt><dd className={cn("font-serif text-2xl", report.newFindings.length ? "text-warning" : "")}>{report.newFindings.length}</dd></div>
              <div><dt className="text-2xs text-muted">Events traversed</dt><dd className="font-serif text-2xl">{Math.max(0, report.stats.eventsTraversed - 1)}</dd></div>
            </dl>
          </div>
        ) : null}
        {report?.resolvedFindings.length ? (
          <div className="border-t border-border px-5 py-3 text-sm text-[#a9cfa5]">
            <CircleCheck className="mr-1.5 inline size-4" />Resolves {report.resolvedFindings.length} existing warning{report.resolvedFindings.length === 1 ? "" : "s"}: {report.resolvedFindings.map((f) => f.title).join("; ")}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-bg-2/60 px-5 py-3 text-xs text-muted">
          <Info className="size-3.5" />
          Deterministic results are reproducible: the same world and change always yield the same report. Strength labels are qualitative, never probabilities. Traversal depth is limited to {report?.stats.depthLimit ?? 3} steps{report?.stats.truncated ? " (limit reached — some distant effects were not traced)" : ""}.
        </div>
      </header>

      {proposal.stale && open ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-[#e2c58c]">
          <TriangleAlert className="size-4" /> The timeline changed after this analysis ran. Re-run it before committing.
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run("analyze", () => analyzeProposalAction(worldId, proposal.id), "Analysis refreshed")}><RefreshCw /> Re-run analysis</Button>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-[#e7a3a3]">
          <TriangleAlert className="size-4 shrink-0" /> <span className="flex-1">{error.message}</span>
          {error.conflict ? <Button size="sm" variant="secondary" onClick={() => run("analyze", () => analyzeProposalAction(worldId, proposal.id), "Analysis refreshed")}><RefreshCw /> Re-run analysis</Button> : null}
          <Button size="icon-sm" variant="ghost" aria-label="Dismiss" onClick={() => setError(null)}><X /></Button>
        </div>
      ) : null}

      {proposal.status === "COMMITTED" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-[#a9cfa5]">
          <CircleCheck className="size-4" /> Committed. Every change is recorded and can be reviewed or undone from the timeline&apos;s change history.
          <Button asChild size="sm" variant="secondary"><Link href={`/worlds/${worldId}/branches?compare=${proposal.committedTimelineId}`}><GitBranch /> Open change history</Link></Button>
          <Button asChild size="sm" variant="secondary"><Link href={`/worlds/${worldId}/timeline?tl=${proposal.committedTimelineId}&focus=${proposal.sourceEvent.id}`}>View on timeline</Link></Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Show">
          {([["ALL", "All impacts"], ["PENDING", "Needs review"], ["CHANGES", "Concrete changes"]] as const).map(([k, l]) => (
            <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)} className={cn("rounded px-2.5 py-1 text-xs", filter === k ? "bg-surface-2 text-gold" : "text-text-2")}>{l}</button>
          ))}
        </div>
        {open ? (
          <>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run("analyze", () => analyzeProposalAction(worldId, proposal.id), "Analysis refreshed")}><RefreshCw className={busy === "analyze" ? "animate-spin" : ""} /> Re-run</Button>
            <Button size="sm" variant="ghost" disabled={pending || !pendingChanges} onClick={() => run("acceptAll", () => reviewAllAction(worldId, proposal.id, "ACCEPTED"))}><CheckCheck /> Accept all suggested changes</Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run("rejectAll", () => reviewAllAction(worldId, proposal.id, "REJECTED"))}><X /> Reject remaining</Button>
            {ai.available ? (
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => run("ai", () => addAiPossibilitiesAction(worldId, proposal.id), "AI possibilities added — review them individually")}>
                <Sparkles className="text-violet" /> {busy === "ai" ? "Asking AI…" : "Suggest more with AI"}{ai.demo ? " (demo)" : ""}
              </Button>
            ) : (
              <span className="text-xs text-muted">AI possibilities unavailable — no provider configured.</span>
            )}
          </>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          {grouped.length === 0 ? <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">Nothing to show for this filter.</p> : null}
          {grouped.map(([cat, list]) => (
            <section key={cat} aria-labelledby={`cat-${cat}`}>
              <h2 id={`cat-${cat}`} className="wf-eyebrow mb-2 flex items-center gap-2">
                {cat === "CONTRADICTION" ? <TriangleAlert className="size-3.5 text-warning" /> : cat === "AI" ? <Sparkles className="size-3.5 text-violet" /> : null}
                {IMPACT_CATEGORY_LABELS[cat]} <span className="text-muted">({list.length})</span>
              </h2>
              <ul className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {list.map((item) => (
                    <ImpactCard key={item.id} worldId={worldId} item={item} open={open} pending={pending} run={run} />
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          ))}
        </div>

        {open ? (
          <aside className="xl:sticky xl:top-16 xl:self-start">
            <div className="wf-panel flex flex-col gap-4 p-5">
              <h2 className="font-serif text-xl font-semibold">Commit</h2>
              <p className="text-sm text-text-2">{accepted} concrete change{accepted === 1 ? "" : "s"} accepted{pendingChanges ? ` · ${pendingChanges} still pending review` : ""}. Questions and narrative notes are kept with the proposal.</p>
              <fieldset className="flex flex-col gap-2">
                <legend className="wf-eyebrow mb-1">Apply to</legend>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input type="radio" name="target" className="mt-1 accent-[#D6BD8D]" checked={target === "NEW_BRANCH"} onChange={() => setTarget("NEW_BRANCH")} />
                  <span><span className="font-medium">A new alternate timeline</span><span className="block text-xs text-muted">Branches from “{proposal.timeline.name}”; the original stays unchanged.</span></span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input type="radio" name="target" className="mt-1 accent-[#D6BD8D]" checked={target === "CURRENT"} onChange={() => setTarget("CURRENT")} />
                  <span><span className="font-medium">{proposal.timeline.isMain ? "Prime canon directly" : `“${proposal.timeline.name}”`}</span><span className="block text-xs text-muted">{proposal.timeline.isMain ? "Rewrites canon (every change is recorded and undoable)." : "Stored as this branch's own changes."}</span></span>
                </label>
              </fieldset>
              {target === "NEW_BRANCH" ? <Field label="Branch name" htmlFor="commit-branch"><Input id="commit-branch" value={branchName} onChange={(e) => setBranchName(e.target.value)} /></Field> : null}
              <Button variant="primary" disabled={pending || pendingChanges > 0 || proposal.stale} onClick={() => setConfirmCommit(true)}>
                <Check /> Commit {accepted} change{accepted === 1 ? "" : "s"}
              </Button>
              {pendingChanges ? <p className="text-xs text-warning">Review every suggested change first.</p> : null}
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => run("discard", () => discardProposalAction(worldId, proposal.id), "Proposal discarded")}><Trash2 /> Discard proposal</Button>
            </div>
          </aside>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmCommit}
        onOpenChange={setConfirmCommit}
        title="Commit these changes?"
        description={
          target === "NEW_BRANCH"
            ? `A new timeline “${branchName}” will be created and ${accepted} change(s) applied to it in one transaction. “${proposal.timeline.name}” is not modified.`
            : `${accepted} change(s) will be applied to “${proposal.timeline.name}” in one transaction. If anything fails, nothing is saved.`
        }
        confirmLabel="Commit"
        pending={pending}
        onConfirm={() => {
          setConfirmCommit(false);
          start(async () => {
            setError(null);
            const r = await commitProposalAction(worldId, proposal.id, { target, branchName });
            if (!r.ok) return setError({ message: r.error, conflict: r.code === "CONFLICT" });
            toast.success(`Committed ${r.data.changes} change(s)`);
            router.refresh();
          });
        }}
      />
    </div>
  );
}

function ImpactCard({ worldId, item, open, pending, run }: {
  worldId: string;
  item: ReviewItem;
  open: boolean;
  pending: boolean;
  run: (key: string, fn: () => Promise<{ ok: boolean; error?: string; code?: string } & Record<string, unknown>>, success?: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const c = item.suggestedChange;
  const isPrimary = item.basis === "PRIMARY_CHANGE";
  const fields = c ? (c.changeType === "DELETE" ? ["exists"] : Object.keys(c.patch)) : [];

  const saveEdit = () => {
    if (!c) return;
    const patch: Record<string, unknown> = {};
    for (const f of Object.keys(c.patch)) {
      const raw = draft[f] ?? fmt(c.patch[f]);
      const orig = c.patch[f];
      patch[f] = raw === "—" || raw === "" ? null : typeof orig === "number" || /Year$|Month$|Day$/.test(f) ? Number(raw) : raw;
    }
    run(`edit:${item.id}`, () => reviewItemAction(worldId, item.id, { status: "ACCEPTED", patch }), "Edited and accepted");
    setEditing(false);
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border bg-surface p-4",
        item.status === "ACCEPTED" ? "border-success/40" : item.status === "REJECTED" ? "border-border opacity-60" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={BASIS_TONE[item.basis]}>{BASIS_LABELS[item.basis]}</Badge>
            <Badge>{STRENGTH_LABEL[item.strength] ?? item.strength}</Badge>
            {item.status !== "PENDING" ? <Badge tone={item.status === "ACCEPTED" ? "success" : "neutral"}>{item.status.toLowerCase()}</Badge> : null}
          </div>
          <h3 className="mt-1.5 font-medium leading-snug">{item.title}</h3>
          <p className="mt-1 whitespace-pre-line text-sm text-text-2">{item.description}</p>
        </div>
        {open && !isPrimary ? (
          <div className="flex shrink-0 gap-1">
            {c ? <Button size="icon-sm" variant="ghost" aria-label="Edit suggested change" onClick={() => setEditing((e) => !e)}><Pencil /></Button> : null}
            <Button size="sm" variant={item.status === "REJECTED" ? "outline" : "ghost"} disabled={pending} onClick={() => run(`r:${item.id}`, () => reviewItemAction(worldId, item.id, { status: "REJECTED" }))} aria-pressed={item.status === "REJECTED"}><X /> {c ? "Reject" : "Dismiss"}</Button>
            <Button size="sm" variant={item.status === "ACCEPTED" ? "primary" : "secondary"} disabled={pending} onClick={() => run(`a:${item.id}`, () => reviewItemAction(worldId, item.id, { status: "ACCEPTED" }))} aria-pressed={item.status === "ACCEPTED"}><Check /> {c ? "Accept" : "Acknowledge"}</Button>
          </div>
        ) : null}
      </div>

      {c ? (
        <div className="mt-3 overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-bg-2 text-left text-2xs uppercase tracking-wider text-muted">
              <tr><th className="px-3 py-1.5 font-medium">{c.targetType.toLowerCase()} field</th><th className="px-3 py-1.5 font-medium">Original</th><th className="px-3 py-1.5 font-medium">Proposed</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {fields.map((f) => (
                <tr key={f}>
                  <td className="px-3 py-1.5 text-text-2">{humanize(f.replace(/([A-Z])/g, "_$1"))}</td>
                  <td className="px-3 py-1.5 text-text-2">{c.changeType === "DELETE" ? "exists" : fmt(c.before?.[f])}</td>
                  <td className="px-3 py-1.5 text-gold">
                    {c.changeType === "DELETE" ? "removed in this timeline" : editing ? (
                      <Input aria-label={`New value for ${f}`} className="h-7" defaultValue={fmt(c.patch[f]) === "—" ? "" : fmt(c.patch[f])} onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))} />
                    ) : fmt(c.patch[f])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {editing ? (
            <div className="flex justify-end gap-2 border-t border-border bg-bg-2 p-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" variant="primary" onClick={saveEdit}>Save & accept</Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {item.affected.length || item.evidence.length ? (
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          {item.affected.length ? (
            <div>
              <div className="mb-1 text-muted">Affected records</div>
              <div className="flex flex-wrap gap-1">
                {item.affected.map((r) => {
                  const href = refHref(worldId, r);
                  return href ? <Link key={`${r.type}:${r.id}`} href={href} className="rounded border border-border px-1.5 py-0.5 text-text-2 hover:border-gold-dim hover:text-gold">{r.label}</Link> : <span key={`${r.type}:${r.id}`} className="rounded border border-border px-1.5 py-0.5 text-text-2">{r.label}</span>;
                })}
              </div>
            </div>
          ) : null}
          {item.evidence.length ? (
            <div>
              <div className="mb-1 text-muted">Evidence</div>
              <ul className="flex flex-col gap-0.5">
                {item.evidence.map((r, i) => {
                  const href = refHref(worldId, r);
                  return (
                    <li key={i} className="text-text-2">
                      {r.note ? <span className="text-muted">{r.note}: </span> : null}
                      {href ? <Link href={href} className="hover:text-gold">{r.label}</Link> : r.label}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      {item.basis === "AI_INFERENCE" ? <p className="mt-2 text-2xs text-[#e2c58c]">Generated by AI from your canon. Treat as a creative prompt, not a fact.</p> : null}
    </motion.li>
  );
}

