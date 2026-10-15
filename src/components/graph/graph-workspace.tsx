"use client";

import "@xyflow/react/dist/style.css";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow,
  type Connection, type Edge, type Node, type NodeMouseHandler, type OnNodesChange, applyNodeChanges,
} from "@xyflow/react";
import { AnimatePresence, motion } from "motion/react";
import { Crosshair, EyeOff, Expand, ExternalLink, Filter, Loader2, Route, RotateCcw, Search, SlidersHorizontal, X, Diamond } from "lucide-react";
import { toast } from "sonner";
import { BUILTIN_RELATIONSHIP_KEYS, ENTITY_TYPE_META, ENTITY_TYPES, entityHref, humanize, relationshipMeta, type EntityTypeKey } from "@/domain/catalog";
import { forceLayout } from "@/lib/force-layout";
import { createRelationshipAction } from "@/server/actions/content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { EntityIcon } from "@/components/world/entity-visual";
import { nodeTypes, type WfNodeData } from "./graph-nodes";
import { cn } from "@/lib/utils";

interface ApiNode {
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
interface ApiEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  kind: "RELATIONSHIP" | "PARTICIPATION";
  from: number | null;
  to: number | null;
  modified?: boolean;
}
interface GraphData {
  timelineId: string;
  nodes: ApiNode[];
  edges: ApiEdge[];
  truncated: boolean;
  totalEntities: number;
}

interface Settings {
  types: string[];
  rels: string[];
  events: boolean;
  depth: number;
}

const STORAGE = (worldId: string) => `wf:graph:${worldId}`;

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export function GraphWorkspace(props: { worldId: string; timelines: { id: string; name: string; isMain: boolean }[]; canWrite: boolean; customTypes: { key: string; label: string; inverse: string | null }[] }) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}

function GraphInner({ worldId, timelines, canWrite, customTypes }: { worldId: string; timelines: { id: string; name: string; isMain: boolean }[]; canWrite: boolean; customTypes: { key: string; label: string; inverse: string | null }[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const flow = useReactFlow();
  const [tl, setTl] = useState<string>(params.get("tl") ?? timelines.find((t) => t.isMain)?.id ?? timelines[0]!.id);
  const [focus, setFocus] = useState<string[]>(params.get("focus")?.split(",").filter(Boolean) ?? []);
  // Client-only component (loaded with ssr: false), so stored settings can be read on first render.
  const [settings, setSettings] = useState<Settings>(() => {
    const fromUrl: Settings = {
      types: params.get("types")?.split(",").filter(Boolean) ?? [],
      rels: params.get("rels")?.split(",").filter(Boolean) ?? [],
      events: false,
      depth: 2,
    };
    return params.get("types") || params.get("rels") ? fromUrl : readStored(STORAGE(worldId), fromUrl);
  });
  const [data, setData] = useState<GraphData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(params.get("focus")?.split(",")[0] ?? null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [pathEdges, setPathEdges] = useState<Set<string>>(new Set());
  const [pathNodes, setPathNodes] = useState<Set<string>>(new Set());
  const [pathFrom, setPathFrom] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node<WfNodeData>[]>([]);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [connect, setConnect] = useState<{ source: string; target: string } | null>(null);
  const positions = useRef(new Map<string, { x: number; y: number }>());
  const reqId = useRef(0);

  // Persist settings and positions (per viewer, per world and timeline).
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE(worldId), JSON.stringify(settings));
    } catch {
      /* storage unavailable: settings simply aren't remembered */
    }
  }, [settings, worldId]);
  useEffect(() => {
    positions.current = new Map(Object.entries(readStored<Record<string, { x: number; y: number }>>(`${STORAGE(worldId)}:pos:${tl}`, {})));
  }, [tl, worldId]);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setStatus("loading");
    setError(null);
    const sp = new URLSearchParams({ tl, depth: String(settings.depth) });
    if (focus.length) sp.set("focus", focus.join(","));
    if (settings.types.length) sp.set("types", settings.types.join(","));
    if (settings.rels.length) sp.set("rels", settings.rels.join(","));
    if (settings.events) sp.set("events", "1");
    try {
      const res = await fetch(`/api/worlds/${worldId}/graph?${sp}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load the graph.");
      if (id === reqId.current) {
        setData(body as GraphData);
        setStatus("ready");
      }
    } catch (e) {
      if (id === reqId.current) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Could not load the graph.");
      }
    }
  }, [worldId, tl, focus, settings]);

  // Fetching and pushing layouts into React Flow's node state are syncs with external systems
  // (the API and React Flow, which owns node state once users drag).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void load();
  }, [load]);

  // Layout: keep known positions, place new nodes with a force simulation, then fit the viewport.
  useEffect(() => {
    if (!data) return;
    const visible = data.nodes.filter((n) => !hidden.has(n.id));
    const layout = forceLayout(
      visible.map((n) => {
        const p = positions.current.get(n.id);
        return { id: n.id, x: p?.x, y: p?.y, fixed: !!p };
      }),
      data.edges,
      { iterations: visible.every((n) => positions.current.has(n.id)) ? 0 : 280 },
    );
    setNodes(
      visible.map((n) => ({
        id: n.id,
        type: "world",
        position: positions.current.get(n.id) ?? layout.get(n.id)!,
        data: { label: n.label, type: n.type, kind: n.kind, portrait: n.portrait, modified: n.modified, year: n.year },
      })),
    );
    for (const [id, p] of layout) if (!positions.current.has(id)) positions.current.set(id, p);
    requestAnimationFrame(() => flow.fitView({ padding: 0.2, duration: 400, maxZoom: 1.2 }));
  }, [data, hidden, flow]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const savePositions = () => {
    try {
      localStorage.setItem(`${STORAGE(worldId)}:pos:${tl}`, JSON.stringify(Object.fromEntries(positions.current)));
    } catch {
      /* ignore */
    }
  };

  const onNodesChange: OnNodesChange<Node<WfNodeData>> = (changes) => {
    setNodes((ns) => applyNodeChanges(changes, ns));
    for (const c of changes) if (c.type === "position" && c.position) positions.current.set(c.id, c.position);
    if (changes.some((c) => c.type === "position" && c.dragging === false)) savePositions();
  };

  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of data?.edges ?? []) {
      if (!m.has(e.source)) m.set(e.source, new Set());
      if (!m.has(e.target)) m.set(e.target, new Set());
      m.get(e.source)!.add(e.target);
      m.get(e.target)!.add(e.source);
    }
    return m;
  }, [data]);

  const q = search.trim().toLowerCase();
  const searchHits = useMemo(() => (q ? (data?.nodes ?? []).filter((n) => n.label.toLowerCase().includes(q)).slice(0, 8) : []), [q, data]);

  const decoratedNodes = useMemo(() => {
    const ctx = selected ? new Set([selected, ...(neighbors.get(selected) ?? [])]) : null;
    return nodes.map((n) => ({
      ...n,
      selected: n.id === selected,
      data: {
        ...n.data,
        highlighted: pathNodes.has(n.id) || (!!q && n.data.label.toLowerCase().includes(q)),
        dimmed: (ctx ? !ctx.has(n.id) : false) && !pathNodes.has(n.id),
      },
    }));
  }, [nodes, selected, neighbors, pathNodes, q]);

  const edges: Edge[] = useMemo(
    () =>
      (data?.edges ?? [])
        .filter((e) => !hidden.has(e.source) && !hidden.has(e.target))
        .map((e) => {
          const active = pathEdges.has(e.id) || (selected != null && (e.source === selected || e.target === selected));
          const meta = e.kind === "RELATIONSHIP" ? relationshipMeta(e.type, customTypes) : null;
          return {
            id: e.id,
            source: e.source,
            target: e.target,
            type: "straight",
            label: active ? (meta ? meta.label : humanize(e.type)) : undefined,
            style: {
              stroke: active ? "#D6BD8D" : e.modified ? "#8D80B8" : e.kind === "PARTICIPATION" ? "#34353f" : "#4a4b57",
              strokeWidth: active ? 1.8 : 1,
              strokeDasharray: e.kind === "PARTICIPATION" ? "3 4" : undefined,
              opacity: selected && !active && !pathEdges.size ? 0.25 : 1,
            },
            animated: pathEdges.has(e.id),
          } satisfies Edge;
        }),
    [data, hidden, pathEdges, selected, customTypes],
  );

  const onNodeClick: NodeMouseHandler = (_, node) => {
    if (pathFrom && pathFrom !== node.id) {
      void findPath(pathFrom, node.id);
      setPathFrom(null);
    }
    setSelected(node.id);
  };

  const findPath = async (from: string, to: string) => {
    const res = await fetch(`/api/worlds/${worldId}/graph/path?from=${from}&to=${to}&tl=${tl}`);
    const body = await res.json();
    if (!res.ok) return void toast.error(body.error ?? "Path search failed.");
    if (!body.path) {
      toast.message("No connection found within six steps.");
      setPathEdges(new Set());
      setPathNodes(new Set());
      return;
    }
    setPathNodes(new Set(body.path));
    setPathEdges(new Set(body.edges));
    const missing = (body.path as string[]).filter((id) => !data?.nodes.some((n) => n.id === id));
    if (missing.length) setFocus((f) => [...new Set([...f, ...(body.path as string[])])]);
    toast.success(`Connected in ${body.path.length - 1} step(s).`);
  };

  const selectedNode = data?.nodes.find((n) => n.id === selected) ?? null;
  const selectedEdges = (data?.edges ?? []).filter((e) => selected && (e.source === selected || e.target === selected) && e.kind === "RELATIONSHIP");
  const labelOf = (id: string) => data?.nodes.find((n) => n.id === id)?.label ?? "…";

  const onConnect = (c: Connection) => {
    if (!canWrite || !c.source || !c.target || c.source === c.target) return;
    if (c.source.startsWith("ev:") || c.target.startsWith("ev:")) return void toast.message("Link events to entities from the event page.");
    setConnect({ source: c.source, target: c.target });
  };

  return (
    <div className="relative h-[calc(100dvh-3rem)] w-full overflow-hidden bg-bg">
      <ReactFlow
        nodes={decoratedNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onPaneClick={() => setSelected(null)}
        onConnect={onConnect}
        nodesConnectable={canWrite}
        minZoom={0.1}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        aria-label="Relationship graph"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#2a2b34" />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap pannable zoomable position="bottom-right" className="!hidden md:!block" nodeColor={(n) => (n.id === selected ? "#D6BD8D" : "#3d3e49")} maskColor="rgba(16,17,22,0.75)" />
      </ReactFlow>

      {/* Toolbar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start gap-2 p-3">
        <div className="pointer-events-auto relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-[18px] z-10 size-4 -translate-y-1/2 text-muted" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find in graph…" className="bg-surface/95 pl-9 backdrop-blur" aria-label="Find a node" />
          {searchHits.length ? (
            <ul className="absolute inset-x-0 top-10 z-10 rounded-lg border border-border bg-surface p-1 shadow-pop">
              {searchHits.map((h) => (
                <li key={h.id}>
                  <button
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                    onClick={() => {
                      setSelected(h.id);
                      setSearch("");
                      const n = nodes.find((x) => x.id === h.id);
                      if (n) flow.setCenter(n.position.x, n.position.y, { zoom: 1.2, duration: 500 });
                    }}
                  >
                    {h.kind === "ENTITY" ? <EntityIcon type={h.type as EntityTypeKey} /> : <Diamond className="size-4 text-muted" />} {h.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <NativeSelect aria-label="Timeline" value={tl} onChange={(e) => { setTl(e.target.value); setPathEdges(new Set()); setPathNodes(new Set()); }} className="pointer-events-auto w-auto bg-surface/95">
          {timelines.map((t) => <option key={t.id} value={t.id}>{t.isMain ? `${t.name} (canon)` : t.name}</option>)}
        </NativeSelect>
        <Button variant="secondary" size="md" className="pointer-events-auto" aria-expanded={showFilters} onClick={() => setShowFilters((s) => !s)}>
          <SlidersHorizontal /> Filters{settings.types.length + settings.rels.length ? ` (${settings.types.length + settings.rels.length})` : ""}
        </Button>
        {focus.length ? (
          <Button variant="secondary" className="pointer-events-auto" onClick={() => { setFocus([]); setHidden(new Set()); setPathEdges(new Set()); setPathNodes(new Set()); }}>
            <RotateCcw /> Overview
          </Button>
        ) : null}
        {hidden.size ? <Button variant="ghost" className="pointer-events-auto" onClick={() => setHidden(new Set())}><EyeOff /> Show {hidden.size} hidden</Button> : null}
        <div className="pointer-events-auto ml-auto flex items-center gap-2 rounded-md border border-border bg-surface/95 px-3 py-1.5 text-xs text-muted backdrop-blur" aria-live="polite">
          {status === "loading" ? <><Loader2 className="size-3.5 animate-spin" /> Loading…</> : status === "error" ? <span className="text-[#e7a3a3]">{error}</span> : (
            <>{data?.nodes.length} of {data?.totalEntities} entities{data?.truncated ? " · limited — focus or filter to see more" : ""}</>
          )}
        </div>
      </div>

      {pathFrom ? (
        <div role="status" className="absolute left-1/2 top-16 -translate-x-1/2 rounded-full border border-gold/40 bg-surface px-4 py-1.5 text-xs text-gold shadow-pop">
          Select another node to trace the shortest connection · <button className="underline" onClick={() => setPathFrom(null)}>cancel</button>
        </div>
      ) : null}

      <AnimatePresence>
        {showFilters ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute left-3 top-16 z-10 w-[min(380px,calc(100vw-24px))] rounded-xl border border-border bg-surface p-4 shadow-pop"
          >
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-medium"><Filter className="size-4" /> Filters</h2>
              <Button variant="ghost" size="icon-sm" aria-label="Close filters" onClick={() => setShowFilters(false)}><X /></Button>
            </div>
            <fieldset className="mt-3">
              <legend className="wf-eyebrow mb-1.5">Entity types</legend>
              <div className="flex flex-wrap gap-1">
                {ENTITY_TYPES.map((t) => {
                  const on = settings.types.includes(t);
                  return (
                    <button key={t} aria-pressed={on} onClick={() => setSettings((s) => ({ ...s, types: on ? s.types.filter((x) => x !== t) : [...s.types, t] }))} className={cn("rounded-full border px-2 py-0.5 text-xs", on ? "border-gold/60 bg-gold/10 text-gold" : "border-border text-text-2 hover:border-border-strong")}>
                      {ENTITY_TYPE_META[t].plural}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <fieldset className="mt-3">
              <legend className="wf-eyebrow mb-1.5">Relationship types</legend>
              <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                {[...BUILTIN_RELATIONSHIP_KEYS, ...customTypes.map((c) => c.key)].map((t) => {
                  const on = settings.rels.includes(t);
                  return (
                    <button key={t} aria-pressed={on} onClick={() => setSettings((s) => ({ ...s, rels: on ? s.rels.filter((x) => x !== t) : [...s.rels, t] }))} className={cn("rounded-full border px-2 py-0.5 text-xs", on ? "border-gold/60 bg-gold/10 text-gold" : "border-border text-text-2 hover:border-border-strong")}>
                      {relationshipMeta(t, customTypes).label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Expansion depth" htmlFor="depth">
                <NativeSelect id="depth" value={settings.depth} onChange={(e) => setSettings((s) => ({ ...s, depth: Number(e.target.value) }))}>
                  <option value={1}>1 step</option><option value={2}>2 steps</option><option value={3}>3 steps</option>
                </NativeSelect>
              </Field>
              <label className="mt-6 flex items-center gap-2 text-sm text-text-2">
                <input type="checkbox" className="accent-[#D6BD8D]" checked={settings.events} onChange={(e) => setSettings((s) => ({ ...s, events: e.target.checked }))} /> Show events
              </label>
            </div>
            <p className="mt-3 text-xs text-muted">Filters apply to the server query, so large universes stay fast. They are remembered on this device.</p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Inspector */}
      <AnimatePresence>
        {selectedNode ? (
          <motion.aside
            key={selectedNode.id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-3 right-3 top-16 z-10 flex w-[min(340px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-pop"
            aria-label="Inspector"
          >
            <div className="flex items-start justify-between gap-2 border-b border-border p-4">
              <div className="min-w-0">
                <div className="wf-eyebrow">{selectedNode.kind === "EVENT" ? `Event · Year ${selectedNode.year}` : ENTITY_TYPE_META[selectedNode.type as EntityTypeKey]?.label}{selectedNode.status ? ` · ${humanize(selectedNode.status)}` : ""}</div>
                <h2 className="mt-1 truncate font-serif text-2xl font-semibold">{selectedNode.label}</h2>
                {selectedNode.modified ? <Badge tone="violet" className="mt-1">changed in this timeline</Badge> : null}
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="Close inspector" onClick={() => setSelected(null)}><X /></Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {selectedNode.summary ? <p className="text-sm text-text-2">{selectedNode.summary}</p> : null}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button size="sm" variant="secondary" onClick={() => setFocus((f) => [...new Set([...f, selectedNode.id])])}><Expand /> Expand</Button>
                <Button size="sm" variant="secondary" onClick={() => { setFocus([selectedNode.id]); setHidden(new Set()); }}><Crosshair /> Focus</Button>
                <Button size="sm" variant="secondary" onClick={() => { setPathFrom(selectedNode.id); setPathEdges(new Set()); setPathNodes(new Set()); }}><Route /> Path to…</Button>
                <Button size="sm" variant="secondary" onClick={() => { setHidden((h) => new Set([...h, selectedNode.id])); setSelected(null); }}><EyeOff /> Hide</Button>
              </div>
              <Button asChild size="sm" variant="primary" className="mt-2 w-full">
                <Link href={selectedNode.kind === "EVENT" ? `/worlds/${worldId}/events/${selectedNode.id.slice(3)}` : entityHref(worldId, selectedNode.type as EntityTypeKey, selectedNode.id)}><ExternalLink /> Open page</Link>
              </Button>
              {selectedEdges.length ? (
                <div className="mt-4">
                  <h3 className="wf-eyebrow mb-1.5">Connections in view</h3>
                  <ul className="flex flex-col gap-1">
                    {selectedEdges.map((e) => {
                      const out = e.source === selectedNode.id;
                      const m = relationshipMeta(e.type, customTypes);
                      return (
                        <li key={e.id}>
                          <button className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-surface-2" onClick={() => setSelected(out ? e.target : e.source)}>
                            <span className="w-24 shrink-0 text-muted">{out || m.symmetric ? m.label : m.inverseLabel}</span>
                            <span className="truncate text-text">{labelOf(out ? e.target : e.source)}</span>
                            {e.from != null || e.to != null ? <span className="ml-auto shrink-0 text-muted">{e.from ?? "?"}–{e.to ?? ""}</span> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              {canWrite ? <p className="mt-4 text-xs text-muted">Tip: drag from the bottom of one node to another to create a relationship.</p> : null}
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      {status === "ready" && data && data.nodes.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="max-w-sm rounded-xl border border-dashed border-border bg-surface/90 p-6 text-center">
            <p className="font-serif text-xl">Nothing to show yet</p>
            <p className="mt-1 text-sm text-text-2">{settings.types.length || settings.rels.length ? "No records match the current filters." : "Create entities and connect them — they will appear here."}</p>
            {settings.types.length || settings.rels.length ? <Button className="mt-3" size="sm" onClick={() => setSettings((s) => ({ ...s, types: [], rels: [] }))}>Clear filters</Button> : null}
          </div>
        </div>
      ) : null}

      <ConnectDialog
        worldId={worldId}
        pair={connect}
        labelOf={labelOf}
        customTypes={customTypes}
        timelineId={tl}
        onClose={() => setConnect(null)}
        onCreated={() => {
          setConnect(null);
          void load();
          router.refresh();
        }}
      />
    </div>
  );
}

function ConnectDialog({ worldId, pair, labelOf, customTypes, timelineId, onClose, onCreated }: {
  worldId: string;
  pair: { source: string; target: string } | null;
  labelOf: (id: string) => string;
  customTypes: { key: string; label: string; inverse: string | null }[];
  timelineId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [type, setType] = useState("ALLY_OF");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog open={!!pair} onOpenChange={(o) => !o && onClose()}>
      {pair ? (
        <DialogContent size="sm" title="Create relationship" description={`${labelOf(pair.source)} → ${labelOf(pair.target)}`}>
          <div className="flex flex-col gap-4">
            <FormError message={error} />
            <Field label="Relationship type" htmlFor="connect-type">
              <NativeSelect id="connect-type" value={type} onChange={(e) => setType(e.target.value)}>
                {[...BUILTIN_RELATIONSHIP_KEYS, ...customTypes.map((c) => c.key)].map((k) => <option key={k} value={k}>{relationshipMeta(k, customTypes).label}</option>)}
              </NativeSelect>
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button
                variant="primary"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const r = await createRelationshipAction(worldId, { sourceId: pair.source, targetId: pair.target, type, timelineId });
                    if (!r.ok) return setError(r.error);
                    toast.success("Relationship created");
                    onCreated();
                  })
                }
              >
                {pending ? "Saving…" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
