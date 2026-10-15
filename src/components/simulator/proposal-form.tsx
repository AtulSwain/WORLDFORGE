"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Flame } from "lucide-react";
import { CANON_STATUSES, EVENT_TYPES, humanize } from "@/domain/catalog";
import { DATE_PRECISIONS, formatEventDate, type CalendarConfig, type DatePrecision } from "@/domain/chronology";
import { createAndAnalyzeProposalAction } from "@/server/actions/engine";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field, FormError } from "@/components/ui/field";
import { RecordPicker, type PickOption } from "@/components/ui/pickers";

export interface EngineEvent {
  id: string;
  title: string;
  eventType: string;
  startYear: number;
  startMonth: number | null;
  startDay: number | null;
  endYear: number | null;
  endMonth: number | null;
  endDay: number | null;
  precision: DatePrecision;
  locationId: string | null;
  canonStatus: string;
  importance: number;
}

type Kind = "DATE" | "LOCATION" | "CANCEL" | "DETAILS";

export function ProposalForm({
  worldId,
  timelines,
  timelineId,
  events,
  locations,
  calendar,
  initialEventId,
}: {
  worldId: string;
  timelines: { id: string; name: string; isMain: boolean }[];
  timelineId: string;
  events: EngineEvent[];
  locations: PickOption[];
  calendar: CalendarConfig;
  initialEventId: string | null;
}) {
  const router = useRouter();
  const [eventId, setEventId] = useState<string | null>(initialEventId && events.some((e) => e.id === initialEventId) ? initialEventId : null);
  const ev = events.find((e) => e.id === eventId) ?? null;
  const [kind, setKind] = useState<Kind>("DATE");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");
  const [rationale, setRationale] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const options = useMemo(() => events.map((e) => ({ id: e.id, name: e.title, hint: formatEventDate({ ...e, displayDate: null }, calendar) })), [events, calendar]);
  const v = (k: keyof EngineEvent) => vals[k] ?? (ev?.[k] == null ? "" : String(ev[k]));
  const set = (k: string, x: string) => setVals((s) => ({ ...s, [k]: x }));
  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  const buildPatch = (): Record<string, unknown> | null => {
    if (!ev) return null;
    if (kind === "CANCEL") return { cancelled: true };
    const patch: Record<string, unknown> = {};
    const cmp = (k: keyof EngineEvent, value: unknown) => {
      if (JSON.stringify(value) !== JSON.stringify(ev[k])) patch[k] = value;
    };
    if (kind === "DATE") {
      cmp("startYear", num(v("startYear")));
      cmp("startMonth", num(v("startMonth")));
      cmp("startDay", num(v("startDay")));
      cmp("endYear", num(v("endYear")));
      cmp("precision", v("precision"));
    }
    if (kind === "LOCATION") cmp("locationId", vals.locationId === undefined ? ev.locationId : vals.locationId || null);
    if (kind === "DETAILS") {
      cmp("title", v("title"));
      cmp("eventType", v("eventType"));
      cmp("canonStatus", v("canonStatus"));
    }
    return patch;
  };

  const submit = () =>
    start(async () => {
      setError(null);
      const patch = buildPatch();
      if (!ev || !patch) return setError("Choose the event you want to change.");
      if (Object.keys(patch).length === 0) return setError("Change at least one value from its current state.");
      const r = await createAndAnalyzeProposalAction(worldId, {
        timelineId,
        sourceEventId: ev.id,
        title: title.trim() || (kind === "CANCEL" ? `“${ev.title}” never happens` : `Change “${ev.title}”`),
        rationale,
        patch,
      });
      if (!r.ok) return setError(r.error);
      router.push(`/worlds/${worldId}/simulator?proposal=${r.data.id}`);
    });

  return (
    <div className="wf-panel flex flex-col gap-4 p-5">
      <div>
        <h2 className="flex items-center gap-2 font-serif text-2xl font-semibold"><Flame className="size-5 text-gold" /> Propose a change to history</h2>
        <p className="mt-1 text-sm text-text-2">Nothing is modified until you review the consequences and commit them.</p>
      </div>
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Timeline" htmlFor="p-tl" hint="Changes are analysed against this version of history.">
          <NativeSelect id="p-tl" value={timelineId} onChange={(e) => router.push(`/worlds/${worldId}/simulator?new=1&tl=${e.target.value}${eventId ? `&event=${eventId}` : ""}`)}>
            {timelines.map((t) => <option key={t.id} value={t.id}>{t.isMain ? `${t.name} (canon)` : t.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Event" htmlFor="p-event">
          <RecordPicker id="p-event" options={options} value={eventId} onChange={(x) => { setEventId(x); setVals({}); }} placeholder="Choose an event…" />
        </Field>
      </div>
      {ev ? (
        <>
          <div role="radiogroup" aria-label="Kind of change" className="flex flex-wrap gap-1.5">
            {([["DATE", "Change its date"], ["LOCATION", "Move it elsewhere"], ["CANCEL", "It never happens"], ["DETAILS", "Change its details"]] as const).map(([k, label]) => (
              <button key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={kind === k ? "rounded-full border border-gold bg-gold/10 px-3 py-1 text-sm text-gold" : "rounded-full border border-border px-3 py-1 text-sm text-text-2 hover:border-border-strong"}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">Currently: {formatEventDate({ ...ev, displayDate: null }, calendar)} · {humanize(ev.eventType)}{ev.locationId ? ` · ${locations.find((l) => l.id === ev.locationId)?.name ?? ""}` : ""}</p>
          {kind === "DATE" ? (
            <div className="grid gap-3 sm:grid-cols-5">
              <Field label="Start year" htmlFor="p-sy"><Input id="p-sy" type="number" value={v("startYear")} onChange={(e) => set("startYear", e.target.value)} /></Field>
              <Field label="Month" htmlFor="p-sm"><Input id="p-sm" type="number" min={1} max={24} value={v("startMonth")} onChange={(e) => set("startMonth", e.target.value)} /></Field>
              <Field label="Day" htmlFor="p-sd"><Input id="p-sd" type="number" min={1} max={40} value={v("startDay")} onChange={(e) => set("startDay", e.target.value)} /></Field>
              <Field label="End year" htmlFor="p-ey"><Input id="p-ey" type="number" value={v("endYear")} onChange={(e) => set("endYear", e.target.value)} /></Field>
              <Field label="Precision" htmlFor="p-pr">
                <NativeSelect id="p-pr" value={v("precision")} onChange={(e) => set("precision", e.target.value)}>
                  {DATE_PRECISIONS.map((p) => <option key={p} value={p}>{humanize(p)}</option>)}
                </NativeSelect>
              </Field>
            </div>
          ) : kind === "LOCATION" ? (
            <Field label="New location" htmlFor="p-loc"><RecordPicker id="p-loc" options={locations} value={vals.locationId === undefined ? ev.locationId : vals.locationId || null} onChange={(x) => set("locationId", x ?? "")} /></Field>
          ) : kind === "DETAILS" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Title" htmlFor="p-title"><Input id="p-title" value={v("title")} onChange={(e) => set("title", e.target.value)} /></Field>
              <Field label="Type" htmlFor="p-type">
                <NativeSelect id="p-type" value={v("eventType")} onChange={(e) => set("eventType", e.target.value)}>
                  {EVENT_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Canon status" htmlFor="p-canon">
                <NativeSelect id="p-canon" value={v("canonStatus")} onChange={(e) => set("canonStatus", e.target.value)}>
                  {CANON_STATUSES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
                </NativeSelect>
              </Field>
            </div>
          ) : (
            <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-[#e2c58c]">The engine will treat “{ev.title}” as removed from this timeline and trace what depended on it.</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Proposal title" htmlFor="p-name" hint="Optional — a default is generated."><Input id="p-name" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Why explore this?" htmlFor="p-why"><Textarea id="p-why" rows={1} value={rationale} onChange={(e) => setRationale(e.target.value)} /></Field>
          </div>
          <div className="flex justify-end">
            <Button variant="primary" onClick={submit} disabled={pending}><Flame /> {pending ? "Analysing consequences…" : "Analyse impact"}</Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
