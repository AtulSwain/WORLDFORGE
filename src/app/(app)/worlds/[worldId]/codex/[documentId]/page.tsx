import Link from "next/link";
import { humanize, entityHref, type EntityTypeKey } from "@/domain/catalog";
import { getWorldContext, guard } from "@/server/page-context";
import { getLore } from "@/server/services/lore";
import { listRevisions } from "@/server/services/revisions";
import { entityOptions } from "@/server/services/entities";
import { eventOptions } from "@/server/services/events";
import { Badge, CanonBadge } from "@/components/ui/badge";
import { DetailTabs } from "@/components/common/detail-tabs";
import { RevisionHistory } from "@/components/common/revision-history";
import { ArchiveButton } from "@/components/common/archive-button";
import { LoreEditor } from "@/components/codex/lore-editor";
import { Markdown } from "@/components/codex/markdown";
import { EntityIcon } from "@/components/world/entity-visual";

export default async function LoreDocumentPage(props: PageProps<"/worlds/[worldId]/codex/[documentId]">) {
  const { worldId, documentId } = await props.params;
  const ctx = await getWorldContext(worldId);
  const [{ doc }, revisions, entities, events] = await Promise.all([
    guard(() => getLore(ctx.user.id, worldId, documentId)),
    listRevisions(worldId, "LORE", documentId),
    entityOptions(ctx.user.id, worldId),
    eventOptions(ctx.user.id, worldId),
  ]);
  const canWrite = ctx.can("content:write");
  const linkedEntities = doc.links.filter((l) => l.entity).map((l) => l.entity!);
  const linkedEvents = doc.links.filter((l) => l.event).map((l) => l.event!);

  const reader = (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <article className="min-w-0"><Markdown>{doc.body || "*This document is empty.*"}</Markdown></article>
      <aside className="flex flex-col gap-4">
        <div className="wf-panel p-4">
          <h2 className="wf-eyebrow mb-2">Describes</h2>
          <ul className="flex flex-col gap-1.5">
            {linkedEntities.map((e) => <li key={e.id}><Link href={entityHref(worldId, e.type as EntityTypeKey, e.id)} className="flex items-center gap-2 text-sm hover:text-gold"><EntityIcon type={e.type as EntityTypeKey} /> {e.name}</Link></li>)}
            {linkedEvents.map((e) => <li key={e.id}><Link href={`/worlds/${worldId}/events/${e.id}`} className="text-sm hover:text-gold">◆ {e.title}</Link></li>)}
            {!linkedEntities.length && !linkedEvents.length ? <li className="text-sm text-muted">No linked records.</li> : null}
          </ul>
        </div>
      </aside>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center justify-between gap-2 text-xs text-muted">
        <span><Link href={`/worlds/${worldId}/codex`} className="hover:text-text">Lore Codex</Link> / {humanize(doc.category)}</span>
        <span className="flex items-center gap-2">
          <CanonBadge status={doc.canonStatus} />
          {doc.archivedAt ? <Badge tone="warning">archived</Badge> : null}
          {canWrite ? <ArchiveButton worldId={worldId} id={doc.id} kind="LORE" archived={!!doc.archivedAt} label={doc.title} /> : null}
        </span>
      </nav>
      {!canWrite ? <h1 className="mb-6 font-serif text-4xl font-semibold">{doc.title}</h1> : null}
      <DetailTabs
        tabs={[
          canWrite
            ? {
                id: "edit",
                label: "Editor",
                content: (
                  <LoreEditor
                    key={`${doc.id}:${doc.version}`}
                    worldId={worldId}
                    doc={{ id: doc.id, version: doc.version, title: doc.title, body: doc.body, category: doc.category, tags: doc.tags, canonStatus: doc.canonStatus, entityIds: linkedEntities.map((e) => e.id), eventIds: linkedEvents.map((e) => e.id) }}
                    entities={entities.map((e) => ({ id: e.id, name: e.name, type: e.type }))}
                    events={events.map((e) => ({ id: e.id, name: e.title, hint: String(e.startYear) }))}
                  />
                ),
              }
            : { id: "read", label: "Read", content: reader },
          ...(canWrite ? [{ id: "read", label: "Reader", content: reader }] : []),
          { id: "history", label: "Revision history", count: revisions.length, content: <RevisionHistory worldId={worldId} recordId={doc.id} recordType="LORE" canRestore={canWrite} revisions={revisions.map((r) => ({ id: r.id, version: r.version, summary: r.summary, createdAt: r.createdAt.toISOString(), author: r.author?.name ?? null, snapshot: r.snapshot as Record<string, unknown> }))} /> },
        ]}
      />
    </div>
  );
}
