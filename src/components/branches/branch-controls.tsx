"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, ArrowUpFromLine, GitBranch, Pencil, RotateCcw, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { createBranchAction, renameTimelineAction, setTimelineStatusAction } from "@/server/actions/timelines";
import { promoteChangeAction, promoteRecordAction, revertChangeAction, revertTimelineToAction } from "@/server/actions/engine";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { RecordPicker, type PickOption } from "@/components/ui/pickers";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "Failed");
      toast.success(ok);
      router.refresh();
    });
  return { pending, run };
}

export function ChangeActions({ worldId, changeId, canPromote, label }: { worldId: string; changeId: string; canPromote: boolean; label: string }) {
  const { pending, run } = useRun();
  const [confirm, setConfirm] = useState<"undo" | "restore" | "promote" | null>(null);
  return (
    <div className="flex shrink-0 gap-1">
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirm("undo")}><Undo2 /> Undo</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirm("restore")}><RotateCcw /> Restore to before</Button>
      {canPromote ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirm("promote")}><ArrowUpFromLine /> Promote</Button> : null}
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "undo" ? "Undo this change?" : confirm === "restore" ? "Restore the timeline to before this change?" : "Promote into the parent timeline?"}
        description={
          confirm === "undo"
            ? `“${label}” will be reverted. This is refused if later edits depend on it.`
            : confirm === "restore"
              ? "This change and every later change in this timeline are reverted, newest first, in one transaction. Revision history keeps everything."
              : "The same change is applied to the parent timeline. If the parent is canon, canon changes — the change is recorded and undoable."
        }
        confirmLabel={confirm === "promote" ? "Promote" : "Revert"}
        destructive={confirm !== "promote"}
        pending={pending}
        onConfirm={() => {
          const c = confirm;
          setConfirm(null);
          if (c === "undo") run(() => revertChangeAction(worldId, changeId), "Change undone");
          else if (c === "restore") run(() => revertTimelineToAction(worldId, changeId), "Timeline restored");
          else run(() => promoteChangeAction(worldId, changeId), "Change promoted to the parent timeline");
        }}
      />
    </div>
  );
}

export function PromoteRecordButton({ worldId, timelineId, type, recordId }: { worldId: string; timelineId: string; type: "EVENT" | "ENTITY" | "RELATIONSHIP"; recordId: string }) {
  const { pending, run } = useRun();
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => promoteRecordAction(worldId, timelineId, type, recordId), "Promoted to the parent timeline")}>
      <ArrowUpFromLine /> Promote
    </Button>
  );
}

export function TimelineAdmin({ worldId, timeline }: { worldId: string; timeline: { id: string; name: string; description: string; status: string; isMain: boolean } }) {
  const { pending, run } = useRun();
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(timeline.name);
  const [desc, setDesc] = useState(timeline.description);
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="ghost" onClick={() => setEdit(true)}><Pencil /> Rename</Button>
      {!timeline.isMain ? (
        timeline.status === "ACTIVE" ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setTimelineStatusAction(worldId, timeline.id, "ARCHIVED"), "Timeline archived")}><Archive /> Archive</Button>
        ) : (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setTimelineStatusAction(worldId, timeline.id, "ACTIVE"), "Timeline restored")}><ArchiveRestore /> Restore</Button>
        )
      ) : null}
      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent title="Rename timeline">
          <div className="flex flex-col gap-3">
            <Field label="Name" htmlFor="tl-name"><Input id="tl-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Description" htmlFor="tl-desc"><Textarea id="tl-desc" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEdit(false)}>Cancel</Button>
              <Button variant="primary" disabled={pending} onClick={() => { setEdit(false); run(() => renameTimelineAction(worldId, timeline.id, name, desc), "Saved"); }}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function NewBranchForm({ worldId, timelines, events }: { worldId: string; timelines: { id: string; name: string }[]; events: PickOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: "", description: "", parentId: timelines[0]?.id ?? "", branchEventId: null as string | null });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}><GitBranch /> New branch</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Create an alternate timeline" description="The branch inherits everything from its parent and stores only its own changes.">
          <div className="flex flex-col gap-3">
            <FormError message={error} />
            <Field label="Name" htmlFor="b-name"><Input id="b-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
            <Field label="Branch from" htmlFor="b-parent">
              <NativeSelect id="b-parent" value={v.parentId} onChange={(e) => setV({ ...v, parentId: e.target.value })}>
                {timelines.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Point of divergence (optional)" htmlFor="b-event"><RecordPicker id="b-event" options={events} value={v.branchEventId} onChange={(x) => setV({ ...v, branchEventId: x })} placeholder="Choose an event…" /></Field>
            <Field label="Premise" htmlFor="b-desc"><Textarea id="b-desc" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await createBranchAction(worldId, v);
                    if (!r.ok) return setError(r.error);
                    setOpen(false);
                    toast.success("Branch created");
                    router.push(`/worlds/${worldId}/branches?compare=${r.data.id}`);
                  })
                }
              >
                Create branch
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
