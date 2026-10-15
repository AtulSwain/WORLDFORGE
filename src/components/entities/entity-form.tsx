"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  BUILTIN_RELATIONSHIP_KEYS, BUILTIN_RELATIONSHIP_TYPES, CANON_STATUSES, ENTITY_STATUSES, ENTITY_TYPE_META, entityHref, humanize, type EntityTypeKey,
} from "@/domain/catalog";
import { entityInputSchema } from "@/domain/schemas";
import { createEntityAction, updateEntityAction } from "@/server/actions/content";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field, FormError } from "@/components/ui/field";
import { ListInput, RecordPicker, type PickOption } from "@/components/ui/pickers";

type FieldKind = "text" | "textarea" | "list" | "kv";
interface AttrField {
  key: string;
  label: string;
  kind: FieldKind;
  hint?: string;
  rows?: number;
}
interface Section {
  title: string;
  description?: string;
  fields: AttrField[];
}

const SECTIONS: Partial<Record<EntityTypeKey, Section[]>> = {
  CHARACTER: [
    {
      title: "Identity",
      fields: [
        { key: "aliases", label: "Aliases", kind: "list", hint: "Press Enter after each alias." },
        { key: "species", label: "Species", kind: "text" },
        { key: "gender", label: "Gender", kind: "text", hint: "If relevant to your world." },
        { key: "birthDateLabel", label: "Birth date or period", kind: "text", hint: "Free text, e.g. “late in the Thaw of 818”. Use the year fields for chronology." },
        { key: "occupation", label: "Occupation", kind: "text" },
        { key: "role", label: "Narrative role", kind: "text", hint: "e.g. Protagonist, Antagonist, Mentor." },
      ],
    },
    {
      title: "Personality",
      fields: [
        { key: "personality", label: "Personality", kind: "textarea" },
        { key: "motivations", label: "Motivations", kind: "list" },
        { key: "fears", label: "Fears", kind: "list" },
        { key: "strengths", label: "Strengths", kind: "list" },
        { key: "flaws", label: "Flaws", kind: "list" },
        { key: "beliefs", label: "Beliefs", kind: "list" },
        { key: "values", label: "Values", kind: "list" },
      ],
    },
    {
      title: "Narrative",
      fields: [
        { key: "backstory", label: "Backstory", kind: "textarea", rows: 8 },
        { key: "goals", label: "Goals", kind: "textarea" },
        { key: "internalConflict", label: "Internal conflict", kind: "textarea" },
        { key: "externalConflict", label: "External conflict", kind: "textarea" },
        { key: "arc", label: "Character arc", kind: "textarea" },
        { key: "secrets", label: "Secrets", kind: "textarea" },
        { key: "turningPoints", label: "Turning points", kind: "list" },
      ],
    },
  ],
  FACTION: [
    {
      title: "Identity & ideology",
      fields: [
        { key: "kind", label: "Kind", kind: "text", hint: "Kingdom, guild, order, cult…" },
        { key: "emblem", label: "Emblem", kind: "text", hint: "Describe the device, or attach an image in Assets." },
        { key: "ideology", label: "Ideology", kind: "textarea" },
        { key: "government", label: "Government structure", kind: "text" },
        { key: "reputation", label: "Public reputation", kind: "textarea" },
      ],
    },
    {
      title: "Power",
      description: "Leadership, members, allies, enemies and territory are relationships — manage them on the faction's page.",
      fields: [
        { key: "resources", label: "Resources", kind: "list" },
        { key: "militaryStrength", label: "Military strength or influence", kind: "text" },
        { key: "internalDivisions", label: "Internal divisions", kind: "textarea" },
        { key: "secretObjectives", label: "Secret objectives", kind: "textarea" },
      ],
    },
  ],
  LOCATION: [
    {
      title: "Geography",
      fields: [
        { key: "category", label: "Category", kind: "text", hint: "City, ruin, pass, forest…" },
        { key: "climate", label: "Climate", kind: "text" },
        { key: "population", label: "Population", kind: "text" },
        { key: "notableFeatures", label: "Notable features", kind: "list" },
      ],
    },
  ],
  ARTIFACT: [
    {
      title: "Artifact",
      fields: [
        { key: "material", label: "Material", kind: "text" },
        { key: "powers", label: "Powers & properties", kind: "textarea" },
        { key: "origin", label: "Origin", kind: "textarea" },
      ],
    },
  ],
};
const GENERIC: Section[] = [{ title: "Details", fields: [{ key: "notes", label: "Notes", kind: "textarea", rows: 6 }, { key: "properties", label: "Properties", kind: "kv" }] }];

const SPAN_LABELS: Partial<Record<EntityTypeKey, [string, string]>> = {
  CHARACTER: ["Birth year", "Death year"],
  FACTION: ["Founded", "Dissolved"],
  LOCATION: ["Established", "Destroyed / abandoned"],
  ARTIFACT: ["Created", "Destroyed"],
};

const QUICK_CONNECTIONS: Partial<Record<EntityTypeKey, { label: string; type: string; direction: "out" | "in" }[]>> = {
  CHARACTER: [
    { label: "Family", type: "RELATED_TO", direction: "out" },
    { label: "Spouse", type: "MARRIED_TO", direction: "out" },
    { label: "Friend", type: "FRIEND_OF", direction: "out" },
    { label: "Rival", type: "RIVAL_OF", direction: "out" },
    { label: "Enemy", type: "ENEMY_OF", direction: "out" },
    { label: "Mentor", type: "MENTORS", direction: "in" },
    { label: "Faction", type: "MEMBER_OF", direction: "out" },
    { label: "Birthplace", type: "BORN_IN", direction: "out" },
    { label: "Residence", type: "LOCATED_IN", direction: "out" },
  ],
  FACTION: [
    { label: "Leader", type: "RULES", direction: "in" },
    { label: "Ally", type: "ALLY_OF", direction: "out" },
    { label: "Enemy", type: "ENEMY_OF", direction: "out" },
    { label: "Territory", type: "CONTROLS", direction: "out" },
  ],
  LOCATION: [
    { label: "Inside region", type: "LOCATED_IN", direction: "out" },
    { label: "Controlled by", type: "CONTROLS", direction: "in" },
  ],
  ARTIFACT: [
    { label: "Owner", type: "OWNS", direction: "in" },
    { label: "Creator", type: "CREATED", direction: "in" },
    { label: "Kept at", type: "LOCATED_IN", direction: "out" },
  ],
};

interface FormValues {
  name: string;
  summary: string;
  description: string;
  status: string;
  beginYear: string;
  endYear: string;
  canonStatus: string;
  customTypeLabel: string;
  portrait: string;
  attributes: Record<string, unknown>;
}

export interface EntityFormProps {
  worldId: string;
  type: EntityTypeKey;
  options: PickOption[];
  initial?: {
    id: string;
    version: number;
    name: string;
    summary: string;
    description: string;
    status: string;
    beginYear: number | null;
    endYear: number | null;
    canonStatus: string;
    customTypeLabel: string | null;
    portrait: string | null;
    attributes: Record<string, unknown>;
  };
}

export function EntityForm({ worldId, type, options, initial }: EntityFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [connections, setConnections] = useState<{ type: string; targetId: string | null; direction: "out" | "in" }[]>([]);
  const meta = ENTITY_TYPE_META[type];
  const sections = SECTIONS[type] ?? GENERIC;
  const span = SPAN_LABELS[type] ?? ["Begins (year)", "Ends (year)"];
  const form = useForm<FormValues>({
    defaultValues: {
      name: initial?.name ?? "",
      summary: initial?.summary ?? "",
      description: initial?.description ?? "",
      status: initial?.status ?? ENTITY_STATUSES[type][0]!,
      beginYear: initial?.beginYear != null ? String(initial.beginYear) : "",
      endYear: initial?.endYear != null ? String(initial.endYear) : "",
      canonStatus: initial?.canonStatus ?? "CANON",
      customTypeLabel: initial?.customTypeLabel ?? "",
      portrait: initial?.portrait ?? "",
      attributes: initial?.attributes ?? {},
    },
  });
  const { errors, isDirty } = form.formState;

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [isDirty]);

  const onSubmit = form.handleSubmit((v) =>
    start(async () => {
      setError(null);
      const num = (s: string) => (s.trim() === "" ? null : Number(s));
      const payload = {
        type,
        name: v.name,
        summary: v.summary,
        description: v.description,
        status: v.status,
        beginYear: num(v.beginYear),
        endYear: num(v.endYear),
        canonStatus: v.canonStatus as "CANON",
        customTypeLabel: v.customTypeLabel || null,
        portrait: v.portrait || null,
        attributes: v.attributes,
      };
      const parsed = entityInputSchema.safeParse(payload);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const path = issue.path.join(".") as keyof FormValues;
          form.setError(path, { message: issue.message });
        }
        setError("Please fix the highlighted fields.");
        return;
      }
      const r = initial
        ? await updateEntityAction(worldId, initial.id, parsed.data, initial.version)
        : await createEntityAction(
            worldId,
            parsed.data,
            connections.filter((c) => c.targetId).map((c) => ({ type: c.type, targetId: c.targetId!, direction: c.direction })),
          );
      if (!r.ok) {
        setError(r.error);
        return;
      }
      form.reset(v);
      toast.success(initial ? "Changes saved" : `${meta.label} created`);
      router.push(entityHref(worldId, type, r.data.id));
      router.refresh();
    }),
  );

  const attrField = (f: AttrField) => {
    const name = `attributes.${f.key}` as const;
    const attrError = (errors.attributes as Record<string, { message?: string }> | undefined)?.[f.key]?.message;
    const fieldId = `attr-${f.key}`;
    if (f.kind === "list") {
      return (
        <Field key={f.key} label={f.label} htmlFor={fieldId} hint={f.hint} error={attrError}>
          <Controller control={form.control} name={name} render={({ field }) => <ListInput id={fieldId} value={(field.value as string[]) ?? []} onChange={field.onChange} />} />
        </Field>
      );
    }
    if (f.kind === "kv") {
      return (
        <Field key={f.key} label={f.label} hint="Custom key/value facts.">
          <Controller
            control={form.control}
            name={name}
            render={({ field }) => {
              const rows = ((field.value as { key: string; value: string }[]) ?? []).slice();
              return (
                <div className="flex flex-col gap-2">
                  {rows.map((row, i) => (
                    <div key={i} className="flex gap-2">
                      <Input aria-label="Property name" value={row.key} placeholder="Property" onChange={(e) => { rows[i] = { ...row, key: e.target.value }; field.onChange([...rows]); }} />
                      <Input aria-label="Property value" value={row.value} placeholder="Value" onChange={(e) => { rows[i] = { ...row, value: e.target.value }; field.onChange([...rows]); }} />
                      <Button type="button" variant="ghost" size="icon" aria-label="Remove property" onClick={() => field.onChange(rows.filter((_, j) => j !== i))}><Trash2 /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => field.onChange([...rows, { key: "", value: "" }])}><Plus /> Add property</Button>
                </div>
              );
            }}
          />
        </Field>
      );
    }
    return (
      <Field key={f.key} label={f.label} htmlFor={fieldId} hint={f.hint} error={attrError} className={f.kind === "textarea" ? "sm:col-span-2" : undefined}>
        {f.kind === "textarea" ? (
          <Textarea id={fieldId} rows={f.rows ?? 3} {...form.register(name)} />
        ) : (
          <Input id={fieldId} {...form.register(name)} />
        )}
      </Field>
    );
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <FormError message={error} />

      <section className="wf-panel p-5">
        <h2 className="font-serif text-xl font-semibold">Essentials</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" error={errors.name?.message} className="sm:col-span-2">
            <Input id="name" autoFocus={!initial} aria-invalid={!!errors.name} {...form.register("name", { required: "Name is required." })} />
          </Field>
          {type === "CUSTOM" ? (
            <Field label="Custom type" htmlFor="customTypeLabel" hint="e.g. Constellation, Ship, Prophecy">
              <Input id="customTypeLabel" {...form.register("customTypeLabel")} />
            </Field>
          ) : null}
          <Field label="Summary" htmlFor="summary" hint="One or two sentences shown in directories and graph inspectors." error={errors.summary?.message} className="sm:col-span-2">
            <Textarea id="summary" rows={2} {...form.register("summary")} />
          </Field>
          <Field label="Status" htmlFor="status">
            <NativeSelect id="status" {...form.register("status")}>
              {ENTITY_STATUSES[type].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Canon status" htmlFor="canonStatus" hint="Drafts and disputed records are clearly marked.">
            <NativeSelect id="canonStatus" {...form.register("canonStatus")}>
              {CANON_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </NativeSelect>
          </Field>
          <Field label={span[0]} htmlFor="beginYear" hint="Internal calendar year. Negative for years before your epoch." error={errors.beginYear?.message}>
            <Input id="beginYear" type="number" inputMode="numeric" {...form.register("beginYear")} />
          </Field>
          <Field label={span[1]} htmlFor="endYear" error={errors.endYear?.message}>
            <Input id="endYear" type="number" inputMode="numeric" {...form.register("endYear")} />
          </Field>
          {type === "CHARACTER" ? (
            <Field label="Portrait URL" htmlFor="portrait" hint="Optional. Upload images in the Assets library and paste their link here." className="sm:col-span-2">
              <Input id="portrait" {...form.register("portrait")} placeholder="/api/assets/…" />
            </Field>
          ) : null}
          <Field label="Description" htmlFor="description" className="sm:col-span-2">
            <Textarea id="description" rows={5} {...form.register("description")} />
          </Field>
        </div>
      </section>

      {sections.map((s) => (
        <section key={s.title} className="wf-panel p-5">
          <h2 className="font-serif text-xl font-semibold">{s.title}</h2>
          {s.description ? <p className="mt-1 text-sm text-text-2">{s.description}</p> : null}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">{s.fields.map(attrField)}</div>
        </section>
      ))}

      {!initial ? (
        <section className="wf-panel p-5">
          <h2 className="font-serif text-xl font-semibold">Connections</h2>
          <p className="mt-1 text-sm text-text-2">Optional. Relationships are validated and created together with the {meta.label.toLowerCase()}. You can add more later.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(QUICK_CONNECTIONS[type] ?? []).map((q) => (
              <Button key={q.label} type="button" size="sm" variant="secondary" onClick={() => setConnections((c) => [...c, { type: q.type, direction: q.direction, targetId: null }])}>
                <Plus /> {q.label}
              </Button>
            ))}
            <Button type="button" size="sm" variant="ghost" onClick={() => setConnections((c) => [...c, { type: "ALLY_OF", direction: "out", targetId: null }])}><Plus /> Other</Button>
          </div>
          {connections.length ? (
            <ul className="mt-4 flex flex-col gap-2">
              {connections.map((c, i) => (
                <li key={i} className="grid gap-2 rounded-lg border border-border bg-bg-2 p-2 sm:grid-cols-[150px_minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:items-center">
                  <NativeSelect aria-label="Direction" value={c.direction} onChange={(e) => setConnections((all) => all.map((x, j) => (j === i ? { ...x, direction: e.target.value as "out" | "in" } : x)))}>
                    <option value="out">This {meta.label.toLowerCase()}…</option>
                    <option value="in">…this {meta.label.toLowerCase()}</option>
                  </NativeSelect>
                  <NativeSelect aria-label="Relationship type" value={c.type} onChange={(e) => setConnections((all) => all.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}>
                    {BUILTIN_RELATIONSHIP_KEYS.map((k) => <option key={k} value={k}>{c.direction === "out" ? BUILTIN_RELATIONSHIP_TYPES[k].label : BUILTIN_RELATIONSHIP_TYPES[k].inverseLabel}</option>)}
                  </NativeSelect>
                  <RecordPicker options={options} value={c.targetId} onChange={(v) => setConnections((all) => all.map((x, j) => (j === i ? { ...x, targetId: v } : x)))} placeholder="Choose…" />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove connection" onClick={() => setConnections((all) => all.filter((_, j) => j !== i))}><Trash2 /></Button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <span className="text-xs text-muted" aria-live="polite">{isDirty ? "Unsaved changes" : initial ? "No changes" : ""}</span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={pending}>
            <Save /> {pending ? "Saving…" : initial ? "Save changes" : `Create ${meta.label.toLowerCase()}`}
          </Button>
        </div>
      </div>
    </form>
  );
}
