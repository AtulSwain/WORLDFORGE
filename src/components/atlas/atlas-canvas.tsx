"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ExternalLink, Hand, Layers, MapPin, Minus, Plus, Route as RouteIcon, Save, Spline, Trash2, X, Maximize } from "lucide-react";
import { toast } from "sonner";
import { entityHref, humanize, type EntityTypeKey } from "@/domain/catalog";
import { createRegionAction, createRouteAction, deleteRegionAction, deleteRouteAction, placeMarkerAction, removeMarkerAction, saveMapViewAction } from "@/server/actions/maps";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { RecordPicker, type PickOption } from "@/components/ui/pickers";
import { EntityIcon } from "@/components/world/entity-visual";
import { cn } from "@/lib/utils";

export interface AtlasMarker {
  entityId: string;
  name: string;
  type: string;
  x: number;
  y: number;
  summary: string;
  status: string;
  category?: string;
  controlledBy: { id: string; name: string }[];
  people: { id: string; name: string; type: string }[];
  events: { id: string; title: string; date: string }[];
}
export interface AtlasRoute { id: string; name: string; kind: string; points: [number, number][] }
export interface AtlasRegion { id: string; name: string; color: string; faction: { id: string; name: string } | null; polygon: [number, number][] }
interface Layers { markers: boolean; routes: boolean; regions: boolean; labels: boolean }

type Mode = "select" | "place" | "route" | "region";
type Selection = { kind: "marker"; id: string } | { kind: "route"; id: string } | { kind: "region"; id: string } | null;

const ROUTE_STYLE: Record<string, { stroke: string; dash?: string; width: number }> = {
  TRADE: { stroke: "#D6BD8D", dash: "10 8", width: 3 },
  ROAD: { stroke: "#a49274", dash: "6 6", width: 2 },
  SEA: { stroke: "#5f7f9b", dash: "2 8", width: 2.5 },
  RIVER: { stroke: "#4b6a80", width: 3 },
  PATH: { stroke: "#8f7e5c", dash: "2 5", width: 1.5 },
};

export function AtlasCanvas({
  worldId,
  map,
  markers: initialMarkers,
  routes,
  regions,
  unplaced,
  factions,
  canWrite,
  focusId,
}: {
  worldId: string;
  map: { id: string; title: string; imageSource: string; width: number; height: number; layers: Layers; viewport: { x: number; y: number; zoom: number } };
  markers: AtlasMarker[];
  routes: AtlasRoute[];
  regions: AtlasRegion[];
  unplaced: PickOption[];
  factions: PickOption[];
  canWrite: boolean;
  focusId: string | null;
}) {
  const router = useRouter();
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ tx: 0, ty: 0, z: map.viewport.zoom });
  const [layers, setLayers] = useState<Layers>(map.layers);
  const [markers, setMarkers] = useState(initialMarkers);
  const [mode, setMode] = useState<Mode>("select");
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [draftMeta, setDraftMeta] = useState({ name: "", kind: "ROAD", factionId: null as string | null, color: "#D6BD8D" });
  const [sel, setSel] = useState<Selection>(focusId ? { kind: "marker", id: focusId } : null);
  const [showLayers, setShowLayers] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [pending, start] = useTransition();
  const pan = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);
  const dragMarker = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);

  useEffect(() => setMarkers(initialMarkers), [initialMarkers]);

  // Center on a viewport (image coordinates) once the container size is known.
  const centerOn = useCallback((x: number, y: number, z: number) => {
    setView({ z, tx: size.w / 2 - x * z, ty: size.h / 2 - y * z });
  }, [size]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e!.contentRect.width, h: e!.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const framed = useRef(false);
  useEffect(() => {
    if (framed.current || size.w < 50) return;
    framed.current = true;
    const f = initialMarkers.find((m) => m.entityId === focusId);
    if (f) centerOn(f.x, f.y, Math.max(map.viewport.zoom, 1));
    else {
      const fit = Math.min(size.w / map.width, size.h / map.height);
      centerOn(map.viewport.x, map.viewport.y, map.viewport.zoom || fit);
    }
  }, [size, centerOn, initialMarkers, focusId, map]);

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setView((v) => {
      const z = Math.min(Math.max(v.z * factor, 0.08), 6);
      const ix = (cx - v.tx) / v.z;
      const iy = (cy - v.ty) / v.z;
      return { z, tx: cx - ix * z, ty: cy - iy * z };
    });
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const toImage = (clientX: number, clientY: number): [number, number] => {
    const r = wrap.current!.getBoundingClientRect();
    return [(clientX - r.left - view.tx) / view.z, (clientY - r.top - view.ty) / view.z];
  };
  const clampPt = ([x, y]: [number, number]): [number, number] => [Math.min(Math.max(x, 0), map.width), Math.min(Math.max(y, 0), map.height)];

  const onBackgroundClick = (e: React.MouseEvent) => {
    if (pan.current?.moved) return;
    const pt = clampPt(toImage(e.clientX, e.clientY));
    if (mode === "place") {
      if (!placeId) return void toast.message("Choose a location to place first.");
      const entity = unplaced.find((u) => u.id === placeId);
      start(async () => {
        const r = await placeMarkerAction(worldId, map.id, placeId, Math.round(pt[0]), Math.round(pt[1]));
        if (!r.ok) return void toast.error(r.error);
        toast.success(`${entity?.name ?? "Location"} placed`);
        setPlaceId(null);
        setMode("select");
        router.refresh();
      });
      return;
    }
    if (mode === "route" || mode === "region") {
      setDraft((d) => [...d, [Math.round(pt[0]), Math.round(pt[1])]]);
      return;
    }
    setSel(null);
  };

  const finishDraft = () =>
    start(async () => {
      if (!draftMeta.name.trim()) return void toast.error("Name it first.");
      const r =
        mode === "route"
          ? await createRouteAction(worldId, map.id, { name: draftMeta.name, kind: draftMeta.kind, points: draft })
          : await createRegionAction(worldId, map.id, { name: draftMeta.name, factionId: draftMeta.factionId, color: draftMeta.color, polygon: draft });
      if (!r.ok) return void toast.error(r.error);
      toast.success(mode === "route" ? "Route saved" : "Region saved");
      setDraft([]);
      setDraftMeta({ name: "", kind: "ROAD", factionId: null, color: "#D6BD8D" });
      setMode("select");
      router.refresh();
    });

  const saveView = () =>
    start(async () => {
      const center = { x: (size.w / 2 - view.tx) / view.z, y: (size.h / 2 - view.ty) / view.z };
      const r = await saveMapViewAction(worldId, map.id, { layers, viewport: { x: Math.round(center.x), y: Math.round(center.y), zoom: Number(view.z.toFixed(3)) } });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Saved as this map's default view and layers");
    });

  const visibleMarkers = useMemo(() => markers.filter((m) => !filterType || m.type === filterType), [markers, filterType]);
  const selMarker = sel?.kind === "marker" ? markers.find((m) => m.entityId === sel.id) : null;
  const selRoute = sel?.kind === "route" ? routes.find((r) => r.id === sel.id) : null;
  const selRegion = sel?.kind === "region" ? regions.find((r) => r.id === sel.id) : null;
  const markerTypes = [...new Set(markers.map((m) => m.type))];

  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-bg-2 px-3 py-2">
        <h1 className="mr-1 font-serif text-xl font-semibold">{map.title}</h1>
        <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Tool">
          {([
            ["select", Hand, "Explore"],
            ...(canWrite ? ([["place", MapPin, "Place location"], ["route", RouteIcon, "Draw route"], ["region", Spline, "Draw region"]] as const) : []),
          ] as const).map(([m, Icon, label]) => (
            <button key={m} aria-pressed={mode === m} onClick={() => { setMode(m); setDraft([]); }} className={cn("flex items-center gap-1.5 rounded px-2 py-1 text-xs", mode === m ? "bg-surface-2 text-gold" : "text-text-2 hover:text-text")}>
              <Icon className="size-3.5" /> <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        {mode === "place" ? (
          <div className="w-56"><RecordPicker options={unplaced} value={placeId} onChange={setPlaceId} placeholder={unplaced.length ? "Location to place…" : "All locations placed"} /></div>
        ) : null}
        <NativeSelect aria-label="Filter markers" value={filterType} onChange={(e) => setFilterType(e.target.value)} className="h-8 w-auto text-xs">
          <option value="">All markers</option>
          {markerTypes.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
        </NativeSelect>
        <div className="relative">
          <Button variant="secondary" size="sm" aria-expanded={showLayers} onClick={() => setShowLayers((s) => !s)}><Layers /> Layers</Button>
          {showLayers ? (
            <div className="absolute left-0 top-10 z-20 w-48 rounded-lg border border-border bg-surface p-2 shadow-pop">
              {(Object.keys(layers) as (keyof Layers)[]).map((k) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface-2">
                  <input type="checkbox" className="accent-[#D6BD8D]" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} /> {humanize(k)}
                </label>
              ))}
            </div>
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={() => zoomAt(0.7, size.w / 2, size.h / 2)}><Minus /></Button>
          <Button variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={() => zoomAt(1.4, size.w / 2, size.h / 2)}><Plus /></Button>
          <Button variant="ghost" size="icon-sm" aria-label="Fit map" onClick={() => centerOn(map.width / 2, map.height / 2, Math.min(size.w / map.width, size.h / map.height))}><Maximize /></Button>
          {canWrite ? <Button variant="secondary" size="sm" onClick={saveView} disabled={pending}><Save /> Save view</Button> : null}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={wrap}
          className={cn("absolute inset-0 touch-none overflow-hidden bg-[#0d0f14]", mode === "select" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair")}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("[data-marker],[data-shape]")) return;
            pan.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false };
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (dragMarker.current) {
              const [x, y] = clampPt(toImage(e.clientX, e.clientY));
              dragMarker.current.moved = true;
              const id = dragMarker.current.id;
              setMarkers((ms) => ms.map((m) => (m.entityId === id ? { ...m, x, y } : m)));
              return;
            }
            if (!pan.current) return;
            const dx = e.clientX - pan.current.x;
            const dy = e.clientY - pan.current.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) pan.current.moved = true;
            setView((v) => ({ ...v, tx: pan.current!.tx + dx, ty: pan.current!.ty + dy }));
          }}
          onPointerUp={(e) => {
            if (dragMarker.current) {
              const d = dragMarker.current;
              dragMarker.current = null;
              if (d.moved) {
                const m = markers.find((x) => x.entityId === d.id)!;
                start(async () => {
                  const r = await placeMarkerAction(worldId, map.id, d.id, Math.round(m.x), Math.round(m.y));
                  if (!r.ok) {
                    toast.error(r.error);
                    setMarkers(initialMarkers);
                  } else toast.success(`${m.name} moved`);
                });
              } else setSel({ kind: "marker", id: d.id });
              return;
            }
            if (pan.current && !pan.current.moved) onBackgroundClick(e);
            setTimeout(() => (pan.current = null), 0);
          }}
          role="application"
          aria-label={`Map of ${map.title}. Drag to pan, scroll to zoom.`}
        >
          <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.z})`, width: map.width, height: map.height }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- large static or user map artwork rendered at native resolution */}
            <img src={map.imageSource} alt={`${map.title} map`} width={map.width} height={map.height} draggable={false} className="pointer-events-none block select-none" />
            <svg className="absolute inset-0" width={map.width} height={map.height} viewBox={`0 0 ${map.width} ${map.height}`}>
              {layers.regions
                ? regions.map((r) => (
                    <g key={r.id} data-shape onClick={(e) => { e.stopPropagation(); setSel({ kind: "region", id: r.id }); }} className="cursor-pointer">
                      <polygon points={r.polygon.map((p) => p.join(",")).join(" ")} fill={r.color} fillOpacity={sel?.kind === "region" && sel.id === r.id ? 0.22 : 0.09} stroke={r.color} strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="8 6" vectorEffect="non-scaling-stroke" />
                      {layers.labels ? <text x={centroid(r.polygon)[0]} y={centroid(r.polygon)[1]} textAnchor="middle" fill={r.color} fillOpacity={0.75} fontSize={Math.max(14, 22 / view.z)} fontFamily="Georgia, serif" letterSpacing="4" style={{ textTransform: "uppercase" }} pointerEvents="none">{r.name}</text> : null}
                    </g>
                  ))
                : null}
              {layers.routes
                ? routes.map((r) => {
                    const st = ROUTE_STYLE[r.kind] ?? ROUTE_STYLE.ROAD!;
                    const active = sel?.kind === "route" && sel.id === r.id;
                    return (
                      <g key={r.id} data-shape className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSel({ kind: "route", id: r.id }); }}>
                        <polyline points={r.points.map((p) => p.join(",")).join(" ")} fill="none" stroke="transparent" strokeWidth={14} vectorEffect="non-scaling-stroke" />
                        <polyline points={r.points.map((p) => p.join(",")).join(" ")} fill="none" stroke={active ? "#e4cfa6" : st.stroke} strokeWidth={active ? st.width + 1.5 : st.width} strokeDasharray={st.dash} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={0.85} />
                      </g>
                    );
                  })
                : null}
              {draft.length ? (
                mode === "region" ? (
                  <polygon points={draft.map((p) => p.join(",")).join(" ")} fill={draftMeta.color} fillOpacity={0.15} stroke={draftMeta.color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                ) : (
                  <polyline points={draft.map((p) => p.join(",")).join(" ")} fill="none" stroke="#D6BD8D" strokeWidth={2.5} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
                )
              ) : null}
              {draft.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={5 / view.z} fill="#D6BD8D" />)}
            </svg>
          </div>

          {/* Markers keep a constant on-screen size */}
          {layers.markers
            ? visibleMarkers.map((m) => {
                const sx = m.x * view.z + view.tx;
                const sy = m.y * view.z + view.ty;
                if (sx < -40 || sy < -40 || sx > size.w + 40 || sy > size.h + 40) return null;
                const active = sel?.kind === "marker" && sel.id === m.entityId;
                return (
                  <button
                    key={m.entityId}
                    data-marker
                    aria-label={`${m.name} (${humanize(m.type)})`}
                    className="group absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
                    style={{ left: sx, top: sy }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (canWrite && mode === "select") {
                        dragMarker.current = { id: m.entityId, dx: 0, dy: 0, moved: false };
                        wrap.current?.setPointerCapture(e.pointerId);
                      } else setSel({ kind: "marker", id: m.entityId });
                    }}
                    onKeyDown={(e) => e.key === "Enter" && setSel({ kind: "marker", id: m.entityId })}
                  >
                    {layers.labels ? (
                      <span className={cn("mb-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium shadow", active ? "bg-gold text-bg" : "bg-bg/85 text-text group-hover:text-gold")}>{m.name}</span>
                    ) : null}
                    <svg width="22" height="28" viewBox="0 0 22 28" aria-hidden="true" className={cn("drop-shadow transition-transform", active && "scale-125")}>
                      <path d="M11 27s9-9.5 9-16a9 9 0 0 0-18 0c0 6.5 9 16 9 16z" fill={active ? "#D6BD8D" : "#1C1D24"} stroke="#D6BD8D" strokeWidth="1.5" />
                      <circle cx="11" cy="11" r="3.2" fill={active ? "#101116" : "#D6BD8D"} />
                    </svg>
                  </button>
                );
              })
            : null}

          {markers.length === 0 && mode === "select" ? (
            <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
              <p className="rounded-full border border-border bg-surface/95 px-4 py-2 text-sm text-text-2">{canWrite ? "No locations placed yet — choose “Place location” to add markers." : "No locations have been placed on this map."}</p>
            </div>
          ) : null}
        </div>

        {(mode === "route" || mode === "region") && canWrite ? (
          <div className="absolute bottom-4 left-1/2 z-10 flex w-[min(640px,calc(100vw-24px))] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3 shadow-pop">
            <span className="text-xs text-text-2">{draft.length} point{draft.length === 1 ? "" : "s"} · click the map to add</span>
            <Input value={draftMeta.name} onChange={(e) => setDraftMeta({ ...draftMeta, name: e.target.value })} placeholder={mode === "route" ? "Route name" : "Region name"} className="h-8 w-40" aria-label="Name" />
            {mode === "route" ? (
              <NativeSelect aria-label="Route kind" value={draftMeta.kind} onChange={(e) => setDraftMeta({ ...draftMeta, kind: e.target.value })} className="h-8 w-28">
                {Object.keys(ROUTE_STYLE).map((k) => <option key={k} value={k}>{humanize(k)}</option>)}
              </NativeSelect>
            ) : (
              <>
                <div className="w-44"><RecordPicker options={factions} value={draftMeta.factionId} onChange={(v) => setDraftMeta({ ...draftMeta, factionId: v })} placeholder="Faction (optional)" /></div>
                <input type="color" aria-label="Region colour" value={draftMeta.color} onChange={(e) => setDraftMeta({ ...draftMeta, color: e.target.value })} className="h-8 w-10 rounded border border-border bg-transparent" />
              </>
            )}
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setDraft((d) => d.slice(0, -1))} disabled={!draft.length}>Undo</Button>
              <Button size="sm" variant="ghost" onClick={() => { setDraft([]); setMode("select"); }}><X /> Cancel</Button>
              <Button size="sm" variant="primary" onClick={finishDraft} disabled={pending || draft.length < (mode === "route" ? 2 : 3)}><Check /> Save</Button>
            </div>
          </div>
        ) : null}

        <AnimatePresence>
          {selMarker || selRoute || selRegion ? (
            <motion.aside
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.18 }}
              className="absolute bottom-3 right-3 top-3 z-10 flex w-[min(340px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-pop"
              aria-label="Location inspector"
            >
              <div className="flex items-start justify-between gap-2 border-b border-border p-4">
                <div className="min-w-0">
                  <div className="wf-eyebrow">{selMarker ? `${humanize(selMarker.type)}${selMarker.category ? ` · ${selMarker.category}` : ""}` : selRoute ? `Route · ${humanize(selRoute.kind)}` : "Region"}</div>
                  <h2 className="mt-1 font-serif text-2xl font-semibold">{selMarker?.name ?? selRoute?.name ?? selRegion?.name}</h2>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={() => setSel(null)}><X /></Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 text-sm">
                {selMarker ? (
                  <div className="flex flex-col gap-4">
                    <p className="text-text-2">{selMarker.summary || "No summary."}</p>
                    {selMarker.controlledBy.length ? <div><h3 className="wf-eyebrow mb-1">Controlled by</h3>{selMarker.controlledBy.map((c) => <Link key={c.id} href={entityHref(worldId, "FACTION", c.id)} className="block hover:text-gold">{c.name}</Link>)}</div> : null}
                    {selMarker.people.length ? (
                      <div><h3 className="wf-eyebrow mb-1">Connected</h3>
                        <ul className="flex flex-col gap-0.5">{selMarker.people.map((c) => <li key={c.id}><Link href={entityHref(worldId, c.type as EntityTypeKey, c.id)} className="flex items-center gap-1.5 hover:text-gold"><EntityIcon type={c.type as EntityTypeKey} className="size-3.5" />{c.name}</Link></li>)}</ul>
                      </div>
                    ) : null}
                    {selMarker.events.length ? (
                      <div><h3 className="wf-eyebrow mb-1">Events here</h3>
                        <ul className="flex flex-col gap-1">{selMarker.events.map((ev) => <li key={ev.id} className="flex justify-between gap-2"><Link href={`/worlds/${worldId}/events/${ev.id}`} className="truncate hover:text-gold">{ev.title}</Link><span className="shrink-0 text-xs text-muted">{ev.date}</span></li>)}</ul>
                      </div>
                    ) : null}
                  </div>
                ) : selRegion ? (
                  <p className="text-text-2">{selRegion.faction ? <>Territory of <Link className="text-gold hover:underline" href={entityHref(worldId, "FACTION", selRegion.faction.id)}>{selRegion.faction.name}</Link>.</> : "A region without a controlling faction."}</p>
                ) : (
                  <p className="text-text-2">{selRoute!.points.length} waypoints.</p>
                )}
              </div>
              <div className="flex gap-2 border-t border-border p-3">
                {selMarker ? <Button asChild size="sm" variant="primary" className="flex-1"><Link href={entityHref(worldId, selMarker.type as EntityTypeKey, selMarker.entityId)}><ExternalLink /> Open page</Link></Button> : null}
                {canWrite ? (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = selMarker
                          ? await removeMarkerAction(worldId, map.id, selMarker.entityId)
                          : selRoute
                            ? await deleteRouteAction(worldId, map.id, selRoute.id)
                            : await deleteRegionAction(worldId, map.id, selRegion!.id);
                        if (!r.ok) return void toast.error(r.error);
                        toast.success(selMarker ? "Marker removed (the location itself is unchanged)" : "Removed from map");
                        setSel(null);
                        router.refresh();
                      })
                    }
                  >
                    <Trash2 /> {selMarker ? "Remove marker" : "Delete"}
                  </Button>
                ) : null}
              </div>
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function centroid(pts: [number, number][]): [number, number] {
  const n = pts.length || 1;
  return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
}
