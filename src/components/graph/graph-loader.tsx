"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/misc";

/** React Flow is loaded lazily so it never weighs down other routes. */
export const GraphLoader = dynamic(() => import("./graph-workspace").then((m) => m.GraphWorkspace), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100dvh-3rem)] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="size-16 rounded-full" />
        <p className="text-sm text-muted">Loading the relationship graph…</p>
      </div>
    </div>
  ),
});
