"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runConsistencyAction } from "@/server/actions/universe";

export function RecordReportButton({ worldId, timelineId }: { worldId: string; timelineId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await runConsistencyAction(worldId, timelineId);
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          toast.success(`Report recorded: ${r.data.count} finding(s).`);
          router.refresh();
        })
      }
    >
      {pending ? "Checking…" : "Record report"}
    </Button>
  );
}
