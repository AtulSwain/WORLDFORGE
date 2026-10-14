import "server-only";
import { entityHref, type EntityTypeKey } from "@/domain/catalog";
import { db } from "../db";
import { requireAccess } from "./access";

export interface SearchHit {
  kind: "ENTITY" | "EVENT" | "LORE" | "TIMELINE";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  universeName?: string;
}

/**
 * Global search scoped to universes the user is a member of. With `worldId`, search is
 * restricted to that universe (and membership is verified).
 */
export async function search(userId: string, rawQuery: string, worldId?: string | null, limitPerKind = 6): Promise<SearchHit[]> {
  const q = rawQuery.trim().slice(0, 100);
  if (q.length < 1) return [];
  let universeIds: string[];
  if (worldId) {
    await requireAccess(userId, worldId, "universe:read");
    universeIds = [worldId];
  } else {
    universeIds = (await db.universeMember.findMany({ where: { userId, universe: { archivedAt: null } }, select: { universeId: true } })).map((m) => m.universeId);
  }
  if (!universeIds.length) return [];
  const ci = { contains: q, mode: "insensitive" as const };
  const [entities, events, lore, timelines] = await Promise.all([
    db.entity.findMany({
      where: { universeId: { in: universeIds }, archivedAt: null, OR: [{ name: ci }, { summary: ci }] },
      select: { id: true, name: true, type: true, summary: true, universeId: true, universe: { select: { name: true } } },
      orderBy: { name: "asc" },
      take: limitPerKind * 2,
    }),
    db.historicalEvent.findMany({
      where: { universeId: { in: universeIds }, archivedAt: null, OR: [{ title: ci }, { description: ci }] },
      select: { id: true, title: true, startYear: true, universeId: true, universe: { select: { name: true } } },
      orderBy: { startOrdinal: "asc" },
      take: limitPerKind,
    }),
    db.loreDocument.findMany({
      where: { universeId: { in: universeIds }, archivedAt: null, OR: [{ title: ci }, { body: ci }, { tags: { has: q.toLowerCase() } }] },
      select: { id: true, title: true, category: true, universeId: true, universe: { select: { name: true } } },
      take: limitPerKind,
    }),
    db.timeline.findMany({
      where: { universeId: { in: universeIds }, name: ci },
      select: { id: true, name: true, isMain: true, universeId: true, universe: { select: { name: true } } },
      take: 4,
    }),
  ]);
  const lower = q.toLowerCase();
  const rank = (s: string) => (s.toLowerCase().startsWith(lower) ? 0 : s.toLowerCase().includes(lower) ? 1 : 2);
  return [
    ...entities
      .sort((a, b) => rank(a.name) - rank(b.name))
      .slice(0, limitPerKind * 2)
      .map((e) => ({
        kind: "ENTITY" as const,
        id: e.id,
        title: e.name,
        subtitle: `${e.type.replace("_", " ").toLowerCase()}${e.summary ? ` · ${e.summary.slice(0, 80)}` : ""}`,
        href: entityHref(e.universeId, e.type as EntityTypeKey, e.id),
        universeName: worldId ? undefined : e.universe.name,
      })),
    ...events.map((e) => ({ kind: "EVENT" as const, id: e.id, title: e.title, subtitle: `Event · Year ${e.startYear}`, href: `/worlds/${e.universeId}/events/${e.id}`, universeName: worldId ? undefined : e.universe.name })),
    ...lore.map((d) => ({ kind: "LORE" as const, id: d.id, title: d.title, subtitle: `Lore · ${d.category.replace("_", " ").toLowerCase()}`, href: `/worlds/${d.universeId}/codex/${d.id}`, universeName: worldId ? undefined : d.universe.name })),
    ...timelines.map((t) => ({ kind: "TIMELINE" as const, id: t.id, title: t.name, subtitle: t.isMain ? "Main timeline" : "Alternate timeline", href: `/worlds/${t.universeId}/timeline?tl=${t.id}`, universeName: worldId ? undefined : t.universe.name })),
  ];
}
