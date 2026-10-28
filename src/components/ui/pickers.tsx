"use client";

import { Command } from "cmdk";
import { useId, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import type { EntityTypeKey } from "@/domain/catalog";
import { EntityIcon } from "@/components/world/entity-visual";
import { Popover, PopoverContent, PopoverTrigger } from "./menu";
import { fieldBase } from "./input";
import { cn } from "@/lib/utils";

export interface PickOption {
  id: string;
  name: string;
  type?: string;
  hint?: string;
}

/** Accessible searchable single-select for entities/events. */
export function RecordPicker({
  options,
  value,
  onChange,
  placeholder = "Select…",
  id,
  allowClear = true,
  invalid,
}: {
  options: PickOption[];
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  placeholder?: string;
  id?: string;
  allowClear?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const selected = options.find((o) => o.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <button id={id} type="button" role="combobox" aria-expanded={open} aria-controls={listId} aria-invalid={invalid} className={cn(fieldBase, "flex h-9 items-center gap-2 pr-14 text-left")}>
            {selected ? (
              <>
                {selected.type ? <EntityIcon type={selected.type as EntityTypeKey} className="size-3.5" /> : null}
                <span className="truncate">{selected.name}</span>
              </>
            ) : (
              <span className="text-muted">{placeholder}</span>
            )}
          </button>
        </PopoverTrigger>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"><ChevronsUpDown className="size-3.5" /></span>
        {allowClear && selected ? (
          <button type="button" aria-label="Clear selection" onClick={() => onChange(null)} className="absolute right-7 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-text">
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0" align="start">
        <Command label="Search records">
          <Command.Input placeholder="Search…" className="h-10 w-full border-b border-border bg-transparent px-3 text-sm focus:outline-none" />
          <Command.List id={listId} className="max-h-64 overflow-y-auto p-1">
            <Command.Empty className="px-3 py-2 text-xs text-muted">No matches.</Command.Empty>
            {options.map((o) => (
              <Command.Item
                key={o.id}
                value={`${o.name} ${o.id}`}
                onSelect={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm data-[selected=true]:bg-surface-2"
              >
                {o.type ? <EntityIcon type={o.type as EntityTypeKey} className="size-3.5" /> : null}
                <span className="flex-1 truncate">{o.name}</span>
                {o.hint ? <span className="text-2xs text-muted">{o.hint}</span> : null}
                {o.id === value ? <Check className="size-3.5 text-gold" /> : null}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Multi-select built on RecordPicker. */
export function MultiRecordPicker({ options, value, onChange, placeholder }: { options: PickOption[]; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const byId = new Map(options.map((o) => [o.id, o]));
  return (
    <div className="flex flex-col gap-2">
      {value.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <li key={id} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 py-0.5 pl-2 pr-1 text-xs">
              {byId.get(id)?.type ? <EntityIcon type={byId.get(id)!.type as EntityTypeKey} className="size-3" /> : null}
              {byId.get(id)?.name ?? "Unknown"}
              <button type="button" aria-label={`Remove ${byId.get(id)?.name ?? "item"}`} onClick={() => onChange(value.filter((v) => v !== id))} className="rounded-full p-0.5 text-muted hover:text-text">
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <RecordPicker options={options.filter((o) => !value.includes(o.id))} value={null} onChange={(v) => v && onChange([...value, v])} placeholder={placeholder} allowClear={false} />
    </div>
  );
}

/** Free-text list editor (enter or comma to add). */
export function ListInput({ value, onChange, placeholder, id }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; id?: string }) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const parts = draft.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) onChange([...value, ...parts.filter((p) => !value.includes(p))].slice(0, 50));
    setDraft("");
  };
  return (
    <div className={cn(fieldBase, "flex min-h-9 flex-wrap items-center gap-1.5 px-2 py-1.5")}>
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded bg-surface-2 py-0.5 pl-2 pr-1 text-xs">
          {v}
          <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} className="text-muted hover:text-text">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={commit}
        placeholder={value.length ? "" : placeholder}
        className="min-w-24 flex-1 bg-transparent py-0.5 text-sm placeholder:text-muted focus:outline-none"
      />
    </div>
  );
}
