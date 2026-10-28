import { TriangleAlert } from "lucide-react";

export function LegalDraft({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <h1 className="font-serif text-5xl font-semibold">{title}</h1>
      <div role="note" className="mt-6 flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-[#e2c58c]">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>
          <strong>Draft for review.</strong> This document is a placeholder written for development. It has not been reviewed by a lawyer and must be reviewed and completed before any commercial launch.
        </p>
      </div>
      <div className="wf-prose mt-8">{children}</div>
    </article>
  );
}
