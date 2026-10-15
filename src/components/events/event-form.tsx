"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CANON_STATUSES, DEPENDENCY_META, DEPENDENCY_TYPES, EVENT_TYPES, PARTICIPANT_ROLES, humanize } from "@/domain/catalog";
import { DATE_PRECISIONS, formatEventDate, type CalendarConfig, type DatePrecision } from "@/domain/chronology";
import { eventInputSchema } from "@/domain/schemas";
import { createEventAction, updateEventAction } from "@/server/actions/content";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field, FormError } from "@/components/ui/field";
import { MultiRecordPicker, RecordPicker, type PickOption } from "@/components/ui/pickers";

const PRECISION_LABELS: Record<DatePrecision, string> = {
  DAY: "Exact day",
  MONTH: "Month",
  YEAR: "Year",
  CIRCA: "Circa (approximate year)",
  DECADE: "Decade",
  CENTURY: "Century",
  ERA: "Era",
};

interface V {
  title: string;
  description: string;
  eventType: string;
  precision: DatePrecision;
  startYear: string;
  startMonth: string;
  startDay: string;
  hasEnd: boolean;
  endYear: string;
  endMonth: string;
  endDay: string;
  displayDate: string;
  importance: number;
  locationId: string | null;
  canonStatus: string;
  participants: { entityId: string | null; role: string }[];
}

export interface EventFormInitial extends Omit<V, "hasEnd" | "participants"> {
  id: string;
  version: number;
  participants: { entityId: string; role: string }[];
}

export function EventForm({
  worldId,
  calendar,
  entities,
  locations,
  events,
  loreDocs,
  timelineId,
  initial,
  defaults,
}: {
  worldId: string;
  calendar: CalendarConfig;
  entities: PickOption[];
  locations: PickOption[];
  events: PickOption[];
  loreDocs: PickOption[];
  timelineId?: string | null;
  initial?: EventFormInitial;
  defaults?: Partial<V>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [v, setV] = useState<V>(() => ({
    title: "", description: "", eventType: "OTHER", precision: "YEAR", startYear: "", startMonth: "", startDay: "", hasEnd: false, endYear: "", endMonth: "",
    endDay: "", displayDate: "", importance: 3, locationId: null, canonStatus: "CANON", participants: [],
    ...(initial ? { ...initial, hasEnd: initial.endYear !== "" } : {}),
    ...defaults,
  }));
  const [deps, setDeps] = useState<{ type: string; direction: "in" | "out"; otherId: string | null }[]>([]);
  const [loreIds, setLoreIds] = useState<string[]>([]);
  const set = <K extends keyof V>(k: K, val: V[K]) => {
    setDirty(true);
    setV((s) => ({ ...s, [k]: val }));
  };

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const needsMonth = v.precision === "DAY" || v.precision === "MONTH";
  const preview = (() => {
    const y = num(v.startYear);
    if (y == null || Number.isNaN(y)) return null;
    return formatEventDate(
      { startYear: y, startMonth: needsMonth ? num(v.startMonth) : null, startDay: v.precision === "DAY" ? num(v.startDay) : null, endYear: v.hasEnd ? num(v.endYear) : null, endMonth: v.hasEnd && needsMonth ? num(v.endMonth) : null, endDay: v.hasEnd && v.precision === "DAY" ? num(v.endDay) : null, precision: v.precision, displayDate: v.displayDate || null },
      calendar,
    );
  })();

  const submit = () =>
    start(async () => {
      setError(null);
      const payload = {
        title: v.title, description: v.description, eventType: v.eventType, precision: v.precision,
        startYear: num(v.startYear) as number,
        startMonth: needsMonth ? num(v.startMonth) : null,
        startDay: v.precision === "DAY" ? num(v.startDay) : null,
        endYear: v.hasEnd ? num(v.endYear) : null,
        endMonth: v.hasEnd && needsMonth ? num(v.endMonth) : null,
        endDay: v.hasEnd && v.precision === "DAY" ? num(v.endDay) : null,
        displayDate: v.displayDate || null, importance: v.importance, locationId: v.locationId, canonStatus: v.canonStatus as "CANON",
        participants: v.participants.filter((p) => p.entityId).map((p) => ({ entityId: p.entityId!, role: p.role as "PARTICIPANT" })),
      };
      if (payload.startYear == null || Number.isNaN(payload.startYear)) return setError("A start year is required. Use “circa”, “decade” or “era” precision if the date is uncertain.");
      const parsed = eventInputSchema.safeParse(payload);
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Please review the event.");
      const r = initial
        ? await updateEventAction(worldId, initial.id, parsed.data, initial.version)
        : await createEventAction(worldId, { ...parsed.data, timelineId }, { dependencies: deps.filter((d) => d.otherId).map((d) => ({ type: d.type, direction: d.direction, otherId: d.otherId! })), loreIds });
      if (!r.ok) return setError(r.error);
      setDirty(false);
      toast.success(initial ? "Event saved" : "Event recorded");
      router.push(`/worlds/${worldId}/events/${r.data.id}`);
      router.refresh();
    });

  const monthOptions = calendar.monthNames.length ? calendar.monthNames.map((m, i) => ({ value: String(i + 1), label: m })) : Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Month ${i + 1}` }));

  const dateRow = (prefix: "start" | "end") => (
    <div className="grid grid-cols-3 gap-2">
      <Field label="Year" htmlFor={`${prefix}Year`}>
        <Input id={`${prefix}Year`} type="number" value={v[`${prefix}Year`]} onChange={(e) => set(`${prefix}Year`, e.target.value)} />
      </Field>
      {needsMonth ? (
        <Field label="Month" htmlFor={`${prefix}Month`}>
          <NativeSelect id={`${prefix}Month`} value={v[`${prefix}Month`]} onChange={(e) => set(`${prefix}Month`, e.target.value)}>
            <option value="">—</option>
            {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </NativeSelect>
        </Field>
      ) : <div />}
      {v.precision === "DAY" ? (
        <Field label="Day" htmlFor={`${prefix}Day`}>
          <Input id={`${prefix}Day`} type="number" min={1} max={40} value={v[`${prefix}Day`]} onChange={(e) => set(`${prefix}Day`, e.target.value)} />
        </Field>
      ) : <div />}
    </div>
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex flex-col gap-6" noValidate>
      <FormError message={error} />
      <section className="wf-panel p-5">
        <h2 className="font-serif text-xl font-semibold">The event</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="title" className="sm:col-span-2"><Input id="title" autoFocus={!initial} value={v.title} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label="Event type" htmlFor="eventType">
            <NativeSelect id="eventType" value={v.eventType} onChange={(e) => set("eventType", e.target.value)}>
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Importance" htmlFor="importance" hint="5 = world-defining">
            <NativeSelect id="importance" value={v.importance} onChange={(e) => set("importance", Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Location" htmlFor="location"><RecordPicker id="location" options={locations} value={v.locationId} onChange={(x) => set("locationId", x)} placeholder="Where did it happen?" /></Field>
          <Field label="Canon status" htmlFor="canon">
            <NativeSelect id="canon" value={v.canonStatus} onChange={(e) => set("canonStatus", e.target.value)}>
              {CANON_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Description" htmlFor="description" className="sm:col-span-2"><Textarea id="description" rows={5} value={v.description} onChange={(e) => set("description", e.target.value)} /></Field>
        </div>
      </section>

      <section className="wf-panel p-5">
        <h2 className="font-serif text-xl font-semibold">When</h2>
        <p className="mt-1 text-sm text-text-2">Uncertain dates are first-class: choose a precision. Dates are stored as a single chronological ordinal while your chosen format is preserved.</p>
        <div className="mt-4 grid gap-4">
          <Field label="Date precision" htmlFor="precision">
            <NativeSelect id="precision" value={v.precision} onChange={(e) => set("precision", e.target.value as DatePrecision)} className="sm:w-72">
              {DATE_PRECISIONS.map((p) => <option key={p} value={p}>{PRECISION_LABELS[p]}</option>)}
            </NativeSelect>
          </Field>
          <div>
            <div className="wf-eyebrow mb-2">Start</div>
            {dateRow("start")}
          </div>
          <label className="flex items-center gap-2 text-sm text-text-2">
            <input type="checkbox" className="accent-[#D6BD8D]" checked={v.hasEnd} onChange={(e) => set("hasEnd", e.target.checked)} /> This event spans a period
          </label>
          {v.hasEnd ? <div><div className="wf-eyebrow mb-2">End</div>{dateRow("end")}</div> : null}
          <Field label="Custom display date (optional)" htmlFor="displayDate" hint="Overrides how the date is shown, e.g. “In the last winter of the old king”.">
            <Input id="displayDate" value={v.displayDate} onChange={(e) => set("displayDate", e.target.value)} />
          </Field>
          {preview ? <p className="text-sm">Shown as: <span className="text-gold">{preview}</span></p> : null}
        </div>
      </section>

      <section className="wf-panel p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-serif text-xl font-semibold">Participants</h2>
          <Button type="button" size="sm" variant="secondary" onClick={() => set("participants", [...v.participants, { entityId: null, role: "PARTICIPANT" }])}><Plus /> Add participant</Button>
        </div>
        {v.participants.length === 0 ? <p className="mt-2 text-sm text-muted">Characters, factions, locations and artifacts involved in the event.</p> : (
          <ul className="mt-3 flex flex-col gap-2">
            {v.participants.map((p, i) => (
              <li key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
                <RecordPicker options={entities} value={p.entityId} onChange={(x) => set("participants", v.participants.map((q, j) => (j === i ? { ...q, entityId: x } : q)))} placeholder="Choose an entity…" />
                <NativeSelect aria-label="Role" value={p.role} onChange={(e) => set("participants", v.participants.map((q, j) => (j === i ? { ...q, role: e.target.value } : q)))}>
                  {PARTICIPANT_ROLES.map((r) => <option key={r} value={r}>{humanize(r)}</option>)}
                </NativeSelect>
                <Button type="button" variant="ghost" size="icon" aria-label="Remove participant" onClick={() => set("participants", v.participants.filter((_, j) => j !== i))}><Trash2 /></Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!initial ? (
        <section className="wf-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-serif text-xl font-semibold">Causes & consequences</h2>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => setDeps((d) => [...d, { type: "CAUSES", direction: "in", otherId: null }])}><Plus /> Prerequisite / cause</Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setDeps((d) => [...d, { type: "CAUSES", direction: "out", otherId: null }])}><Plus /> Result</Button>
            </div>
          </div>
          <p className="mt-1 text-sm text-text-2">Explicit links drive the Living World Engine. Circular cause chains are rejected.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {deps.map((d, i) => (
              <li key={i} className="grid gap-2 sm:grid-cols-[220px_minmax(0,1fr)_auto]">
                <NativeSelect aria-label="Link type" value={d.type} onChange={(e) => setDeps((all) => all.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}>
                  {DEPENDENCY_TYPES.map((t) => <option key={t} value={t}>{d.direction === "in" ? DEPENDENCY_META[t].inverseLabel : DEPENDENCY_META[t].label}</option>)}
                </NativeSelect>
                <RecordPicker options={events} value={d.otherId} onChange={(x) => setDeps((all) => all.map((y, j) => (j === i ? { ...y, otherId: x } : y)))} placeholder="Choose an event…" />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove link" onClick={() => setDeps((all) => all.filter((_, j) => j !== i))}><Trash2 /></Button>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Field label="Linked lore"><MultiRecordPicker options={loreDocs} value={loreIds} onChange={setLoreIds} placeholder="Link lore documents…" /></Field>
          </div>
        </section>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <span className="text-xs text-muted" aria-live="polite">{dirty ? "Unsaved changes" : ""}</span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={pending}><Save /> {pending ? "Saving…" : initial ? "Save event" : "Record event"}</Button>
        </div>
      </div>
    </form>
  );
}
