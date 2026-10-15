import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    name: "Apprentice",
    price: "Free",
    note: "while WorldForge is in early access",
    features: ["3 universes", "Unlimited characters, events and lore", "Relationship graph, Chronos and Atlas", "Deterministic consistency checks", "Living World Engine (deterministic)", "JSON & Markdown export"],
    cta: "Start free",
    href: "/signup",
    highlight: false,
  },
  {
    name: "Loremaster",
    price: "Planned",
    note: "pricing to be announced",
    features: ["Unlimited universes", "Unlimited alternate timelines", "AI suggestions with a monthly allowance", "Larger media library", "Priority export & backup"],
    cta: "Join with a free account",
    href: "/signup",
    highlight: true,
  },
  {
    name: "Guild",
    price: "Planned",
    note: "for studios and writers' rooms",
    features: ["Everything in Loremaster", "Editor and viewer seats", "Shared AI allowance", "Audit log export", "Self-hosting guidance"],
    cta: "Learn about the mission",
    href: "/about",
    highlight: false,
  },
];

export function PricingPlans() {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.name} className={cn("wf-panel flex flex-col p-6", p.highlight && "border-gold/50")}>
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-2xl font-semibold">{p.name}</h3>
              {p.highlight ? <span className="rounded-full border border-gold/40 px-2 py-0.5 text-2xs uppercase tracking-wider text-gold">Most complete</span> : null}
            </div>
            <div className="mt-3 font-serif text-4xl font-semibold">{p.price}</div>
            <div className="text-xs text-muted">{p.note}</div>
            <ul className="mt-6 flex flex-1 flex-col gap-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-text-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" /> {f}
                </li>
              ))}
            </ul>
            <Button asChild variant={p.highlight ? "primary" : "secondary"} className="mt-6">
              <Link href={p.href}>{p.cta}</Link>
            </Button>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-muted">
        Billing is not enabled in this build. Paid plans are planned; no payment details are collected.
      </p>
    </>
  );
}
