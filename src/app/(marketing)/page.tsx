import Link from "next/link";
import {
  ArrowRight, BookMarked, Clapperboard, Dices, Download, GitBranch, Network, PenTool, ScrollText, ShieldCheck, Sparkles,
  TriangleAlert, Users, Gamepad2, Library,
} from "lucide-react";
import { HeroLandscape } from "@/components/marketing/hero-landscape";
import { FactionChips, GraphPreview, ImpactPreview, OverviewPreview, SampleUniverseFacts, TimelinePreview } from "@/components/marketing/previews";
import { Showcase } from "@/components/marketing/showcase";
import { PricingPlans } from "@/components/marketing/pricing-plans";
import { Button } from "@/components/ui/button";
import { UNIVERSE } from "@/sample/ashen-crown";

const FEATURES = [
  { icon: Network, title: "Build interconnected worlds", body: "Characters, factions, places, artifacts, species, faiths and magic systems live in one structured model — not scattered documents." },
  { icon: Users, title: "Map every relationship", body: "Alliances, rivalries, lineages and loyalties are explicit, dated connections you can explore in an interactive graph." },
  { icon: ScrollText, title: "Write history with Chronos", body: "Record events with exact or uncertain dates — “c. Year 500” is as valid as a single day — and link causes to consequences." },
  { icon: GitBranch, title: "Explore alternate timelines", body: "Branch history at any event. Branches store only their differences, so the original canon is never overwritten." },
  { icon: TriangleAlert, title: "Detect lore inconsistencies", body: "Deterministic checks catch the dead attending treaties, overlapping reigns, impossible journeys and circular causes — and explain why." },
  { icon: Sparkles, title: "AI grounded in approved canon", body: "Optional AI suggestions draw only on your canon, arrive as editable previews, and never become canon without your approval." },
  { icon: ShieldCheck, title: "Collaborate with roles", body: "Invite editors and viewers. Every change is permission-checked on the server and recorded in revision history." },
  { icon: Download, title: "Export and keep your IP", body: "Download your universe as documented JSON plus Markdown lore and character sheets. Your worlds remain yours." },
];

const USE_CASES = [
  { icon: BookMarked, who: "Novelists", body: "Keep a twelve-book series consistent: who knew what, when, and where everyone was standing." },
  { icon: PenTool, who: "Manga & comic creators", body: "Track character arcs, factions and visual references across hundreds of chapters." },
  { icon: Clapperboard, who: "Screenwriters", body: "Map a show bible's history and test what a retcon would break before the writers' room does." },
  { icon: Gamepad2, who: "Indie game developers", body: "Model factions, territories and lore that quests and dialogue can reference reliably." },
  { icon: Dices, who: "Tabletop game masters", body: "Run a living campaign world and branch it when your players inevitably change history." },
  { icon: Library, who: "Worldbuilders", body: "Grow a universe for its own sake — with an archive that remembers everything." },
];

const FAQ = [
  ["Do I need an AI subscription or API key?", "No. Everything — worlds, graph, timeline, atlas, consistency checks and the Living World Engine's deterministic analysis — works without AI. AI suggestions are optional and can be enabled by configuring a provider."],
  ["Can AI change my canon?", "Never directly. AI output is stored separately as a suggestion. You review, edit, accept or reject each one; only accepted suggestions are written, and every write is recorded as a revision."],
  ["What does the Living World Engine actually calculate?", "It follows explicit structure — causal links, participants, relationships created or ended by an event, lifespans, exclusive roles and lore references — within fixed bounds. It reports contradictions deterministically and frames everything else as questions or possibilities. It does not pretend to predict fiction."],
  ["Will an alternate timeline overwrite my original history?", "No. Branches inherit unchanged records and store only their own changes. You can compare a branch with its parent and promote selected changes deliberately."],
  ["Can I export my world?", "Yes. Owners and editors can download a documented JSON archive, Markdown lore, character sheets, timelines and relationship data at any time."],
  ["Is my data private?", "Universes are visible only to their members. Every request is authorised on the server. The legal pages are drafts pending review before any commercial launch."],
];

export default function LandingPage() {
  const facts = SampleUniverseFacts();
  return (
    <>
      {/* Hero */}
      <section className="relative isolate flex min-h-[calc(100dvh-4rem)] items-center overflow-hidden">
        <HeroLandscape />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-24 sm:px-6">
          <div className="max-w-2xl animate-fade-in">
            <p className="wf-eyebrow mb-4 text-gold-dim">Build worlds that remember everything</p>
            <h1 className="font-serif text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
              Your universe.
              <br />
              <span className="text-gold">Every detail connected.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-text-2 sm:text-lg">
              Create living worlds where characters, kingdoms, history, and lore evolve together. Explore the connections, preserve your canon, and discover what changes when history takes another path.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="primary" size="lg">
                <Link href="/signup">
                  Start building your world <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#example-universe">Explore the universe</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Product preview */}
      <section className="relative border-t border-border/60 bg-bg py-24" aria-labelledby="preview-heading">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro eyebrow="Inside the workstation" id="preview-heading" title="One archive. Four ways to see it." body="Every preview below is rendered from the sample universe with WorldForge's own engine — the same code your worlds run on." />
          <div className="mt-12">
            <Showcase
              tabs={[
                { id: "overview", label: "Universe overview", title: "Counts, recent history and open warnings at a glance.", body: "The dashboard is derived from real records: nothing is a decorative number.", preview: <OverviewPreview /> },
                { id: "graph", label: "Relationship graph", title: "Focus on anyone and expand outward.", body: "Gold edges mark the connections relevant to your selection. Large worlds load lazily around a focus.", preview: <GraphPreview /> },
                { id: "chronos", label: "Chronos timeline", title: "Eras, overlapping wars and precise days on one canvas.", body: "Zoom from eras to days. Uncertain dates stay uncertain — “circa” is a first-class precision.", preview: <TimelinePreview /> },
                { id: "impact", label: "Event-impact analysis", title: "See what breaks before you change history.", body: "This is the engine's real output for moving King Aldren's assassination sixteen years earlier.", preview: <ImpactPreview /> },
              ]}
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border/60 bg-bg-2 py-24" aria-labelledby="features-heading">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro eyebrow="Capabilities" id="features-heading" title="Structured canon, not scattered notes." body="WorldForge treats your fiction like the intricate system it is." />
          <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-bg-2 p-6 transition-colors hover:bg-surface">
                <f.icon className="size-5 text-gold" aria-hidden="true" />
                <h3 className="mt-4 font-medium">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-2">{f.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/features" className="text-sm text-gold hover:underline">See every feature in detail →</Link>
          </div>
        </div>
      </section>

      {/* Example universe */}
      <section id="example-universe" className="scroll-mt-16 border-t border-border/60 py-24" aria-labelledby="example-heading">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="wf-eyebrow text-gold-dim">Example universe</p>
            <h2 id="example-heading" className="mt-2 font-serif text-4xl font-semibold">{UNIVERSE.name}</h2>
            <p className="mt-4 leading-relaxed text-text-2">{UNIVERSE.description}</p>
            <dl className="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-6 lg:grid-cols-3">
              {Object.entries(facts).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs capitalize text-muted">{k}</dt>
                  <dd className="font-serif text-2xl font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6"><FactionChips /></div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="primary">
                <Link href="/signup">Create an account to open it <ArrowRight /></Link>
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted">Every new account can add a personal copy of The Ashen Crown from the dashboard.</p>
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-xl border border-border shadow-pop">
              {/* eslint-disable-next-line @next/next/no-img-element -- static SVG artwork */}
              <img src="/maps/ashen-crown.svg" alt="Map of the Western Reaches: the kingdoms of Veyr, Maren and Kesh joined by the Ember Road." className="block w-full" width={2400} height={1600} loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      {/* Engine */}
      <section id="engine" className="scroll-mt-16 border-t border-border/60 bg-bg-2 py-24" aria-labelledby="engine-heading">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro eyebrow="The Living World Engine" id="engine-heading" title="Change history. Review the consequences. Keep your canon." body="A reviewable impact analysis — deterministic where facts are explicit, honest where they are not." />
          <ol className="mt-12 grid gap-4 md:grid-cols-5">
            {[
              ["Propose", "Pick an event and propose a change: a new date, a new place, or that it never happened."],
              ["Traverse", "The engine walks causal links, participants, relationships and lore within fixed bounds."],
              ["Check", "Deterministic rules compare the world before and after to surface new contradictions."],
              ["Review", "Every impact shows its basis and evidence. Accept, reject or edit each one. AI ideas are labelled."],
              ["Commit", "Accepted changes apply atomically to a timeline or a new branch — with version checks and undo."],
            ].map(([t, b], i) => (
              <li key={t} className="wf-panel p-5">
                <div className="font-serif text-3xl text-gold">{i + 1}</div>
                <div className="mt-2 font-medium">{t}</div>
                <p className="mt-1 text-sm leading-relaxed text-text-2">{b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Use cases */}
      <section className="border-t border-border/60 py-24" aria-labelledby="usecases-heading">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro eyebrow="Made for storytellers" id="usecases-heading" title="For anyone whose world has outgrown their notes." />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map((u) => (
              <div key={u.who} className="wf-panel p-6">
                <u.icon className="size-5 text-gold" aria-hidden="true" />
                <h3 className="mt-3 font-medium">{u.who}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-2">{u.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-border/60 bg-bg-2 py-24" aria-labelledby="pricing-heading">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionIntro eyebrow="Pricing" id="pricing-heading" title="Start free. Grow when your world does." />
          <div className="mt-12">
            <PricingPlans />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-16 border-t border-border/60 py-24" aria-labelledby="faq-heading">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionIntro eyebrow="Questions" id="faq-heading" title="Frequently asked" center />
          <div className="mt-10 divide-y divide-border rounded-xl border border-border">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {q}
                  <span className="text-gold transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-text-2">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative isolate overflow-hidden border-t border-border/60 py-28">
        <HeroLandscape className="opacity-60" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="font-serif text-4xl font-semibold sm:text-5xl">Every character. Every kingdom. Every event.</h2>
          <p className="mt-3 text-lg text-text-2">One living universe.</p>
          <Button asChild variant="primary" size="lg" className="mt-8">
            <Link href="/signup">Start building your world <ArrowRight /></Link>
          </Button>
        </div>
      </section>
    </>
  );
}

function SectionIntro({ eyebrow, title, body, id, center }: { eyebrow: string; title: string; body?: string; id: string; center?: boolean }) {
  return (
    <div className={center ? "text-center" : "max-w-2xl"}>
      <p className="wf-eyebrow text-gold-dim">{eyebrow}</p>
      <h2 id={id} className="mt-2 font-serif text-4xl font-semibold leading-tight">{title}</h2>
      {body ? <p className="mt-3 text-text-2">{body}</p> : null}
    </div>
  );
}
