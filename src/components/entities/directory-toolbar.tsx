"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { LayoutGrid, List, Search, X, Archive } from "lucide-react";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilterDef {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

/** URL-driven search, filters, sort and view controls (shareable, back-button friendly). */
export function DirectoryToolbar({ filters, sorts }: { filters: FilterDef[]; sorts: { value: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [pending, start] = useTransition();

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in patch)) next.delete("page");
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) update({ q: q || null });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on query text only
  }, [q]);

  const view = params.get("view") ?? "grid";
  const archived = params.get("archived") === "1";
  const active = filters.some((f) => params.get(f.key)) || !!params.get("q");

  return (
    <div className={cn("flex flex-col gap-2", pending && "opacity-80")}>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or summary…" className="pl-9" aria-label="Search" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <NativeSelect key={f.key} aria-label={f.label} value={params.get(f.key) ?? ""} onChange={(e) => update({ [f.key]: e.target.value || null })} className="w-auto min-w-36">
            <option value="">{f.label}: all</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </NativeSelect>
        ))}
        <NativeSelect aria-label="Sort" value={params.get("sort") ?? sorts[0]?.value} onChange={(e) => update({ sort: e.target.value })} className="w-auto">
          {sorts.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </NativeSelect>
        {active ? (
          <Button variant="ghost" size="sm" onClick={() => { setQ(""); update(Object.fromEntries([...filters.map((f) => [f.key, null]), ["q", null]])); }}>
            <X /> Clear
          </Button>
        ) : null}
        <Button variant={archived ? "outline" : "ghost"} size="sm" aria-pressed={archived} onClick={() => update({ archived: archived ? null : "1" })}>
          <Archive /> Archived
        </Button>
        <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="View">
          <Button variant="ghost" size="icon-sm" aria-label="Grid view" aria-pressed={view === "grid"} className={cn("size-7", view === "grid" && "bg-surface-2 text-gold")} onClick={() => update({ view: "grid", page: params.get("page") })}>
            <LayoutGrid />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="List view" aria-pressed={view === "list"} className={cn("size-7", view === "list" && "bg-surface-2 text-gold")} onClick={() => update({ view: "list", page: params.get("page") })}>
            <List />
          </Button>
        </div>
      </div>
    </div>
  );
}
