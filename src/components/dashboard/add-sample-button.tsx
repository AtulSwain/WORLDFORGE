"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addSampleUniverseAction } from "@/server/actions/universe";

export function AddSampleButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await addSampleUniverseAction();
            if (!r.ok) return setError(r.error);
            router.push(`/worlds/${r.data.id}`);
          })
        }
      >
        <BookOpen /> {pending ? "Preparing The Ashen Crown…" : "Add The Ashen Crown sample"}
      </Button>
      {error ? <p role="alert" className="text-xs text-[#e7a3a3]">{error}</p> : null}
    </div>
  );
}
