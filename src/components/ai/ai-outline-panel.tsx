"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sparkles, Check, X } from "lucide-react";
import { toast } from "sonner";
import { acceptOutlineAction, rejectSuggestionAction, requestOutlineAction } from "@/server/actions/ai";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormError } from "@/components/ui/field";

interface Outline {
  summary: string;
  factions: { name: string; summary: string }[];
  characters: { name: string; summary: string; faction?: string }[];
  locations: { name: string; summary: string }[];
  events: { title: string; year: number; description: string }[];
}

type Section = "factions" | "characters" | "locations" | "events";

export function AiOutlinePanel({ worldId, ai, canWrite }: { worldId: string; ai: { available: boolean; demo: boolean }; canWrite: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [s, setS] = useState<{ id: string; output: Outline; isDemo: boolean } | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  if (!ai.available || !canWrite) {
    return (
      <section className="wf-panel p-5">
        <h2 className="flex items-center gap-2 font-serif text-xl font-semibold"><Sparkles className="size-5 text-violet" /> AI world outline</h2>
        <p className="mt-2 text-sm text-text-2">{!ai.available ? "AI is not configured on this server. Your universe was created as a blank archive — start with the quick actions below." : "Only editors can generate outlines."}</p>
      </section>
    );
  }

  const generate = () =>
    start(async () => {
      setError(null);
      const r = await requestOutlineAction(worldId);
      if (!r.ok) return setError(r.error);
      const output = r.data.output as unknown as Outline;
      setS({ id: r.data.id, output, isDemo: r.data.isDemo });
      const all: Record<string, boolean> = {};
      (["factions", "characters", "locations", "events"] as Section[]).forEach((k) => output[k].forEach((_, i) => (all[`${k}:${i}`] = true)));
      setSelected(all);
    });

  const accept = () =>
    start(async () => {
      if (!s) return;
      const pick = <T,>(k: Section, list: T[]) => list.filter((_, i) => selected[`${k}:${i}`]);
      const edited = {
        summary: s.output.summary,
        factions: pick("factions", s.output.factions),
        characters: pick("characters", s.output.characters),
        locations: pick("locations", s.output.locations),
        events: pick("events", s.output.events),
      };
      const r = await acceptOutlineAction(worldId, s.id, edited);
      if (!r.ok) return setError(r.error);
      toast.success("Selected outline records were added to your universe");
      setS(null);
      router.replace(`/worlds/${worldId}`);
      router.refresh();
    });

  return (
    <section className="wf-panel border-violet/40 p-5">
      <h2 className="flex items-center gap-2 font-serif text-xl font-semibold"><Sparkles className="size-5 text-violet" /> AI world outline {s?.isDemo ? <Badge tone="violet">demo samples</Badge> : null}</h2>
      <p className="mt-1 text-sm text-text-2">Drafts factions, characters, places and history from your universe settings. Choose what to keep — nothing is created until you accept.</p>
      <div className="mt-3"><FormError message={error} /></div>
      {!s ? (
        <Button variant="primary" className="mt-3" onClick={generate} disabled={pending}><Sparkles /> {pending ? "Drafting an outline…" : "Generate outline"}</Button>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-sm italic text-text-2">{s.output.summary}</p>
          {(["factions", "characters", "locations", "events"] as Section[]).map((k) => (
            <fieldset key={k}>
              <legend className="wf-eyebrow mb-1.5">{k}</legend>
              <ul className="flex flex-col gap-1">
                {(s.output[k] as { name?: string; title?: string; summary?: string; description?: string; year?: number }[]).map((item, i) => (
                  <li key={i}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2">
                      <input type="checkbox" className="mt-1 accent-[#D6BD8D]" checked={!!selected[`${k}:${i}`]} onChange={(e) => setSelected({ ...selected, [`${k}:${i}`]: e.target.checked })} />
                      <span>
                        <span className="font-medium">{item.name ?? item.title}</span>
                        {item.year != null ? <span className="text-muted"> · Year {item.year}</span> : null}
                        <span className="block text-xs text-text-2">{item.summary ?? item.description}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => start(async () => { await rejectSuggestionAction(worldId, s.id); setS(null); })} disabled={pending}><X /> Discard</Button>
            <Button variant="primary" onClick={accept} disabled={pending}><Check /> {pending ? "Creating…" : "Add selected to canon"}</Button>
          </div>
        </div>
      )}
    </section>
  );
}
