"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog as D } from "radix-ui";
import {
  Search, UserPlus, Shield, MapPin, Diamond, Clock3, Network, BookOpen, Settings, Globe, Flame, GitBranch, LayoutDashboard, FileText, Gem, Plus, type LucideIcon,
} from "lucide-react";
import { Kbd } from "@/components/ui/misc";

interface Hit {
  kind: "ENTITY" | "EVENT" | "LORE" | "TIMELINE";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  universeName?: string;
}

const KIND_ICON = { ENTITY: Search, EVENT: Diamond, LORE: FileText, TIMELINE: GitBranch };

export function CommandPalette({ worldId, canWrite, universes }: { worldId: string | null; canWrite: boolean; universes: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Results are keyed by the query they answer, so a stale response never shows for a newer query.
  const [result, setResult] = useState<{ q: string; hits: Hit[]; failed: boolean }>({ q: "", hits: [], failed: false });
  const reqId = useRef(0);
  const trimmed = query.trim();
  const settled = result.q === trimmed;
  const hits = trimmed && settled ? result.hits : [];
  const status: "idle" | "loading" | "error" = !trimmed ? "idle" : !settled ? "loading" : result.failed ? "error" : "idle";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced server search.
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q });
        if (worldId) params.set("worldId", worldId);
        const res = await fetch(`/api/search?${params}`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { hits: Hit[] };
        if (id === reqId.current) setResult({ q, hits: data.hits, failed: false });
      } catch {
        if (id === reqId.current) setResult({ q, hits: [], failed: true });
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, worldId]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router],
  );

  const w = worldId ? (p: string) => `/worlds/${worldId}${p}` : null;
  const commands: { label: string; icon: LucideIcon; href: string; group: string; write?: boolean }[] = w
    ? [
        { group: "Create", label: "Create character", icon: UserPlus, href: w("/characters/new"), write: true },
        { group: "Create", label: "Create faction", icon: Shield, href: w("/factions/new"), write: true },
        { group: "Create", label: "Add location", icon: MapPin, href: w("/locations/new"), write: true },
        { group: "Create", label: "Add artifact", icon: Gem, href: w("/artifacts/new"), write: true },
        { group: "Create", label: "Create event", icon: Diamond, href: w("/events/new"), write: true },
        { group: "Create", label: "Write lore", icon: BookOpen, href: w("/codex/new"), write: true },
        { group: "Go to", label: "Universe overview", icon: LayoutDashboard, href: w("") },
        { group: "Go to", label: "Open timeline", icon: Clock3, href: w("/timeline") },
        { group: "Go to", label: "Open relationship graph", icon: Network, href: w("/graph") },
        { group: "Go to", label: "Search lore", icon: BookOpen, href: w("/codex") },
        { group: "Go to", label: "Simulate an event change", icon: Flame, href: w("/simulator") },
        { group: "Go to", label: "Alternate timelines", icon: GitBranch, href: w("/branches") },
        { group: "Go to", label: "Open universe settings", icon: Settings, href: w("/settings") },
      ]
    : [
        { group: "Create", label: "Create a new universe", icon: Plus, href: "/worlds/new" },
        { group: "Go to", label: "All worlds", icon: LayoutDashboard, href: "/dashboard" },
        { group: "Go to", label: "Open account settings", icon: Settings, href: "/settings/account" },
      ];
  const visibleCommands = commands.filter((c) => !c.write || canWrite);
  const groups = [...new Set(visibleCommands.map((c) => c.group))];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-2 rounded-md border border-border bg-bg px-2.5 text-[13px] text-muted transition-colors hover:border-border-strong hover:text-text-2 sm:w-56"
        aria-label="Search and commands"
      >
        <Search className="size-3.5" />
        <span className="hidden flex-1 text-left sm:inline">Search or command…</span>
        <span className="hidden sm:inline"><Kbd>⌘K</Kbd></span>
      </button>
      <D.Root open={open} onOpenChange={setOpen}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
          <D.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-32px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface shadow-pop focus:outline-none" aria-describedby={undefined}>
            <D.Title className="sr-only">Search and commands</D.Title>
            <Command shouldFilter={false} label="Search and commands" className="flex flex-col">
              <div className="flex items-center gap-2 border-b border-border px-3">
                <Search className="size-4 text-muted" />
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder={worldId ? "Search characters, events, lore… or type a command" : "Search all your worlds… or type a command"}
                  className="h-12 flex-1 bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
                />
              </div>
              <Command.List className="max-h-[60vh] overflow-y-auto p-1.5">
                {status === "loading" ? <Command.Loading><div className="px-3 py-2 text-xs text-muted">Searching…</div></Command.Loading> : null}
                {status === "error" ? <div className="px-3 py-2 text-xs text-[#e7a3a3]">Search failed. Check your connection and try again.</div> : null}
                {query && status === "idle" && hits.length === 0 ? <div className="px-3 py-2 text-xs text-muted">No records match “{query}”.</div> : null}
                {hits.length > 0 ? (
                  <Command.Group heading="Results" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted">
                    {hits.map((h) => {
                      const Icon = KIND_ICON[h.kind];
                      return (
                        <Command.Item key={`${h.kind}:${h.id}`} value={`${h.kind}:${h.id}`} onSelect={() => go(h.href)} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm data-[selected=true]:bg-surface-2">
                          <Icon className="size-4 shrink-0 text-muted" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-text">{h.title}</div>
                            <div className="truncate text-xs text-muted">{h.subtitle}{h.universeName ? ` · ${h.universeName}` : ""}</div>
                          </div>
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                ) : null}
                {groups.map((g) => {
                  const items = visibleCommands.filter((c) => c.group === g && (!query || c.label.toLowerCase().includes(query.toLowerCase())));
                  if (!items.length) return null;
                  return (
                    <Command.Group key={g} heading={g} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted">
                      {items.map((c) => (
                        <Command.Item key={c.label} value={c.label} onSelect={() => go(c.href)} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-text-2 data-[selected=true]:bg-surface-2 data-[selected=true]:text-text">
                          <c.icon className="size-4 text-gold-dim" /> {c.label}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  );
                })}
                {!query && universes.length > 1 ? (
                  <Command.Group heading="Switch universe" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted">
                    {universes.filter((u) => u.id !== worldId).slice(0, 6).map((u) => (
                      <Command.Item key={u.id} value={`switch:${u.id}`} onSelect={() => go(`/worlds/${u.id}`)} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-text-2 data-[selected=true]:bg-surface-2 data-[selected=true]:text-text">
                        <Globe className="size-4 text-gold-dim" /> {u.name}
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null}
              </Command.List>
              <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-2xs text-muted">
                <span><Kbd>↑↓</Kbd> navigate</span>
                <span><Kbd>↵</Kbd> open</span>
                <span><Kbd>esc</Kbd> close</span>
              </div>
            </Command>
          </D.Content>
        </D.Portal>
      </D.Root>
    </>
  );
}
