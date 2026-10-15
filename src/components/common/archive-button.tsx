"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { setEntityArchivedAction, setEventArchivedAction, setLoreArchivedAction } from "@/server/actions/content";

export function ArchiveButton({ worldId, id, kind, archived, label }: { worldId: string; id: string; kind: "ENTITY" | "EVENT" | "LORE"; archived: boolean; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      const fn = kind === "ENTITY" ? setEntityArchivedAction : kind === "EVENT" ? setEventArchivedAction : setLoreArchivedAction;
      const r = await fn(worldId, id, !archived);
      setOpen(false);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(archived ? `${label} restored` : `${label} archived`);
      router.refresh();
    });
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => (archived ? run() : setOpen(true))} disabled={pending}>
        {archived ? <ArchiveRestore /> : <Archive />} {archived ? "Restore" : "Archive"}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Archive ${label}?`}
        description="Archived records disappear from directories, the graph and the timeline, but nothing is deleted. You can restore it at any time from the Archived filter."
        confirmLabel="Archive"
        destructive
        onConfirm={run}
        pending={pending}
      />
    </>
  );
}
