import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { LORE_CATEGORIES, humanize } from "@/domain/catalog";
import { getWorldContext, guard } from "@/server/page-context";
import { listLore } from "@/server/services/lore";
import { Button } from "@/components/ui/button";
import { Badge, CanonBadge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { DirectoryToolbar } from "@/components/entities/directory-toolbar";
import { cn, timeAgo } from "@/lib/utils";

export const metadata = { title: "Lore Codex" };

export default async function CodexPage(props: PageProps<"/worlds/[worldId]/codex">) {
  const { worldId } = await props.params;
  const sp = await props.searchParams;
  const ctx = await getWorldContext(worldId);
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const category = str(sp.category);
  const tag = str(sp.tag);
  const { docs, tags, categories } = await guard(() => listLore(ctx.user.id, worldId, { q: str(sp.q), category, tag, archived: sp.archived === "1" }));
  const canWrite = ctx.can("content:write");
  const href = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"));
    for (const [k, v] of Object.entries(patch)) (v ? n.set(k, v) : n.delete(k));
    return `?${n}`;
  };
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow={ctx.universe.name}
        title="Lore Codex"
        description="The encyclopedia of your universe — myths, laws, magic, faiths and histories, linked to the records they describe."
        actions={canWrite ? <Button asChild variant="primary"><Link href={`/worlds/${worldId}/codex/new`}><Plus /> New document</Link></Button> : null}
      />
      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-5">
          <nav aria-label="Categories">
            <h2 className="wf-eyebrow mb-2">Categories</h2>
            <ul className="flex flex-wrap gap-1 lg:flex-col">
              <li><Link href={href({ category: null })} className={cn("block rounded-md px-2 py-1 text-sm", !category ? "bg-gold/10 text-gold" : "text-text-2 hover:bg-surface-2")}>All</Link></li>
              {LORE_CATEGORIES.map((c) => (
                <li key={c}>
                  <Link href={href({ category: c })} className={cn("flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm", category === c ? "bg-gold/10 text-gold" : "text-text-2 hover:bg-surface-2")}>
                    {humanize(c)} <span className="text-2xs text-muted">{categories[c] ?? ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {tags.length ? (
            <div>
              <h2 className="wf-eyebrow mb-2">Tags</h2>
              <div className="flex flex-wrap gap-1">
                {tags.slice(0, 30).map(([t, n]) => (
                  <Link key={t} href={href({ tag: tag === t ? null : t })} className={cn("rounded-full border px-2 py-0.5 text-xs", tag === t ? "border-gold/60 text-gold" : "border-border text-text-2 hover:border-border-strong")}>#{t} <span className="text-muted">{n}</span></Link>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
        <div className="min-w-0">
          <DirectoryToolbar filters={[]} sorts={[{ value: "updated", label: "Recently edited" }]} />
          {docs.length === 0 ? (
            <EmptyState
              className="mt-4"
              icon={<BookOpen />}
              title={sp.q || category || tag ? "No documents match" : "The codex is empty"}
              description={sp.q || category || tag ? "Try another search, category or tag." : "Write the myths, laws and histories of your world. Link documents to the characters and events they describe."}
              action={canWrite && !sp.q ? <Button asChild variant="primary"><Link href={`/worlds/${worldId}/codex/new`}><Plus /> Write the first entry</Link></Button> : undefined}
            />
          ) : (
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {docs.map((d) => (
                <li key={d.id}>
                  <Link href={`/worlds/${worldId}/codex/${d.id}`} className="flex h-full flex-col rounded-xl border border-border bg-surface p-4 transition-colors hover:border-gold-dim">
                    <div className="flex items-center gap-2">
                      <Badge>{humanize(d.category)}</Badge>
                      <CanonBadge status={d.canonStatus} />
                      <span className="ml-auto text-2xs text-muted">{timeAgo(d.updatedAt)}</span>
                    </div>
                    <h2 className="mt-2 font-serif text-xl font-semibold">{d.title}</h2>
                    <p className="mt-1 line-clamp-3 flex-1 text-sm text-text-2">{d.excerpt || "Empty document."}</p>
                    <div className="mt-2 flex flex-wrap gap-1 text-2xs text-muted">
                      {d.tags.map((t) => <span key={t}>#{t}</span>)}
                      <span className="ml-auto">{d._count.links} links</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
