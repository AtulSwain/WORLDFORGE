"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BUILTIN_RELATIONSHIP_KEYS, BUILTIN_RELATIONSHIP_TYPES, CANON_STATUSES, entityHref, humanize, relationshipMeta, type EntityTypeKey } from "@/domain/catalog";
import { relationshipInputSchema } from "@/domain/schemas";
import { archiveRelationshipAction, createRelationshipAction, updateRelationshipAction } from "@/server/actions/content";
import { Button } from "@/components/ui/button";
import { CanonBadge } from "@/components/ui/badge";
import { ConfirmDialog, Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { RecordPicker, type PickOption } from "@/components/ui/pickers";
import { EntityIcon } from "@/components/world/entity-visual";

export interface RelRow {
  id: string;
  version: number;
  type: string;
  direction: "out" | "in";
  other: { id: string; name: string; type: string; status?: string };
  validFromYear: number | null;
  validToYear: number | null;
  description: string;
  canonStatus: string;
  originEvent: { id: string; title: string } | null;
  originEventId: string | null;
  endEventId: string | null;
}

interface Draft {
  id?: string;
  version?: number;
  direction: "out" | "in";
  type: string;
  otherId: string | null;
  validFromYear: string;
  validToYear: string;
  description: string;
  canonStatus: string;
  originEventId: string | null;
  endEventId: string | null;
}

export function RelationshipManager({
  worldId,
  entity,
  rows,
  entityOptions,
  eventOptions,
  customTypes,
  canWrite,
}: {
  worldId: string;
  entity: { id: string; name: string; type: string };
  rows: RelRow[];
  entityOptions: PickOption[];
  eventOptions: PickOption[];
  customTypes: { key: string; label: string; inverse: string | null }[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [remove, setRemove] = useState<RelRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const groups = useMemo(() => {
    const m = new Map<string, RelRow[]>();
    for (const r of rows) {
      const meta = relationshipMeta(r.type, customTypes);
      const label = r.direction === "out" || meta.symmetric ? meta.label : meta.inverseLabel;
      m.set(label, [...(m.get(label) ?? []), r]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, customTypes]);

  const typeKeys = [...BUILTIN_RELATIONSHIP_KEYS, ...customTypes.map((c) => c.key)];

  const save = () =>
    start(async () => {
      if (!draft) return;
      setError(null);
      const num = (s: string) => (s.trim() === "" ? null : Number(s));
      if (!draft.otherId) return setError("Choose the other side of the relationship.");
      const payload = {
        sourceId: draft.direction === "out" ? entity.id : draft.otherId,
        targetId: draft.direction === "out" ? draft.otherId : entity.id,
        type: draft.type,
        description: draft.description,
        validFromYear: num(draft.validFromYear),
        validToYear: num(draft.validToYear),
        originEventId: draft.originEventId,
        endEventId: draft.endEventId,
        canonStatus: draft.canonStatus as "CANON",
      };
      const parsed = relationshipInputSchema.safeParse(payload);
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid relationship.");
      const r = draft.id ? await updateRelationshipAction(worldId, draft.id, parsed.data, draft.version!) : await createRelationshipAction(worldId, parsed.data);
      if (!r.ok) return setError(r.error);
      toast.success(draft.id ? "Relationship updated" : "Relationship added");
      setDraft(null);
      router.refresh();
    });

  const doRemove = () =>
    start(async () => {
      if (!remove) return;
      const r = await archiveRelationshipAction(worldId, remove.id);
      setRemove(null);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Relationship removed (kept in history)");
      router.refresh();
    });

  const label = (k: string, dir: "out" | "in") => {
    const meta = relationshipMeta(k, customTypes);
    return dir === "out" || meta.symmetric ? meta.label : meta.inverseLabel;
  };

  return (
    <div>
      {canWrite ? (
        <div className="mb-4 flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setError(null);
              setDraft({ direction: "out", type: "ALLY_OF", otherId: null, validFromYear: "", validToYear: "", description: "", canonStatus: "CANON", originEventId: null, endEventId: null });
            }}
          >
            <Plus /> Add relationship
          </Button>
        </div>
      ) : null}
      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">No relationships yet.{canWrite ? " Connect this record to the rest of your world." : ""}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map(([g, list]) => (
            <section key={g} className="wf-panel p-4">
              <h3 className="wf-eyebrow mb-2">{g}</h3>
              <ul className="flex flex-col divide-y divide-border">
                {list.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 py-2">
                    <EntityIcon type={r.other.type as EntityTypeKey} className="mt-1" />
                    <div className="min-w-0 flex-1">
                      <Link href={entityHref(worldId, r.other.type as EntityTypeKey, r.other.id)} className="text-sm font-medium hover:text-gold">{r.other.name}</Link>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        {r.validFromYear != null || r.validToYear != null ? <span>{r.validFromYear ?? "?"} – {r.validToYear ?? "present"}</span> : null}
                        {r.originEvent ? <Link href={`/worlds/${worldId}/events/${r.originEvent.id}`} className="hover:text-gold">via {r.originEvent.title}</Link> : null}
                        <CanonBadge status={r.canonStatus} />
                      </div>
                      {r.description ? <p className="mt-0.5 text-xs text-text-2">{r.description}</p> : null}
                    </div>
                    {canWrite ? (
                      <div className="flex shrink-0">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit relationship with ${r.other.name}`}
                          onClick={() => {
                            setError(null);
                            setDraft({
                              id: r.id, version: r.version, direction: r.direction, type: r.type, otherId: r.other.id,
                              validFromYear: r.validFromYear?.toString() ?? "", validToYear: r.validToYear?.toString() ?? "", description: r.description,
                              canonStatus: r.canonStatus, originEventId: r.originEventId, endEventId: r.endEventId,
                            });
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={`Remove relationship with ${r.other.name}`} onClick={() => setRemove(r)}><Trash2 /></Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        {draft ? (
          <DialogContent title={draft.id ? "Edit relationship" : "Add relationship"} description="Relationships are validated on the server: types must fit the entities, and duplicates in the same period are rejected.">
            <div className="flex flex-col gap-4">
              <FormError message={error} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Direction" htmlFor="rel-dir">
                  <NativeSelect id="rel-dir" value={draft.direction} onChange={(e) => setDraft({ ...draft, direction: e.target.value as "out" | "in" })}>
                    <option value="out">{entity.name} → other</option>
                    <option value="in">other → {entity.name}</option>
                  </NativeSelect>
                </Field>
                <Field label="Relationship" htmlFor="rel-type">
                  <NativeSelect id="rel-type" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                    {typeKeys.map((k) => <option key={k} value={k}>{label(k, draft.direction)}</option>)}
                  </NativeSelect>
                </Field>
              </div>
              <Field label={draft.direction === "out" ? `${entity.name} ${label(draft.type, "out").toLowerCase()}…` : `…${label(draft.type, "in").toLowerCase()} ${entity.name}`} htmlFor="rel-other">
                <RecordPicker id="rel-other" options={entityOptions.filter((o) => o.id !== entity.id)} value={draft.otherId} onChange={(v) => setDraft({ ...draft, otherId: v })} placeholder="Choose an entity…" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Valid from (year)" htmlFor="rel-from"><Input id="rel-from" type="number" value={draft.validFromYear} onChange={(e) => setDraft({ ...draft, validFromYear: e.target.value })} /></Field>
                <Field label="Valid to (year)" htmlFor="rel-to"><Input id="rel-to" type="number" value={draft.validToYear} onChange={(e) => setDraft({ ...draft, validToYear: e.target.value })} /></Field>
                <Field label="Established by event" htmlFor="rel-origin" hint="Links the relationship to the Living World Engine."><RecordPicker id="rel-origin" options={eventOptions} value={draft.originEventId} onChange={(v) => setDraft({ ...draft, originEventId: v })} placeholder="None" /></Field>
                <Field label="Ended by event" htmlFor="rel-end"><RecordPicker id="rel-end" options={eventOptions} value={draft.endEventId} onChange={(v) => setDraft({ ...draft, endEventId: v })} placeholder="None" /></Field>
              </div>
              <Field label="Canon status" htmlFor="rel-canon">
                <NativeSelect id="rel-canon" value={draft.canonStatus} onChange={(e) => setDraft({ ...draft, canonStatus: e.target.value })}>
                  {CANON_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Description" htmlFor="rel-desc"><Textarea id="rel-desc" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
                <Button variant="primary" onClick={save} disabled={pending}>{pending ? "Saving…" : draft.id ? "Save relationship" : "Add relationship"}</Button>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={!!remove}
        onOpenChange={(o) => !o && setRemove(null)}
        title="Remove this relationship?"
        description={remove ? `${entity.name} — ${label(remove.type, remove.direction).toLowerCase()} — ${remove.other.name} will be archived. Its history is kept.` : ""}
        confirmLabel="Remove"
        destructive
        onConfirm={doRemove}
        pending={pending}
      />
    </div>
  );
}

export { BUILTIN_RELATIONSHIP_TYPES };
