"use client";

import dynamic from "next/dynamic";

/** Three.js is only downloaded when the experimental globe is opened. */
export const GlobeLoader = dynamic(() => import("./globe-view").then((m) => m.GlobeView), {
  ssr: false,
  loading: () => <p className="p-8 text-center text-sm text-muted">Loading the 3D view…</p>,
});
