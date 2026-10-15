"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { restoreEntityRevisionAction, restoreEventRevisionAction, restoreLoreRevisionAction } from "@/server/actions/content";
import { cn, timeAgo } from "@/lib/utils";

export interface RevisionRow {
  id: string;
  version: number;
  summary: string;
  createdAt: string;
  author: string | null;
  snapshot: Record<string, unknown>;
}

const IGNORE = new Set(["id", "universeId", "timelineId", "slug", "createdById", "createdAt", "updatedAt", "version", "startOrdinal", "endOrdinal", "archivedAt"]);

function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (IGNORE.has(k)) continue;
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flatten(v as Record<string, unknown>, key));
    else out[key] = Array.isArray(v) ? v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ") : v == null ? "" : String(v);
  }
  return out;
}

export function RevisionHistory({
  worldId,
  recordId,
  recordType,
  revisions,
  canRestore,
}: {
  worldId: string;
  recordId: string;
  recordType: "ENTITY" | "EVENT" | "LORE";
  revisions: RevisionRow[];
  canRestore: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(revisions[0]?.id ?? null);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const idx = revisions.findIndex((r) => r.id === selected);
  const rev = revisions[idx];
  const prev = revisions[idx + 1];
  const diff = useMemo(() => {
    if (!rev) return [];
    const a = flatten(prev?.snapshot ?? {});
    const b = flatten(rev.snapshot);
    return [...new Set([...Object.keys(a), ...Object.keys(b)])]
      .filter((k) => (a[k] ?? "") !== (b[k] ?? ""))
      .map((k) => ({ key: k, before: a[k] ?? "", after: b[k] ?? "" }));
  }, [rev, prev]);

  if (!revisions.length) return <p className="text-sm text-muted">No revisions recorded.</p>;

  const restore = () =>
    start(async () => {
      const fn = recordType === "ENTITY" ? restoreEntityRevisionAction : recordType === "EVENT" ? restoreEventRevisionAction : restoreLoreRevisionAction;
      const r = await fn(worldId, recordId, rev!.id);
      setConfirm(false);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Restored version ${rev!.version} as a new revision`);
      router.refresh();
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <ol className="flex flex-col gap-1" aria-label="Revisions">
        {revisions.map((r) => (
          <li key={r.id}>
            <button
              onClick={() => setSelected(r.id)}
              aria-current={r.id === selected}
              className={cn("w-full rounded-md border px-3 py-2 text-left text-sm transition-colors", r.id === selected ? "border-gold/50 bg-surface" : "border-transparent hover:bg-surface")}
            >
              <div className="flex items-center gap-2">
                <History className="size-3.5 text-muted" />
                <span className="font-medium">v{r.version}</span>
                <span className="truncate text-text-2">{r.summary}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted">{r.author ?? "Unknown"} · {timeAgo(r.createdAt)}</div>
            </button>
          </li>
        ))}
      </ol>
      <div className="wf-panel min-w-0 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">
            Version {rev?.version} {prev ? <span className="text-muted">compared with v{prev.version}</span> : <span className="text-muted">(first version)</span>}
          </h3>
          {canRestore && idx > 0 ? (
            <Button size="sm" variant="secondary" onClick={() => setConfirm(true)}><RotateCcw /> Restore this version</Button>
          ) : null}
        </div>
        {diff.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No field changes in this revision.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr><th className="py-1.5 pr-3 font-medium">Field</th><th className="py-1.5 pr-3 font-medium">Before</th><th className="py-1.5 font-medium">After</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {diff.map((d) => (
                  <tr key={d.key} className="align-top">
                    <td className="py-2 pr-3 font-mono text-xs text-text-2">{d.key}</td>
                    <td className="max-w-xs py-2 pr-3 text-xs text-[#e7a3a3] line-through decoration-danger/50"><span className="line-clamp-4 whitespace-pre-wrap">{d.before || "—"}</span></td>
                    <td className="max-w-xs py-2 text-xs text-[#a9cfa5]"><span className="line-clamp-4 whitespace-pre-wrap">{d.after || "—"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Restore version ${rev?.version}?`}
        description="The current state is kept in history; the restored content becomes a new version. Nothing is deleted."
        confirmLabel="Restore"
        onConfirm={restore}
        pending={pending}
      />
    </div>
  );
}
