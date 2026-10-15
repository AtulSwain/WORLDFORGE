import "server-only";
import { z } from "zod";
import { ENTITY_TYPES } from "@/domain/catalog";
import { boundedBfs, shortestPath } from "@/domain/graph";
import { db } from "../db";
import { requireAccess } from "./access";
import { loadSnapshot, resolveTimelineId } from "./snapshot";

export const graphQuerySchema = z.object({
  timelineId: z.string().max(64).optional().nullable(),
  focus: z.array(z.string().max(64)).max(20).default([]),
  depth: z.coerce.number().int().min(1).max(3).default(2),
  types: z.array(z.enum(ENTITY_TYPES)).max(12).default([]),
  rels: z.array(z.string().max(40)).max(40).default([]),
  events: z.boolean().default(false),
  limit: z.coerce.number().int().min(10).max(300).default(120),
});
export type GraphQuery = z.input<typeof graphQuerySchema>;

export interface GraphNode {
  id: string;
  kind: "ENTITY" | "EVENT";
  type: string;
  label: string;
  status?: string;
  summary?: string;
  portrait?: string | null;
  year?: number;
  degree: number;
  modified?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  kind: "RELATIONSHIP" | "PARTICIPATION";
  from: number | null;
  to: number | null;
  modified?: boolean;
}

/**
 * Returns a focused, bounded subgraph of the selected timeline. Without a focus, the most
 * connected entities are shown. Never sends the whole universe to the browser.
 */
export async function graphNeighborhood(userId: string, universeId: string, raw: GraphQuery) {
  await requireAccess(userId, universeId, "universe:read");
  const q = graphQuerySchema.parse(raw);
  const timelineId = await resolveTimelineId(universeId, q.timelineId);
  const snap = await loadSnapshot(universeId, timelineId);

  const typeOk = (t: string) => q.types.length === 0 || q.types.includes(t as never);
  const relOk = (t: string) => q.rels.length === 0 || q.rels.includes(t);
  const entities = new Map(snap.entities.filter((e) => typeOk(e.type)).map((e) => [e.id, e]));
  const rels = snap.relationships.filter((r) => relOk(r.type) && entities.has(r.sourceId) && entities.has(r.targetId));

  const adj = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    adj.set(a, [...(adj.get(a) ?? []), b]);
    adj.set(b, [...(adj.get(b) ?? []), a]);
  };
  for (const r of rels) link(r.sourceId, r.targetId);
  if (q.events) for (const p of snap.participants) if (entities.has(p.entityId)) link(p.entityId, `ev:${p.eventId}`);

  const degree = (id: string) => adj.get(id)?.length ?? 0;
  let selected: Set<string>;
  let truncated = false;
  const focus = q.focus.filter((f) => entities.has(f) || (q.events && snap.events.some((e) => `ev:${e.id}` === f)));
  if (focus.length) {
    const res = boundedBfs(focus, (n) => adj.get(n) ?? [], q.depth, q.limit);
    selected = new Set(res.depth.keys());
    truncated = res.truncated;
  } else {
    const ranked = [...entities.keys()].sort((a, b) => degree(b) - degree(a) || entities.get(a)!.name.localeCompare(entities.get(b)!.name));
    selected = new Set(ranked.slice(0, Math.min(q.limit, 60)));
    truncated = ranked.length > selected.size;
  }

  const meta = await db.entity.findMany({ where: { id: { in: [...selected].filter((s) => !s.startsWith("ev:")) } }, select: { id: true, summary: true, portrait: true } });
  const metaById = new Map(meta.map((m) => [m.id, m]));
  const evById = new Map(snap.events.map((e) => [e.id, e]));

  const nodes: GraphNode[] = [];
  for (const id of selected) {
    if (id.startsWith("ev:")) {
      const ev = evById.get(id.slice(3));
      if (ev) nodes.push({ id, kind: "EVENT", type: ev.eventType, label: ev.title, year: ev.startYear, degree: degree(id), modified: snap.overridden.has(ev.id) });
      continue;
    }
    const e = entities.get(id);
    if (!e) continue;
    nodes.push({ id, kind: "ENTITY", type: e.type, label: e.name, status: e.status, summary: metaById.get(id)?.summary, portrait: metaById.get(id)?.portrait, degree: degree(id), modified: snap.overridden.has(id) });
  }
  const edges: GraphEdge[] = rels
    .filter((r) => selected.has(r.sourceId) && selected.has(r.targetId))
    .map((r) => ({ id: r.id, source: r.sourceId, target: r.targetId, type: r.type, kind: "RELATIONSHIP", from: r.validFromYear, to: r.validToYear, modified: snap.overridden.has(r.id) }));
  if (q.events) {
    for (const p of snap.participants) {
      const evId = `ev:${p.eventId}`;
      if (selected.has(evId) && selected.has(p.entityId)) {
        edges.push({ id: `p:${p.eventId}:${p.entityId}:${p.role}`, source: p.entityId, target: evId, type: p.role, kind: "PARTICIPATION", from: null, to: null });
      }
    }
  }
  return { timelineId, nodes, edges, truncated, totalEntities: entities.size };
}

export async function graphPath(userId: string, universeId: string, from: string, to: string, timelineId?: string | null) {
  await requireAccess(userId, universeId, "universe:read");
  const tid = await resolveTimelineId(universeId, timelineId);
  const snap = await loadSnapshot(universeId, tid);
  const path = shortestPath(snap.relationships.map((r) => ({ source: r.sourceId, target: r.targetId })), from, to, 6);
  if (!path) return { path: null, edges: [] as string[] };
  const edgeIds: string[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const rel = snap.relationships.find((r) => (r.sourceId === a && r.targetId === b) || (r.sourceId === b && r.targetId === a));
    if (rel) edgeIds.push(rel.id);
  }
  return { path, edges: edgeIds };
}
