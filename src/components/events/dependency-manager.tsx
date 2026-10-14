"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DEPENDENCY_META, DEPENDENCY_TYPES, type DependencyTypeKey } from "@/domain/catalog";
import { addDependencyAction, removeDependencyAction } from "@/server/actions/content";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { FormError } from "@/components/ui/field";
import { RecordPicker, type PickOption } from "@/components/ui/pickers";

export interface DepRow {
  id: string;
  type: DependencyTypeKey;
  direction: "in" | "out";
  other: { id: string; title: string; date: string };
}

export function DependencyManager({ worldId, eventId, rows, events, canWrite, timelineId }: { worldId: string; eventId: string; rows: DepRow[]; events: PickOption[]; canWrite: boolean; timelineId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ type: DependencyTypeKey; direction: "in" | "out"; otherId: string | null } | null>(null);

  const add = () =>
    start(async () => {
      if (!draft?.otherId) return setError("Choose an event to link.");
      setError(null);
      const input = draft.direction === "in" ? { sourceId: draft.otherId, targetId: eventId, type: draft.type } : { sourceId: eventId, targetId: draft.otherId, type: draft.type };
      const r = await addDependencyAction(worldId, input, timelineId);
      if (!r.ok) return setError(r.error);
      toast.success("Causal link added");
      setDraft(null);
      router.refresh();
    });

  const remove = (id: string) =>
    start(async () => {
      const r = await removeDependencyAction(worldId, id);
      if (!r.ok) return void toast.error(r.error);
      router.refresh();
    });

  const section = (dir: "in" | "out", title: string) => {
    const list = rows.filter((r) => r.direction === dir);
    return (
      <div className="wf-panel p-4">
        <h3 className="wf-eyebrow mb-2">{title}</h3>
        {list.length === 0 ? <p className="text-sm text-muted">None recorded.</p> : (
          <ul className="flex flex-col gap-1.5">
            {list.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-sm">
                <span className="w-32 shrink-0 text-xs text-muted">{dir === "in" ? DEPENDENCY_META[r.type].inverseLabel : DEPENDENCY_META[r.type].label}</span>
                <Link href={`/worlds/${worldId}/events/${r.other.id}`} className="min-w-0 flex-1 truncate hover:text-gold">{r.other.title}</Link>
                <span className="shrink-0 text-xs text-muted">{r.other.date}</span>
                {canWrite ? <Button variant="ghost" size="icon-sm" aria-label={`Remove link to ${r.other.title}`} onClick={() => remove(r.id)} disabled={pending}><Trash2 /></Button> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        {section("in", "Causes & prerequisites")}
        {section("out", "Consequences")}
      </div>
      {canWrite ? (
        draft ? (
          <div className="wf-panel flex flex-col gap-3 p-4">
            <FormError message={error} />
            <div className="grid gap-2 sm:grid-cols-[140px_200px_minmax(0,1fr)]">
              <NativeSelect aria-label="Direction" value={draft.direction} onChange={(e) => setDraft({ ...draft, direction: e.target.value as "in" | "out" })}>
                <option value="in">Incoming: cause</option>
                <option value="out">Outgoing: result</option>
              </NativeSelect>
              <NativeSelect aria-label="Link type" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as DependencyTypeKey })}>
                {DEPENDENCY_TYPES.map((t) => <option key={t} value={t}>{draft.direction === "in" ? DEPENDENCY_META[t].inverseLabel.toLowerCase() : DEPENDENCY_META[t].label.toLowerCase()}</option>)}
              </NativeSelect>
              <RecordPicker options={events.filter((e) => e.id !== eventId)} value={draft.otherId} onChange={(x) => setDraft({ ...draft, otherId: x })} placeholder="Choose an event…" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={add} disabled={pending}>Add link</Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" size="sm" className="self-start" onClick={() => { setError(null); setDraft({ type: "CAUSES", direction: "in", otherId: null }); }}><Plus /> Add causal link</Button>
        )
      ) : null}
    </div>
  );
}
