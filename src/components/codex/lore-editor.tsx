"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, Loader2, PenLine, Columns2 } from "lucide-react";
import { CANON_STATUSES, LORE_CATEGORIES, humanize } from "@/domain/catalog";
import { saveLoreAction } from "@/server/actions/content";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ListInput, MultiRecordPicker, type PickOption } from "@/components/ui/pickers";
import { Markdown } from "./markdown";
import { cn } from "@/lib/utils";

interface Doc {
  id: string;
  version: number;
  title: string;
  body: string;
  category: string;
  tags: string[];
  canonStatus: string;
  entityIds: string[];
  eventIds: string[];
}

type Status = { kind: "saved"; at: Date | null } | { kind: "dirty" } | { kind: "saving" } | { kind: "error"; message: string } | { kind: "conflict"; message: string };

/**
 * Debounced autosave. "Saved" is only shown after the server confirms the write and returns the
 * new version; concurrent edits are rejected with a visible conflict rather than overwritten.
 */
export function LoreEditor({ worldId, doc, entities, events }: { worldId: string; doc: Doc; entities: PickOption[]; events: PickOption[] }) {
  const router = useRouter();
  const [state, setState] = useState(doc);
  const docVersion = doc.version;
  const [status, setStatus] = useState<Status>({ kind: "saved", at: null });
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  const [mode, setMode] = useState<"write" | "split" | "preview">("split");
  const version = useRef(doc.version);
  const latest = useRef(state);
  const savedJson = useRef(JSON.stringify(doc));
  const inFlight = useRef(false);
  const queued = useRef(false);
  useEffect(() => {
    latest.current = state;
  }, [state]);
  // Lets `save` re-run itself for edits made while a save was in flight.
  const saveRef = useRef<() => Promise<void>>(async () => undefined);

  const save = useCallback(async () => {
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    inFlight.current = true;
    setStatus({ kind: "saving" });
    const s = latest.current;
    const r = await saveLoreAction(
      worldId,
      doc.id,
      { title: s.title, body: s.body, category: s.category as "HISTORY", tags: s.tags, canonStatus: s.canonStatus as "CANON", entityIds: s.entityIds, eventIds: s.eventIds },
      version.current,
    );
    inFlight.current = false;
    if (r.ok) {
      version.current = r.data.version;
      savedJson.current = JSON.stringify({ ...s, version: docVersion });
      if (queued.current || latest.current !== s) {
        queued.current = false;
        setStatus({ kind: "dirty" });
        void saveRef.current();
      } else setStatus({ kind: "saved", at: new Date(r.data.savedAt) });
    } else if (r.code === "CONFLICT") setStatus({ kind: "conflict", message: r.error });
    else setStatus({ kind: "error", message: r.error });
  }, [worldId, doc.id, docVersion]);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    // Only content that differs from the last server-confirmed save counts as a change.
    if (JSON.stringify({ ...state, version: doc.version }) === savedJson.current) return;
    setStatus((st) => (st.kind === "conflict" ? st : { kind: "dirty" }));
    const t = setTimeout(() => {
      if (statusRef.current.kind !== "conflict") void save();
    }, 1200);
    return () => clearTimeout(t);
  }, [state, save, doc.version]);

  useEffect(() => {
    const unsaved = status.kind === "dirty" || status.kind === "saving" || status.kind === "error" || status.kind === "conflict";
    if (!unsaved) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [status]);

  const set = <K extends keyof Doc>(k: K, v: Doc[K]) => setState((s) => ({ ...s, [k]: v }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Editor mode">
          {([["write", PenLine, "Write"], ["split", Columns2, "Split"], ["preview", Eye, "Preview"]] as const).map(([m, Icon, label]) => (
            <Button key={m} variant="ghost" size="sm" aria-pressed={mode === m} onClick={() => setMode(m)} className={cn("h-7", mode === m && "bg-surface-2 text-gold", m === "split" && "hidden lg:inline-flex")}>
              <Icon /> {label}
            </Button>
          ))}
        </div>
        <SaveStatus status={status} onRetry={() => void save()} onReload={() => router.refresh()} />
      </div>

      <Input aria-label="Title" value={state.title} onChange={(e) => set("title", e.target.value)} className="h-12 border-transparent bg-transparent px-0 font-serif text-3xl font-semibold hover:border-transparent focus:ring-0" />

      <div className={cn("grid gap-4", mode === "split" && "lg:grid-cols-2")}>
        {mode !== "preview" ? (
          <Textarea
            aria-label="Body (Markdown)"
            value={state.body}
            onChange={(e) => set("body", e.target.value)}
            className="min-h-[60vh] font-mono text-[13px] leading-relaxed"
            placeholder={"# Heading\n\nWrite in Markdown. **Bold**, *italic*, lists, tables and > quotes are supported."}
          />
        ) : null}
        {mode !== "write" ? (
          <div className="min-h-[60vh] rounded-md border border-border bg-bg-2 p-5">
            {state.body.trim() ? <Markdown>{state.body}</Markdown> : <p className="text-sm text-muted">Nothing to preview yet.</p>}
          </div>
        ) : null}
      </div>

      <section className="wf-panel grid gap-4 p-4 md:grid-cols-2">
        <Field label="Category" htmlFor="category">
          <NativeSelect id="category" value={state.category} onChange={(e) => set("category", e.target.value)}>
            {LORE_CATEGORIES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Canon status" htmlFor="canon">
          <NativeSelect id="canon" value={state.canonStatus} onChange={(e) => set("canonStatus", e.target.value)}>
            {CANON_STATUSES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Tags" htmlFor="tags" className="md:col-span-2"><ListInput id="tags" value={state.tags} onChange={(v) => set("tags", v)} placeholder="Add a tag and press Enter" /></Field>
        <Field label="Linked entities" hint="Linked records feed impact analysis and AI context."><MultiRecordPicker options={entities} value={state.entityIds} onChange={(v) => set("entityIds", v)} placeholder="Link an entity…" /></Field>
        <Field label="Linked events"><MultiRecordPicker options={events} value={state.eventIds} onChange={(v) => set("eventIds", v)} placeholder="Link an event…" /></Field>
      </section>
    </div>
  );
}

function SaveStatus({ status, onRetry, onReload }: { status: Status; onRetry: () => void; onReload: () => void }) {
  if (status.kind === "saving") return <span className="flex items-center gap-1.5 text-xs text-text-2" aria-live="polite"><Loader2 className="size-3.5 animate-spin" /> Saving…</span>;
  if (status.kind === "dirty") return <span className="text-xs text-warning" aria-live="polite">Unsaved changes</span>;
  if (status.kind === "saved") return <span className="flex items-center gap-1.5 text-xs text-muted" aria-live="polite"><CheckCircle2 className="size-3.5 text-success" /> {status.at ? `Saved ${status.at.toLocaleTimeString()}` : "All changes saved"}</span>;
  return (
    <div role="alert" className="flex max-w-xl items-center gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs text-[#e7a3a3]">
      <AlertTriangle className="size-3.5 shrink-0" />
      <span>{status.message}</span>
      {status.kind === "error" ? <Button size="sm" variant="ghost" className="h-6" onClick={onRetry}>Retry</Button> : <Button size="sm" variant="ghost" className="h-6" onClick={onReload}>Reload</Button>}
    </div>
  );
}
