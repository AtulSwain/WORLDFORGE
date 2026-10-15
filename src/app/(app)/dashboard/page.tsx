import Link from "next/link";
import { Plus, Sparkles, Users, Diamond, GitBranch, Archive } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ImportUniverseButton } from "@/components/dashboard/import-universe-button";
import { AddSampleButton } from "@/components/dashboard/add-sample-button";
import { requireUser } from "@/server/auth/session";
import { listUniverses } from "@/server/services/universes";
import { db } from "@/server/db";
import { GENRE_LABELS, type GenreKey } from "@/domain/catalog";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Your worlds" };

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const sp = await props.searchParams;
  const showArchived = sp.archived === "1";
  const user = await requireUser();
  const universes = await listUniverses(user.id, { includeArchived: showArchived });
  const visible = universes.filter((u) => (showArchived ? u.archivedAt : !u.archivedAt));
  const hasSample = universes.some((u) => u.name === "The Ashen Crown" || u.isSample);
  const activity = await db.universeActivity.findMany({
    where: { universeId: { in: universes.map((u) => u.id) } },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { actor: { select: { name: true } }, universe: { select: { id: true, name: true } } },
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <PageHeader
          eyebrow={`Welcome back, ${user.name.split(" ")[0]}`}
          title={showArchived ? "Archived worlds" : "Your worlds"}
          description={showArchived ? "Archived universes are hidden from navigation but nothing has been deleted." : "Every universe you own or have been invited into."}
          actions={
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href={showArchived ? "/dashboard" : "/dashboard?archived=1"}><Archive /> {showArchived ? "Active worlds" : "Archived"}</Link>
              </Button>
              <ImportUniverseButton />
              <Button asChild variant="primary">
                <Link href="/worlds/new"><Plus /> New universe</Link>
              </Button>
            </>
          }
        />

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-label="Universes">
            {visible.length === 0 && !showArchived ? (
              <EmptyState
                icon={<Sparkles />}
                title="Your first world is waiting"
                description="Found a universe from scratch, or explore The Ashen Crown — a complete sample world with kingdoms, a succession crisis, a war and an alternate timeline."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button asChild variant="primary"><Link href="/worlds/new">Create a universe</Link></Button>
                    <AddSampleButton />
                  </div>
                }
              />
            ) : visible.length === 0 ? (
              <EmptyState title="No archived worlds" description="Universes you archive will appear here." />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {visible.map((u) => (
                  <li key={u.id}>
                    <Link href={`/worlds/${u.id}`} className="group block overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-gold-dim">
                      <div
                        className="relative h-32 bg-cover bg-center"
                        style={{ backgroundImage: u.coverImage ? `url(${u.coverImage})` : "radial-gradient(circle at 30% 20%, #2a2620, #15161c 70%)" }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
                        <div className="absolute right-3 top-3 flex gap-1.5">
                          {u.role !== "OWNER" ? <Badge tone="violet">{u.role.toLowerCase()}</Badge> : null}
                          {u.archivedAt ? <Badge>archived</Badge> : null}
                        </div>
                      </div>
                      <div className="p-4 pt-0">
                        <div className="wf-eyebrow">{u.genre === "CUSTOM" && u.customGenre ? u.customGenre : GENRE_LABELS[u.genre as GenreKey]}</div>
                        <h2 className="mt-1 font-serif text-2xl font-semibold group-hover:text-gold">{u.name}</h2>
                        <p className="mt-1 line-clamp-2 text-sm text-text-2">{u.description || "No description yet."}</p>
                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
                          <span className="flex items-center gap-1"><Users className="size-3.5" /> {u._count.entities} entities</span>
                          <span className="flex items-center gap-1"><Diamond className="size-3.5" /> {u._count.events} events</span>
                          <span className="flex items-center gap-1"><GitBranch className="size-3.5" /> {u._count.timelines} timelines</span>
                          <span className="ml-auto">Updated {timeAgo(u.updatedAt)}</span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/worlds/new" className="flex h-full min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border text-text-2 transition-colors hover:border-gold-dim hover:text-gold">
                    <Plus className="size-6" />
                    <span className="mt-2 text-sm">Found a new universe</span>
                  </Link>
                </li>
              </ul>
            )}
          </section>

          <aside className="flex flex-col gap-4">
            {!hasSample && visible.length > 0 ? (
              <div className="wf-panel p-4">
                <h2 className="font-serif text-lg font-semibold">Explore a finished world</h2>
                <p className="mt-1 text-sm text-text-2">Add your own copy of The Ashen Crown to see the graph, Chronos and the Living World Engine with rich data.</p>
                <div className="mt-3"><AddSampleButton /></div>
              </div>
            ) : null}
            <div className="wf-panel p-4">
              <h2 className="wf-eyebrow mb-3">Recent activity</h2>
              {activity.length === 0 ? (
                <p className="text-sm text-muted">Nothing yet. Changes across your worlds will appear here.</p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {activity.map((a) => (
                    <li key={a.id} className="text-sm">
                      <div className="text-text-2">{a.summary}</div>
                      <div className="text-xs text-muted">
                        <Link href={`/worlds/${a.universe.id}`} className="hover:text-gold">{a.universe.name}</Link> · {a.actor?.name ?? "Someone"} · {timeAgo(a.createdAt)}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
