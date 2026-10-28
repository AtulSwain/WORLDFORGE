import Link from "next/link";
import { Flame, Plus } from "lucide-react";
import { getWorldContext, guard, pickTimeline } from "@/server/page-context";
import { getProposal, listProposals } from "@/server/services/proposals";
import { loadSnapshot } from "@/server/services/snapshot";
import { publicAiStatus } from "@/server/ai/config";
import { ProposalForm } from "@/components/simulator/proposal-form";
import { DraftNotice } from "@/components/simulator/draft-notice";
import { ProposalReview, type ReviewItem } from "@/components/simulator/proposal-review";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, timeAgo } from "@/lib/utils";

export const metadata = { title: "Living World Engine" };

export default async function SimulatorPage(props: PageProps<"/worlds/[worldId]/simulator">) {
  const { worldId } = await props.params;
  const sp = await props.searchParams;
  const ctx = await getWorldContext(worldId);
  const canWrite = ctx.can("timeline:branch");
  const proposals = await listProposals(ctx.user.id, worldId);
  const proposalId = typeof sp.proposal === "string" ? sp.proposal : null;
  const showForm = !proposalId && canWrite;
  const proposal = proposalId ? await guard(() => getProposal(ctx.user.id, worldId, proposalId)) : null;

  let form: React.ReactNode = null;
  if (showForm) {
    const timeline = pickTimeline(ctx, sp.tl);
    const snap = await loadSnapshot(worldId, timeline.id);
    form = (
      <ProposalForm
        worldId={worldId}
        timelines={ctx.timelines.filter((t) => t.status === "ACTIVE").map((t) => ({ id: t.id, name: t.name, isMain: t.isMain }))}
        timelineId={timeline.id}
        events={snap.events.map((e) => ({ id: e.id, title: e.title, eventType: e.eventType, startYear: e.startYear, startMonth: e.startMonth, startDay: e.startDay, endYear: e.endYear, endMonth: e.endMonth, endDay: e.endDay, precision: e.precision, locationId: e.locationId, canonStatus: e.canonStatus, importance: e.importance }))}
        locations={snap.entities.filter((e) => e.type === "LOCATION").map((e) => ({ id: e.id, name: e.name, type: e.type }))}
        calendar={ctx.calendar}
        initialEventId={typeof sp.event === "string" ? sp.event : null}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="wf-eyebrow">{ctx.universe.name}</p>
          <h1 className="mt-1 flex items-center gap-2 font-serif text-4xl font-semibold"><Flame className="size-7 text-gold" /> Living World Engine</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-2">Change an event, trace what depends on it, review every consequence with its evidence, and commit only what you approve — to canon or to a new alternate timeline.</p>
        </div>
        {canWrite && proposalId ? <Button asChild variant="primary"><Link href={`/worlds/${worldId}/simulator?new=1`}><Plus /> New simulation</Link></Button> : null}
      </div>
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside>
          <h2 className="wf-eyebrow mb-2">Simulations</h2>
          {proposals.length === 0 ? <p className="text-sm text-muted">None yet.</p> : (
            <ul className="flex flex-col gap-1">
              {proposals.map((p) => (
                <li key={p.id}>
                  <Link href={`/worlds/${worldId}/simulator?proposal=${p.id}`} className={cn("block rounded-md border px-3 py-2 text-sm transition-colors", p.id === proposalId ? "border-gold/50 bg-surface" : "border-transparent hover:bg-surface")}>
                    <div className="line-clamp-2">{p.title}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-2xs text-muted">
                      <Badge tone={p.status === "COMMITTED" ? "success" : p.status === "ANALYZED" ? "gold" : "neutral"}>{p.status.toLowerCase()}</Badge>
                      <span className="truncate">{p.timeline.name} · {timeAgo(p.updatedAt)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <div className="min-w-0">
          {proposal ? (
            proposal.status === "DRAFT" ? (
              <DraftNotice worldId={worldId} proposalId={proposal.id} title={proposal.title} rationale={proposal.rationale} canWrite={canWrite} />
            ) : (
              <ProposalReview
                worldId={worldId}
                canWrite={canWrite}
                ai={publicAiStatus()}
                proposal={{
                  id: proposal.id, title: proposal.title, rationale: proposal.rationale, status: proposal.status,
                  timeline: { id: proposal.timeline.id, name: proposal.timeline.name, isMain: proposal.timeline.isMain },
                  sourceEvent: { id: proposal.sourceEvent.id, title: proposal.sourceEvent.title },
                  committedTimelineId: proposal.committedTimelineId,
                  stale: proposal.status === "ANALYZED" && proposal.analyzedVersion !== proposal.timeline.version,
                }}
                report={proposal.report as never}
                items={proposal.items.map((i) => ({
                  id: i.id, category: i.category as ReviewItem["category"], title: i.title, description: i.description, basis: i.basis, strength: i.strength,
                  affected: i.affected as ReviewItem["affected"], evidence: i.evidence as ReviewItem["evidence"], suggestedChange: (i.suggestedChange ?? null) as ReviewItem["suggestedChange"], status: i.status,
                }))}
              />
            )
          ) : showForm ? (
            form
          ) : (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">Viewers can read past simulations from the list. Only editors can propose changes.</p>
          )}
        </div>
      </div>
    </div>
  );
}

