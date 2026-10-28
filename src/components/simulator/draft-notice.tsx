"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Flame } from "lucide-react";
import { analyzeProposalAction } from "@/server/actions/engine";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";

export function DraftNotice({ worldId, proposalId, title, rationale, canWrite }: { worldId: string; proposalId: string; title: string; rationale: string; canWrite: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="wf-panel p-6">
      <p className="wf-eyebrow">Draft proposal</p>
      <h2 className="mt-1 font-serif text-3xl font-semibold">{title}</h2>
      {rationale ? <p className="mt-2 text-text-2">{rationale}</p> : null}
      <p className="mt-4 text-sm text-text-2">This proposal has not been analysed yet. The engine will trace dependencies, participants, relationships and lore references, and check the hypothetical world against your consistency rules.</p>
      <div className="mt-4"><FormError message={error} /></div>
      {canWrite ? (
        <Button
          variant="primary"
          className="mt-4"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await analyzeProposalAction(worldId, proposalId);
              if (!r.ok) return setError(r.error);
              router.refresh();
            })
          }
        >
          <Flame /> {pending ? "Analysing…" : "Run analysis"}
        </Button>
      ) : null}
    </div>
  );
}
