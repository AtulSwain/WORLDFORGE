import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GraphPreview, ImpactPreview, TimelinePreview } from "@/components/marketing/previews";

export const metadata = { title: "Features" };

const SECTIONS = [
  {
    title: "Character Forge",
    body: "Identity, personality, narrative arcs, secrets and turning points in validated, structured fields. Every character's relationships and appearances come straight from the archive, and their history is preserved revision by revision.",
    points: ["Grid & list directories with search, filters and sorting", "Timeline-aware status, allegiance and relationships", "Revision history with compare and restore", "Optional AI drafts as editable previews"],
  },
  {
    title: "Factions & civilizations",
    body: "Ideology, government, leadership, territory, resources and secret objectives — with successions recorded as events and dated relationships rather than silent rewrites.",
    points: ["Members, allies and enemies over time", "Controlled territory linked to the Atlas", "Overlapping reigns flagged automatically"],
  },
  {
    title: "Atlas Studio",
    body: "Image-backed fantasy maps with their own coordinate system — no third-party map key required. Place and drag markers, draw routes and regions, filter layers, and open any location's inspector.",
    points: ["Pan, zoom and persistent viewport", "Markers linked to locations, factions and events", "Upload your own map artwork"],
  },
  {
    title: "Lore Codex",
    body: "A searchable encyclopedia written in safe Markdown, with categories, tags, linked entities and events, autosave that only reports “saved” after the server confirms, and full revision history.",
    points: ["Sixteen built-in categories", "Concurrency protection for simultaneous edits", "Lore links feed impact analysis and AI context"],
  },
];

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <p className="wf-eyebrow text-gold-dim">Features</p>
      <h1 className="mt-2 max-w-3xl font-serif text-5xl font-semibold leading-tight">A creative workstation for entire civilizations.</h1>
      <p className="mt-4 max-w-2xl text-lg text-text-2">Every module works on the same structured, persisted canon — so the graph, the timeline, the atlas and the engine always agree.</p>

      <div className="mt-16 grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <h2 className="font-serif text-3xl font-semibold">Relationship Graph</h2>
          <p className="mt-3 text-text-2">Real entities as nodes, real relationships as edges. Focus on a character, expand their neighbourhood, filter by entity or relationship type, find the shortest path between two figures, and create new connections with server-side validation.</p>
        </div>
        <GraphPreview />
      </div>
      <div className="mt-16 grid gap-10 lg:grid-cols-2 lg:items-center">
        <TimelinePreview />
        <div>
          <h2 className="font-serif text-3xl font-semibold">Chronos Timeline</h2>
          <p className="mt-3 text-text-2">A horizontal canvas from eras down to days. Events carry precision — exact day, month, year, circa, decade, century or era — and causal links: causes, enables, prevents, occurs before, contributes to. Cycles are rejected; chronology conflicts are explained.</p>
        </div>
      </div>
      <div className="mt-16 grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <h2 className="font-serif text-3xl font-semibold">Living World Engine & alternate timelines</h2>
          <p className="mt-3 text-text-2">Propose a change, inspect a grouped impact report with evidence for every item, accept or reject each suggestion, and commit atomically to a timeline or a new branch. Branches store only their differences, can be compared with their parent, and never touch canon.</p>
        </div>
        <ImpactPreview />
      </div>

      <div className="mt-20 grid gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <section key={s.title} className="wf-panel p-6">
            <h2 className="font-serif text-2xl font-semibold">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-2">{s.body}</p>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-text-2">
              {s.points.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-16 text-center">
        <Button asChild variant="primary" size="lg">
          <Link href="/signup">Start building your world <ArrowRight /></Link>
        </Button>
      </div>
    </div>
  );
}
