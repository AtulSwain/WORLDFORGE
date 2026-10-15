"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, Flame, GitBranch, Minus, Pencil, Plus, Search, X, Crosshair } from "lucide-react";
import { toast } from "sonner";
import { EVENT_TYPES, humanize } from "@/domain/catalog";
import { MONTH_SCALE, YEAR_SCALE, type CalendarConfig } from "@/domain/chronology";
import { createBranchAction } from "@/server/actions/timelines";
import { Button } from "@/components/ui/button";
import { Badge, CanonBadge } from "@/components/ui/badge";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export interface ChronoEvent {
  id: string;
  title: string;
  type: string;
  start: number;
  end: number;
  hasSpan: boolean;
  dateLabel: string;
  importance: number;
  locationId: string | null;
  participants: { id: string; role: string }[];
  canonStatus: string;
  modified: boolean;
  branchOnly: boolean;
  description: string;
}

interface Props {
  worldId: string;
  timeline: { id: string; name: string; isMain: boolean };
  timelines: { id: string; name: string; isMain: boolean }[];
  events: ChronoEvent[];
  calendar: CalendarConfig;
  names: Record<string, string>;
  factions: { id: string; name: string }[];
  characters: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  memberships: Record<string, string[]>;
  canWrite: boolean;
  focusId: string | null;
}

const SCALES = [
  { id: "ERA", label: "Eras", pxPerYear: 0.8 },
  { id: "CENTURY", label: "Centuries", pxPerYear: 6 },
  { id: "DECADE", label: "Decades", pxPerYear: 40 },
  { id: "YEAR", label: "Years", pxPerYear: 220 },
  { id: "MONTH", label: "Months", pxPerYear: 2600 },
  { id: "DAY", label: "Days", pxPerYear: 60000 },
] as const;

const LANE_H = 46;
const AXIS_H = 44;
const LABEL_W = 176;
const MIN_PX = 0.05;
const MAX_PX = 400000;

export function Chronos(p: Props) {
  const router = useRouter();
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(600);
  const [pxPerYear, setPxPerYear] = useState(40);
  const [viewStart, setViewStart] = useState(0); // ordinal at left edge
  const [selected, setSelected] = useState<string | null>(p.focusId);
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({ faction: "", character: "", location: "", type: "" });
  const [branchFor, setBranchFor] = useState<ChronoEvent | null>(null);
  const drag = useRef<{ x: number; start: number } | null>(null);

  const pxPerOrd = pxPerYear / YEAR_SCALE;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setWidth(e!.contentRect.width);
      setHeight(e!.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Initial framing: the focused event, or the whole history. Needs the measured width.
  const framed = useRef(false);
  /* eslint-disable react-hooks/set-state-in-effect -- one-time sync with a DOM measurement */
  useEffect(() => {
    if (framed.current || width < 100) return;
    framed.current = true;
    const focus = p.events.find((e) => e.id === p.focusId);
    if (focus) {
      setPxPerYear(220);
      setViewStart(focus.start - (width / 2) * (YEAR_SCALE / 220));
      return;
    }
    if (!p.events.length) {
      const y = p.calendar.currentYear ?? 0;
      setViewStart((y - 20) * YEAR_SCALE);
      return;
    }
    const min = Math.min(...p.events.map((e) => e.start));
    const max = Math.max(...p.events.map((e) => e.end));
    const span = Math.max(max - min, YEAR_SCALE * 10);
    const ppy = Math.min(Math.max(((width - 160) / span) * YEAR_SCALE, MIN_PX), MAX_PX);
    setPxPerYear(ppy);
    setViewStart(min - (80 / ppy) * YEAR_SCALE);
  }, [width, p.events, p.focusId, p.calendar.currentYear]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const pxPerOrdRef = useRef(pxPerOrd);
  useEffect(() => {
    pxPerOrdRef.current = pxPerOrd;
  }, [pxPerOrd]);

  const zoomAt = useCallback(
    (factor: number, anchorX: number) => {
      setPxPerYear((old) => {
        const next = Math.min(Math.max(old * factor, MIN_PX), MAX_PX);
        setViewStart((vs) => vs + anchorX * (YEAR_SCALE / old) - anchorX * (YEAR_SCALE / next));
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) * 1.5) {
        zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left);
      } else {
        setViewStart((vs) => vs + e.deltaX / ((pxPerOrdRef.current ?? 1) || 1));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return p.events.filter((e) => {
      if (filters.type && e.type !== filters.type) return false;
      if (filters.location && e.locationId !== filters.location) return false;
      if (filters.character && !e.participants.some((x) => x.id === filters.character)) return false;
      if (filters.faction && !e.participants.some((x) => x.id === filters.faction || (p.memberships[x.id] ?? []).includes(filters.faction))) return false;
      if (needle && !e.title.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [p.events, filters, q, p.memberships]);

  const toX = (ord: number) => (ord - viewStart) * pxPerOrd;
  const viewEnd = viewStart + width / pxPerOrd;
  const maxLanes = Math.max(1, Math.floor((height - AXIS_H - 40) / LANE_H));

  // Virtualised lane packing: only events intersecting the viewport (plus margin) are laid out.
  const { placed, overflow } = useMemo(() => {
    const margin = LABEL_W / pxPerOrd;
    const visible = filtered
      .filter((e) => e.end >= viewStart - margin && e.start <= viewEnd + margin)
      .sort((a, b) => b.importance - a.importance || a.start - b.start);
    const laneEnds: number[][] = Array.from({ length: maxLanes }, () => []);
    const fits = (lane: number, a: number, b: number) => laneEnds[lane]!.every((_, i, arr) => i % 2 === 1 || b < arr[i]! || a > arr[i + 1]!);
    const placedOut: { e: ChronoEvent; lane: number; x: number; w: number }[] = [];
    const over = new Map<number, ChronoEvent[]>();
    for (const e of visible) {
      const x = (e.start - viewStart) * pxPerOrd;
      const w = Math.max((e.end - e.start) * pxPerOrd, 0);
      const a = x - 8;
      const b = x + Math.max(w, LABEL_W);
      let lane = -1;
      for (let l = 0; l < maxLanes; l++) if (fits(l, a, b)) { lane = l; break; }
      if (lane === -1) {
        const bucket = Math.floor(x / 140);
        over.set(bucket, [...(over.get(bucket) ?? []), e]);
        continue;
      }
      laneEnds[lane]!.push(a, b);
      placedOut.push({ e, lane, x, w });
    }
    return { placed: placedOut, overflow: [...over.entries()] };
  }, [filtered, viewStart, viewEnd, pxPerOrd, maxLanes]);

  // Axis ticks adapt from eras to days.
  const ticks = useMemo(() => {
    const out: { ord: number; label: string; major: boolean }[] = [];
    const months = p.calendar.monthNames.length || 12;
    const pxPerMonth = pxPerYear / months;
    if (pxPerMonth / 30 >= 34) {
      const startYear = Math.floor(viewStart / YEAR_SCALE);
      for (let y = startYear; y <= Math.ceil(viewEnd / YEAR_SCALE) && out.length < 400; y++) {
        for (let m = 1; m <= months; m++) {
          for (let d = 1; d <= 30; d++) {
            const ord = y * YEAR_SCALE + (m - 1) * MONTH_SCALE + (d - 1);
            if (ord < viewStart || ord > viewEnd) continue;
            out.push({ ord, label: d === 1 ? `${p.calendar.monthNames[m - 1] ?? `M${m}`} ${y}` : String(d), major: d === 1 });
          }
        }
      }
      return out;
    }
    if (pxPerMonth >= 60) {
      const startYear = Math.floor(viewStart / YEAR_SCALE);
      for (let y = startYear; y <= Math.ceil(viewEnd / YEAR_SCALE) && out.length < 400; y++) {
        for (let m = 1; m <= months; m++) {
          const ord = y * YEAR_SCALE + (m - 1) * MONTH_SCALE;
          if (ord < viewStart - YEAR_SCALE || ord > viewEnd) continue;
          out.push({ ord, label: m === 1 ? `${p.calendar.yearLabel} ${y}` : p.calendar.monthNames[m - 1] ?? `Month ${m}`, major: m === 1 });
        }
      }
      return out;
    }
    const steps = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    const step = steps.find((s) => s * pxPerYear >= 90) ?? 10000;
    const first = Math.floor(viewStart / YEAR_SCALE / step) * step;
    for (let y = first; y * YEAR_SCALE <= viewEnd && out.length < 400; y += step) {
      out.push({ ord: y * YEAR_SCALE, label: String(y), major: y % (step * 5) === 0 });
    }
    return out;
  }, [viewStart, viewEnd, pxPerYear, p.calendar]);

  const eras = useMemo(() => {
    const sorted = [...p.calendar.eras].sort((a, b) => a.startYear - b.startYear);
    return sorted.map((era, i) => ({ name: era.name, start: era.startYear * YEAR_SCALE, end: (sorted[i + 1]?.startYear ?? 1e9) * YEAR_SCALE, i }));
  }, [p.calendar.eras]);

  const selectedEvent = p.events.find((e) => e.id === selected) ?? null;
  const scaleId = [...SCALES].reverse().find((s) => pxPerYear >= s.pxPerYear * 0.6)?.id ?? "ERA";

  const setScale = (ppy: number) => {
    const center = viewStart + width / 2 / pxPerOrd;
    setPxPerYear(ppy);
    setViewStart(center - (width / 2) * (YEAR_SCALE / ppy));
  };
  const centerOn = (ord: number) => setViewStart(ord - (width / 2) / pxPerOrd);

  const switchTimeline = (id: string) => {
    const sp = new URLSearchParams(window.location.search);
    sp.set("tl", id);
    router.push(`?${sp}`);
  };

  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-bg-2 px-3 py-2">
        <h1 className="mr-1 font-serif text-xl font-semibold">Chronos</h1>
        <NativeSelect aria-label="Timeline" value={p.timeline.id} onChange={(e) => switchTimeline(e.target.value)} className="h-8 w-auto">
          {p.timelines.map((t) => <option key={t.id} value={t.id}>{t.isMain ? `${t.name} (canon)` : `⑂ ${t.name}`}</option>)}
        </NativeSelect>
        <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Time scale">
          {SCALES.map((s) => (
            <button key={s.id} onClick={() => setScale(s.pxPerYear)} aria-pressed={scaleId === s.id} className={cn("rounded px-2 py-1 text-xs", scaleId === s.id ? "bg-surface-2 text-gold" : "text-text-2 hover:text-text")}>
              {s.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={() => zoomAt(0.6, width / 2)}><Minus /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={() => zoomAt(1.6, width / 2)}><Plus /></Button>
        {p.calendar.currentYear != null ? (
          <Button variant="ghost" size="sm" onClick={() => centerOn(p.calendar.currentYear! * YEAR_SCALE)}><Crosshair /> Now</Button>
        ) : null}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events" className="h-8 w-40 pl-8 text-xs" aria-label="Search events" />
        </div>
        <NativeSelect aria-label="Filter by faction" value={filters.faction} onChange={(e) => setFilters({ ...filters, faction: e.target.value })} className="h-8 w-auto text-xs">
          <option value="">All factions</option>
          {p.factions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Filter by character" value={filters.character} onChange={(e) => setFilters({ ...filters, character: e.target.value })} className="h-8 w-auto text-xs">
          <option value="">All characters</option>
          {p.characters.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Filter by location" value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })} className="h-8 w-auto text-xs">
          <option value="">All locations</option>
          {p.locations.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Filter by event type" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className="h-8 w-auto text-xs">
          <option value="">All types</option>
          {EVENT_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
        </NativeSelect>
        <span className="ml-auto text-xs text-muted" aria-live="polite">{filtered.length} events{placed.length < filtered.length ? ` · ${placed.length} in view` : ""}</span>
        {p.canWrite ? (
          <Button asChild variant="primary" size="sm">
            <Link href={`/worlds/${p.worldId}/events/new?tl=${p.timeline.id}&year=${Math.round((viewStart + width / 2 / pxPerOrd) / YEAR_SCALE)}`}><Plus /> Event</Link>
          </Button>
        ) : null}
      </div>

      {!p.timeline.isMain ? (
        <div className="border-b border-violet/30 bg-violet/10 px-3 py-1.5 text-xs text-[#b9afdc]">
          Alternate timeline “{p.timeline.name}”: inherited events appear as in canon; <span className="font-medium">violet</span> markers show what this branch changed. Canon is never modified here.
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        {/* Canvas */}
        <div
          ref={wrap}
          tabIndex={0}
          role="application"
          aria-label="Timeline canvas. Drag or use arrow keys to pan, plus and minus to zoom."
          className="absolute inset-0 cursor-grab touch-none select-none overflow-hidden bg-bg active:cursor-grabbing"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, start: viewStart };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            setViewStart(drag.current.start - (e.clientX - drag.current.x) / pxPerOrd);
          }}
          onPointerUp={() => (drag.current = null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setViewStart((v) => v - 120 / pxPerOrd);
            if (e.key === "ArrowRight") setViewStart((v) => v + 120 / pxPerOrd);
            if (e.key === "+" || e.key === "=") zoomAt(1.5, width / 2);
            if (e.key === "-") zoomAt(1 / 1.5, width / 2);
            if (e.key === "Escape") setSelected(null);
          }}
        >
          {/* Era bands */}
          {eras.map((era) => {
            const x1 = Math.max(toX(era.start), -10);
            const x2 = Math.min(toX(era.end), width + 10);
            if (x2 < 0 || x1 > width) return null;
            return (
              <div key={era.name} className="absolute inset-y-0 border-l border-border/70" style={{ left: x1, width: Math.max(x2 - x1, 0), background: era.i % 2 ? "rgba(214,189,141,0.025)" : "transparent" }}>
                <div className="sticky left-0 truncate px-2 pt-1.5 text-2xs uppercase tracking-[0.18em] text-gold-dim">{era.name}</div>
              </div>
            );
          })}

          {/* Grid + axis */}
          {ticks.map((t) => (
            <div key={t.ord} className={cn("absolute top-6 bottom-0 w-px", t.major ? "bg-border" : "bg-border/40")} style={{ left: toX(t.ord) }}>
              <span className={cn("absolute bottom-2 left-1.5 whitespace-nowrap text-2xs", t.major ? "text-text-2" : "text-muted")}>{t.label}</span>
            </div>
          ))}
          <div className="absolute inset-x-0 bottom-0 h-[34px] border-t border-border bg-bg-2/80" />

          {/* Now indicator */}
          {p.calendar.currentYear != null ? (
            <div className="absolute top-0 bottom-0 w-px bg-gold/70" style={{ left: toX(p.calendar.currentYear * YEAR_SCALE + YEAR_SCALE / 2) }}>
              <span className="absolute left-1 top-6 rounded bg-gold px-1 text-2xs font-semibold text-bg">NOW</span>
            </div>
          ) : null}

          {/* Events */}
          {placed.map(({ e, lane, x, w }) => {
            const top = 34 + lane * LANE_H;
            const isSel = e.id === selected;
            return (
              <button
                key={e.id}
                onClick={() => setSelected(e.id)}
                className="group absolute flex items-center gap-2 text-left"
                style={{ left: x - 7, top, maxWidth: Math.max(w, LABEL_W) + 14 }}
                aria-label={`${e.title}, ${e.dateLabel}`}
                aria-pressed={isSel}
              >
                {e.hasSpan && w > 4 ? (
                  <span className={cn("absolute left-[7px] top-[13px] h-1.5 rounded-full", e.modified ? "bg-violet/50" : e.importance >= 5 ? "bg-gold/40" : "bg-border-strong")} style={{ width: w }} aria-hidden="true" />
                ) : null}
                <span
                  className={cn(
                    "relative z-[1] size-3.5 shrink-0 rotate-45 border",
                    isSel ? "border-gold bg-gold" : e.modified ? "border-violet bg-violet/60" : e.importance >= 5 ? "border-gold bg-gold/50" : e.importance >= 4 ? "border-text-2 bg-surface-3" : "border-border-strong bg-surface-2",
                    e.canonStatus === "DISPUTED" && "border-dashed",
                  )}
                  aria-hidden="true"
                />
                <span className={cn("relative z-[1] min-w-0 rounded px-1.5 py-0.5 transition-colors", isSel ? "bg-gold/15" : "bg-bg/80 group-hover:bg-surface-2")}>
                  <span className={cn("block truncate text-xs font-medium", isSel ? "text-gold" : "text-text")}>{e.title}</span>
                  <span className="block truncate text-2xs text-muted">{e.dateLabel}</span>
                </span>
              </button>
            );
          })}

          {/* Aggregated overflow */}
          {overflow.map(([bucket, list]) => (
            <button
              key={bucket}
              className="absolute rounded-full border border-border bg-surface px-2 py-0.5 text-2xs text-text-2 hover:border-gold-dim hover:text-gold"
              style={{ left: bucket * 140 + 4, bottom: 40 }}
              onClick={(ev) => {
                const rect = wrap.current!.getBoundingClientRect();
                zoomAt(2.5, ev.clientX - rect.left);
              }}
              title={list.map((e) => e.title).join(", ")}
            >
              +{list.length} more — zoom in
            </button>
          ))}

          {filtered.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-xl border border-dashed border-border bg-surface/90 p-6 text-center">
                <p className="font-serif text-xl">{p.events.length ? "No events match these filters" : "No history yet"}</p>
                <p className="mt-1 text-sm text-text-2">{p.events.length ? "Clear the filters to see the full timeline." : "Record your world's first event to begin its chronicle."}</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Inspector */}
        <AnimatePresence>
          {selectedEvent ? (
            <motion.aside
              key={selectedEvent.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.18 }}
              className="absolute bottom-3 right-3 top-3 z-10 flex w-[min(360px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-pop"
              aria-label="Event inspector"
            >
              <div className="flex items-start justify-between gap-2 border-b border-border p-4">
                <div className="min-w-0">
                  <div className="wf-eyebrow">{humanize(selectedEvent.type)} · {selectedEvent.dateLabel}</div>
                  <h2 className="mt-1 font-serif text-2xl font-semibold leading-tight">{selectedEvent.title}</h2>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <CanonBadge status={selectedEvent.canonStatus} />
                    {selectedEvent.modified ? <Badge tone="violet">changed in this branch</Badge> : null}
                    {selectedEvent.branchOnly ? <Badge tone="violet">exists only in this branch</Badge> : null}
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label="Close inspector" onClick={() => setSelected(null)}><X /></Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <p className="whitespace-pre-line text-sm text-text-2">{selectedEvent.description || "No description."}</p>
                {selectedEvent.locationId ? <p className="mt-3 text-xs text-muted">Location: <span className="text-text-2">{p.names[selectedEvent.locationId]}</span></p> : null}
                {selectedEvent.participants.length ? (
                  <div className="mt-3">
                    <h3 className="wf-eyebrow mb-1">Participants</h3>
                    <ul className="flex flex-col gap-0.5 text-sm">
                      {selectedEvent.participants.map((x) => (
                        <li key={x.id + x.role} className="flex justify-between gap-2">
                          <button className="truncate text-left hover:text-gold" onClick={() => setFilters({ ...filters, character: p.characters.some((c) => c.id === x.id) ? x.id : "", faction: p.factions.some((c) => c.id === x.id) ? x.id : "" })}>
                            {p.names[x.id] ?? "Unknown"}
                          </button>
                          <span className="text-xs text-muted">{x.role.toLowerCase()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
                <Button asChild size="sm" variant="secondary"><Link href={`/worlds/${p.worldId}/events/${selectedEvent.id}`}><ExternalLink /> Open</Link></Button>
                {p.canWrite ? <Button asChild size="sm" variant="secondary"><Link href={`/worlds/${p.worldId}/events/${selectedEvent.id}/edit`}><Pencil /> Edit</Link></Button> : null}
                {p.canWrite ? <Button asChild size="sm" variant="secondary"><Link href={`/worlds/${p.worldId}/simulator?event=${selectedEvent.id}&tl=${p.timeline.id}`}><Flame /> Simulate</Link></Button> : null}
                {p.canWrite ? <Button size="sm" variant="secondary" onClick={() => setBranchFor(selectedEvent)}><GitBranch /> Branch here</Button> : null}
              </div>
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </div>

      <BranchDialog key={branchFor?.id ?? "closed"} worldId={p.worldId} parent={p.timeline} event={branchFor} onClose={() => setBranchFor(null)} />
    </div>
  );
}

function BranchDialog({ worldId, parent, event, onClose }: { worldId: string; parent: { id: string; name: string }; event: ChronoEvent | null; onClose: () => void }) {
  const router = useRouter();
  // The parent remounts this dialog (via `key`) for each event, so state starts fresh.
  const [name, setName] = useState(event ? `What if… ${event.title}` : "");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog open={!!event} onOpenChange={(o) => !o && onClose()}>
      {event ? (
        <DialogContent title="Branch history here" description={`A new alternate timeline diverging at “${event.title}”. It inherits everything from “${parent.name}” and stores only its own changes.`}>
          <div className="flex flex-col gap-4">
            <FormError message={error} />
            <Field label="Branch name" htmlFor="branch-name"><Input id="branch-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Premise" htmlFor="branch-desc"><Textarea id="branch-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is different in this version of history?" /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button
                variant="primary"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await createBranchAction(worldId, { name, description, parentId: parent.id, branchEventId: event.id });
                    if (!r.ok) return setError(r.error);
                    toast.success("Branch created — propose your first change in the Living World Engine");
                    onClose();
                    router.push(`/worlds/${worldId}/simulator?event=${event.id}&tl=${r.data.id}`);
                  })
                }
              >
                <GitBranch /> {pending ? "Creating…" : "Create branch"}
              </Button>
            </div>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
