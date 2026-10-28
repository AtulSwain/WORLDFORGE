"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LORE_CATEGORIES, humanize } from "@/domain/catalog";
import { createLoreAction } from "@/server/actions/content";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field, FormError } from "@/components/ui/field";

export function NewLoreForm({ worldId }: { worldId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("HISTORY");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="wf-panel flex flex-col gap-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          if (!title.trim()) return setError("Give the document a title.");
          const r = await createLoreAction(worldId, { title, category: category as "HISTORY", body: `# ${title}\n\n` });
          if (!r.ok) return setError(r.error);
          router.push(`/worlds/${worldId}/codex/${r.data.id}`);
        });
      }}
    >
      <FormError message={error} />
      <Field label="Title" htmlFor="title"><Input id="title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Category" htmlFor="category">
        <NativeSelect id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
          {LORE_CATEGORIES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
        </NativeSelect>
      </Field>
      <Button type="submit" variant="primary" disabled={pending}>{pending ? "Creating…" : "Create and open editor"}</Button>
    </form>
  );
}
