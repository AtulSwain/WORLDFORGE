"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, BookOpen, Check, FilePlus2, Sparkles } from "lucide-react";
import { GENRES, GENRE_LABELS, type GenreKey } from "@/domain/catalog";
import { universeCreateSchema } from "@/domain/schemas";
import { createUniverseAction, saveOnboardingDraftAction } from "@/server/actions/universe";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field, FormError } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type Values = {
  name: string;
  genre: GenreKey;
  customGenre: string;
  startMethod: "BLANK" | "TEMPLATE" | "AI";
  description: string;
  mainConflict: string;
  timePeriod: string;
  tone: string;
  coreRules: string;
};

const STEPS = ["Name", "Genre", "Start", "Parameters", "Create"];

const EMPTY: Values = { name: "", genre: "HIGH_FANTASY", customGenre: "", startMethod: "BLANK", description: "", mainConflict: "", timePeriod: "", tone: "", coreRules: "" };

export function CreateWorldWizard({
  draft,
  ai,
}: {
  draft: { step: number; values: Record<string, unknown> } | null;
  ai: { available: boolean; demo: boolean };
}) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(draft?.step ?? 0, 4));
  const [values, setValues] = useState<Values>({ ...EMPTY, ...(draft?.values as Partial<Values>) });
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pending, start] = useTransition();
  const first = useRef(true);

  // Persist progress so the creator can resume onboarding later.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaveState("saving");
    const t = setTimeout(async () => {
      const r = await saveOnboardingDraftAction({ step, values });
      setSaveState(r.ok ? "saved" : "error");
    }, 700);
    return () => clearTimeout(t);
  }, [step, values]);

  const set = <K extends keyof Values>(k: K, v: Values[K]) => setValues((s) => ({ ...s, [k]: v }));

  const next = () => {
    setFieldError(null);
    if (step === 0 && values.name.trim().length < 2) return setFieldError("Give your universe a name of at least 2 characters.");
    if (step === 1 && values.genre === "CUSTOM" && !values.customGenre.trim()) return setFieldError("Describe your custom genre.");
    if (step === 2 && values.startMethod === "AI" && !ai.available) return setFieldError("AI generation is not configured on this server. Choose another start.");
    setStep((s) => Math.min(s + 1, 4));
  };

  const create = () =>
    start(async () => {
      setError(null);
      const parsed = universeCreateSchema.safeParse(values);
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Please review your answers.");
      const r = await createUniverseAction(parsed.data);
      if (!r.ok) return setError(r.error);
      router.push(values.startMethod === "AI" ? `/worlds/${r.data.id}?outline=1` : `/worlds/${r.data.id}`);
    });

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="wf-eyebrow">New universe · Step {step + 1} of {STEPS.length}</p>
        <p className="text-xs text-muted" aria-live="polite">
          {saveState === "saving" ? "Saving progress…" : saveState === "saved" ? "Progress saved" : saveState === "error" ? "Progress not saved" : ""}
        </p>
      </div>
      <ol className="mt-3 flex gap-1.5" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={cn("h-1 rounded-full transition-colors", i <= step ? "bg-gold" : "bg-surface-3")} />
            <span className={cn("mt-1.5 hidden text-2xs sm:block", i === step ? "text-gold" : "text-muted")}>{s}</span>
          </li>
        ))}
      </ol>

      <div className="mt-8 min-h-80">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
            {step === 0 ? (
              <div>
                <h1 className="font-serif text-4xl font-semibold">Name your universe</h1>
                <p className="mt-2 text-text-2">You can rename it at any time.</p>
                <Field label="Universe name" htmlFor="name" error={fieldError ?? undefined} className="mt-6">
                  <Input id="name" autoFocus value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. The Drowned Meridian" className="h-12 text-lg" onKeyDown={(e) => e.key === "Enter" && next()} />
                </Field>
              </div>
            ) : step === 1 ? (
              <div>
                <h1 className="font-serif text-4xl font-semibold">Choose a genre</h1>
                <p className="mt-2 text-text-2">This tunes defaults and AI suggestions. It never limits what you can create.</p>
                <div role="radiogroup" aria-label="Genre" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {GENRES.map((g) => (
                    <button
                      key={g}
                      role="radio"
                      aria-checked={values.genre === g}
                      onClick={() => set("genre", g)}
                      className={cn("rounded-lg border px-3 py-3 text-left text-sm transition-colors", values.genre === g ? "border-gold bg-gold/10 text-gold" : "border-border bg-surface hover:border-border-strong")}
                    >
                      {GENRE_LABELS[g]}
                    </button>
                  ))}
                </div>
                {values.genre === "CUSTOM" ? (
                  <Field label="Describe your genre" htmlFor="customGenre" error={fieldError ?? undefined} className="mt-4">
                    <Input id="customGenre" value={values.customGenre} onChange={(e) => set("customGenre", e.target.value)} placeholder="e.g. Solarpunk mystery" />
                  </Field>
                ) : null}
              </div>
            ) : step === 2 ? (
              <div>
                <h1 className="font-serif text-4xl font-semibold">How would you like to begin?</h1>
                <div role="radiogroup" aria-label="Starting method" className="mt-6 grid gap-3">
                  {[
                    { id: "BLANK" as const, icon: FilePlus2, title: "Start from a blank universe", body: "An empty archive with a main timeline and a blank survey map.", disabled: false },
                    { id: "TEMPLATE" as const, icon: BookOpen, title: "Use a starter template", body: "Begin from a full copy of The Ashen Crown — 17 characters, 6 factions, 25 events and an alternate timeline — renamed to your universe.", disabled: false },
                    {
                      id: "AI" as const,
                      icon: Sparkles,
                      title: "Generate an initial outline with AI",
                      body: ai.available
                        ? `Creates a blank universe, then drafts factions, characters and history for you to review. Nothing becomes canon until you approve it.${ai.demo ? " (Demo mode: sample outputs.)" : ""}`
                        : "Not available: no AI provider is configured on this server. Everything else works without it.",
                      disabled: !ai.available,
                    },
                  ].map((o) => (
                    <button
                      key={o.id}
                      role="radio"
                      aria-checked={values.startMethod === o.id}
                      aria-disabled={o.disabled}
                      onClick={() => !o.disabled && set("startMethod", o.id)}
                      className={cn(
                        "flex gap-4 rounded-lg border p-4 text-left transition-colors",
                        values.startMethod === o.id ? "border-gold bg-gold/10" : "border-border bg-surface hover:border-border-strong",
                        o.disabled && "cursor-not-allowed opacity-60 hover:border-border",
                      )}
                    >
                      <o.icon className={cn("mt-0.5 size-5 shrink-0", values.startMethod === o.id ? "text-gold" : "text-muted")} />
                      <div>
                        <div className="font-medium">{o.title}</div>
                        <div className="mt-1 text-sm text-text-2">{o.body}</div>
                      </div>
                    </button>
                  ))}
                </div>
                {fieldError ? <p role="alert" className="mt-3 text-sm text-[#e7a3a3]">{fieldError}</p> : null}
              </div>
            ) : step === 3 ? (
              <div>
                <h1 className="font-serif text-4xl font-semibold">Set the stage</h1>
                <p className="mt-2 text-text-2">All optional. These become your world&apos;s core reference and ground AI suggestions.</p>
                <div className="mt-6 grid gap-4">
                  <Field label="World description" htmlFor="description">
                    <Textarea id="description" value={values.description} onChange={(e) => set("description", e.target.value)} placeholder="A sentence or a page — what is this world?" />
                  </Field>
                  <Field label="Main conflict" htmlFor="mainConflict">
                    <Input id="mainConflict" value={values.mainConflict} onChange={(e) => set("mainConflict", e.target.value)} />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Time period" htmlFor="timePeriod">
                      <Input id="timePeriod" value={values.timePeriod} onChange={(e) => set("timePeriod", e.target.value)} placeholder="e.g. Late Bronze Age analogue" />
                    </Field>
                    <Field label="Tone" htmlFor="tone">
                      <Input id="tone" value={values.tone} onChange={(e) => set("tone", e.target.value)} placeholder="e.g. Grim, hopeful, satirical" />
                    </Field>
                  </div>
                  <Field label="Core rules or restrictions" htmlFor="coreRules" hint="One rule per line, e.g. “Magic always has a cost.”">
                    <Textarea id="coreRules" value={values.coreRules} onChange={(e) => set("coreRules", e.target.value)} />
                  </Field>
                </div>
              </div>
            ) : (
              <div>
                <h1 className="font-serif text-4xl font-semibold">Ready to found {values.name || "your universe"}</h1>
                <dl className="wf-panel mt-6 divide-y divide-border text-sm">
                  {[
                    ["Name", values.name],
                    ["Genre", values.genre === "CUSTOM" ? values.customGenre : GENRE_LABELS[values.genre]],
                    ["Start", values.startMethod === "BLANK" ? "Blank universe" : values.startMethod === "TEMPLATE" ? "The Ashen Crown template" : "AI outline (reviewed before canon)"],
                    ["Main conflict", values.mainConflict || "—"],
                    ["Tone", values.tone || "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-4 px-4 py-2.5">
                      <dt className="w-32 shrink-0 text-muted">{k}</dt>
                      <dd className="min-w-0 break-words">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4"><FormError message={error} /></div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || pending}>
          <ArrowLeft /> Back
        </Button>
        {step < 4 ? (
          <Button variant="primary" onClick={next}>
            Continue <ArrowRight />
          </Button>
        ) : (
          <Button variant="primary" onClick={create} disabled={pending}>
            {pending ? "Founding your universe…" : (<><Check /> Create universe</>)}
          </Button>
        )}
      </div>
    </div>
  );
}
