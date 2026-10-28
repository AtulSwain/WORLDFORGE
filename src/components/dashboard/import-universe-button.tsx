"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileUp, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface Issue {
  path: string;
  message: string;
}

/** Imports a WorldForge export (.json or .zip) as a new universe, showing the validation report on failure. */
export function ImportUniverseButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setIssues([]);
    try {
      const fd = new FormData();
      fd.set("file", file);
      if (name.trim()) fd.set("name", name.trim());
      const res = await fetch("/api/worlds/import", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Import failed.");
        setIssues(Array.isArray(body.issues) ? body.issues : []);
        return;
      }
      const warnings = (body.warnings as string[] | undefined) ?? [];
      toast.success("Universe imported", warnings.length ? { description: warnings.join(" ") } : undefined);
      router.push(`/worlds/${body.universeId}`);
    } catch {
      setError("The upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setError(null); setIssues([]); } }}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}><FileUp /> Import</Button>
      <DialogContent title="Import a universe" description="Upload a WorldForge export (.zip bundle or universe.json). It becomes a new universe that you own; nothing existing is changed.">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <Field label="Export file" htmlFor="imp-file">
            <Input id="imp-file" type="file" accept=".zip,.json,application/zip,application/json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
          </Field>
          <Field label="Name (optional)" htmlFor="imp-name" hint="Defaults to the name stored in the file."><Input id="imp-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>
          <FormError message={error} />
          {issues.length ? (
            <div className="max-h-60 overflow-auto rounded-md border border-border bg-bg-2 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Validation report ({issues.length}{issues.length >= 50 ? "+" : ""})</p>
              <ul className="flex flex-col gap-1.5 text-xs">
                {issues.map((i, n) => (
                  <li key={n}><code className="text-gold">{i.path || "(file)"}</code> — <span className="text-text-2">{i.message}</span></li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!file || busy}><Upload /> {busy ? "Validating and importing…" : "Import"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
