import { ArrowRight, GitBranch, TriangleAlert } from "lucide-react";
import { BUILTIN_RELATIONSHIP_TYPES, ENTITY_TYPE_META, type EntityTypeKey } from "@/domain/catalog";
import { formatEventDate, type CalendarConfig } from "@/domain/chronology";
import { analyzeImpact, BASIS_LABELS, IMPACT_CATEGORY_LABELS, type ImpactCategory } from "@/domain/impact";
import { parseSettings } from "@/domain/schemas";
import { CALENDAR, ENTITIES, EVENTS, PROPOSAL, RELATIONSHIPS, UNIVERSE, LORE } from "@/sample/ashen-crown";
import { sampleSnapshot } from "@/sample/snapshot";
import { ENTITY_ICON, ENTITY_TINT } from "@/components/world/entity-visual";
import { Badge } from "@/components/ui/badge";

/**
 * Landing-page previews rendered from the real sample universe with the real domain code:
 * the impact panel below is the Living World Engine's actual output for a seeded proposal.
 */

const cal = CALENDAR as CalendarConfig;

function Chrome({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-bg-2 shadow-pop">
      <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <span className="size-2.5 rounded-full bg-surface-3" />
        <span className="size-2.5 rounded-full bg-surface-3" />
        <span className="size-2.5 rounded-full bg-surface-3" />
        <span className="ml-2 truncate text-xs text-muted">{title}</span>
      </div>
      {children}
    </div>
  );
}

export function OverviewPreview() {
  const count = (t: string) => ENTITIES.filter((e) => e.type === t).length;
  const recent = [...EVENTS].sort((a, b) => b.start[0] - a.start[0]).slice(0, 4);
  return (
    <Chrome title="The Ashen Crown — Overview">
      <div className="relative h-28 overflow-hidden border-b border-border bg-[url('/art/ashen-crown-cover.svg')] bg-cover bg-center">
        <div className="absolute inset-0 bg-gradient-to-t from-bg-2 to-transparent" />
        <div className="absolute bottom-3 left-4">
          <div className="wf-eyebrow">High fantasy · {UNIVERSE.currentEra}</div>
          <div className="font-serif text-2xl font-semibold">{UNIVERSE.name}</div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1 border-b border-border p-2 text-center">
        {[["Characters", count("CHARACTER")], ["Factions", count("FACTION")], ["Locations", count("LOCATION")], ["Events", EVENTS.length]].map(([l, v]) => (
          <div key={l} className="py-1.5">
            <div className="font-serif text-xl font-semibold">{v}</div>
            <div className="text-2xs text-muted">{l}</div>
          </div>
        ))}
      </div>
      <ul className="divide-y divide-border/60 text-sm">
        {recent.map((e) => (
          <li key={e.key} className="flex items-center justify-between gap-3 px-4 py-2">
            <span className="truncate">{e.title}</span>
            <span className="shrink-0 text-xs text-muted">{formatEventDate({ startYear: e.start[0], startMonth: e.start[1], startDay: e.start[2], precision: e.precision }, cal)}</span>
          </li>
        ))}
      </ul>
    </Chrome>
  );
}

export function GraphPreview() {
  const focus = "aldren";
  const rels = RELATIONSHIPS.filter((r) => r.source === focus || r.target === focus).slice(0, 10);
  const others = rels.map((r) => (r.source === focus ? r.target : r.source));
  const W = 560;
  const H = 340;
  const cx = W / 2;
  const cy = H / 2;
  const pos = new Map<string, { x: number; y: number }>([[focus, { x: cx, y: cy }]]);
  others.forEach((k, i) => {
    const a = (i / others.length) * Math.PI * 2 - Math.PI / 2;
    pos.set(k, { x: cx + Math.cos(a) * 205, y: cy + Math.sin(a) * 125 });
  });
  const byKey = new Map(ENTITIES.map((e) => [e.key, e]));
  return (
    <Chrome title="Relationship Graph — focused on Aldren Caldris">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Relationship graph preview showing Aldren Caldris and his connections">
        <defs>
          <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#30313A" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#dots)" />
        {rels.map((r, i) => {
          const a = pos.get(r.source)!;
          const b = pos.get(r.target)!;
          const label = BUILTIN_RELATIONSHIP_TYPES[r.type as keyof typeof BUILTIN_RELATIONSHIP_TYPES]?.label ?? r.type;
          const highlight = r.type === "RULES" || r.type === "BETRAYS";
          return (
            <g key={i}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={highlight ? "#D6BD8D" : "#4a4b57"} strokeWidth={highlight ? 1.6 : 1} strokeOpacity={highlight ? 0.8 : 1} />
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} textAnchor="middle" fontSize="9" fill="#737581">
                {label}
              </text>
            </g>
          );
        })}
        {[...pos.entries()].map(([k, p]) => {
          const e = byKey.get(k)!;
          const selected = k === focus;
          const tint = ENTITY_TINT[e.type as EntityTypeKey];
          const shape =
            e.type === "FACTION" ? (
              <path d={`M${p.x - 13} ${p.y - 14} h26 v10 c0 10 -7 16 -13 19 c-6 -3 -13 -9 -13 -19 z`} fill="#1C1D24" stroke={selected ? "#D6BD8D" : tint} strokeWidth="1.5" />
            ) : e.type === "LOCATION" ? (
              <rect x={p.x - 12} y={p.y - 12} width="24" height="24" rx="5" fill="#1C1D24" stroke={tint} strokeWidth="1.5" />
            ) : (
              <circle cx={p.x} cy={p.y} r={selected ? 19 : 15} fill="#1C1D24" stroke={selected ? "#D6BD8D" : tint} strokeWidth={selected ? 2 : 1.5} />
            );
          return (
            <g key={k}>
              {selected ? <circle cx={p.x} cy={p.y} r="27" fill="none" stroke="#D6BD8D" strokeOpacity="0.25" /> : null}
              {shape}
              <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="10" fontWeight="600" fill={selected ? "#D6BD8D" : "#F1EEE7"}>
                {e.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
              </text>
              <text x={p.x} y={p.y + (selected ? 34 : 29)} textAnchor="middle" fontSize="10" fill="#A4A5AF">
                {e.name}
              </text>
            </g>
          );
        })}
      </svg>
    </Chrome>
  );
}

export function TimelinePreview() {
  const shown = EVENTS.filter((e) => e.start[0] >= 836);
  const min = 835;
  const max = 859;
  const W = 560;
  const x = (y: number) => 24 + ((y - min) / (max - min)) * (W - 48);
  const lanes: number[] = [];
  const placed = shown.map((e) => {
    const sx = x(e.start[0] + ((e.start[1] ?? 1) - 1) / 12);
    let lane = lanes.findIndex((end) => end < sx - 6);
    if (lane === -1) {
      lane = lanes.length;
      lanes.push(0);
    }
    const ex = e.end ? x(e.end[0] + ((e.end[1] ?? 12) - 1) / 12) : sx;
    lanes[lane] = Math.max(ex, sx + 70);
    return { e, sx, ex, lane };
  });
  return (
    <Chrome title="Chronos — Prime Canon, Years 835–859 AC">
      <svg viewBox={`0 0 ${W} 300`} className="block w-full" role="img" aria-label="Timeline preview of the Concord Years and the War of the Ashen Crown">
        <rect x={x(842)} y="0" width={x(853) - x(842)} height="300" fill="#D6BD8D" opacity="0.04" />
        <text x={x(842) + 6} y="16" fontSize="9" fill="#8f7e5c" letterSpacing="1.5">CONCORD YEARS</text>
        <rect x={x(853)} y="0" width={x(859) - x(853)} height="300" fill="#C46A6A" opacity="0.05" />
        <text x={x(853) + 6} y="16" fontSize="9" fill="#a26a6a" letterSpacing="1.5">WAR OF THE ASHEN CROWN</text>
        <line x1="24" y1="272" x2={W - 24} y2="272" stroke="#30313A" />
        {Array.from({ length: (max - min) / 3 + 1 }, (_, i) => min + i * 3).map((y) => (
          <g key={y}>
            <line x1={x(y)} y1="268" x2={x(y)} y2="276" stroke="#3d3e49" />
            <text x={x(y)} y="290" fontSize="9" textAnchor="middle" fill="#737581">{y}</text>
          </g>
        ))}
        {placed.slice(0, 16).map(({ e, sx, ex, lane }) => {
          const y = 34 + lane * 30;
          if (y > 250) return null;
          const key = e.importance >= 5;
          return (
            <g key={e.key}>
              {ex > sx + 2 ? <rect x={sx} y={y - 3} width={ex - sx} height="6" rx="3" fill={key ? "#D6BD8D" : "#4a4b57"} opacity={key ? 0.35 : 0.6} /> : null}
              <rect x={sx - 5} y={y - 5} width="10" height="10" transform={`rotate(45 ${sx} ${y})`} fill={key ? "#D6BD8D" : "#A4A5AF"} />
              <text x={sx + 10} y={y + 3.5} fontSize="10" fill="#F1EEE7">{e.title}</text>
            </g>
          );
        })}
      </svg>
    </Chrome>
  );
}

export function ImpactPreview() {
  const report = analyzeImpact(sampleSnapshot(), PROPOSAL.event, PROPOSAL.patch, { settings: parseSettings({ minTravelDays: 3 }), calendar: cal });
  const groups = new Map<ImpactCategory, typeof report.items>();
  for (const item of report.items) groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
  const order: ImpactCategory[] = ["CONTRADICTION", "POLITICAL", "CHARACTER", "DEPENDENT_EVENT", "NARRATIVE"];
  return (
    <Chrome title="Living World Engine — impact report">
      <div className="border-b border-border p-4">
        <div className="wf-eyebrow">Proposed change</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Assassination of King Aldren</span>
          <span className="text-muted line-through">Year 851 AC</span>
          <ArrowRight className="size-3.5 text-gold" />
          <span className="text-gold">Year 835 AC</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-text-2">
          <span>{report.items.length} proposed impacts</span>
          <span>{report.newFindings.length} new contradictions</span>
          <span>{report.stats.eventsTraversed - 1} dependent events traversed</span>
        </div>
      </div>
      <div className="max-h-72 space-y-4 overflow-hidden p-4">
        {order.map((cat) => {
          const items = groups.get(cat);
          if (!items?.length) return null;
          return (
            <div key={cat}>
              <div className="wf-eyebrow mb-1.5 flex items-center gap-1.5">
                {cat === "CONTRADICTION" ? <TriangleAlert className="size-3 text-warning" /> : null}
                {IMPACT_CATEGORY_LABELS[cat]}
              </div>
              <ul className="space-y-1.5">
                {items.slice(0, 2).map((i) => (
                  <li key={i.key} className="flex items-start justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
                    <span className="text-[13px] leading-snug">{i.title}</span>
                    <Badge tone={i.basis === "DETERMINISTIC_RULE" ? "gold" : i.basis === "EXPLICIT_DEPENDENCY" ? "violet" : "neutral"}>{BASIS_LABELS[i.basis]}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted">
        <span className="flex items-center gap-1.5"><GitBranch className="size-3.5" /> Commit to a new branch — canon stays untouched</span>
        <span className="text-gold">Review →</span>
      </div>
    </Chrome>
  );
}

export function SampleUniverseFacts() {
  const counts = {
    characters: ENTITIES.filter((e) => e.type === "CHARACTER").length,
    factions: ENTITIES.filter((e) => e.type === "FACTION").length,
    locations: ENTITIES.filter((e) => e.type === "LOCATION").length,
    events: EVENTS.length,
    relationships: RELATIONSHIPS.length,
    lore: LORE.length,
  };
  return counts;
}

export function FactionChips() {
  return (
    <div className="flex flex-wrap gap-2">
      {ENTITIES.filter((e) => e.type === "FACTION").map((f) => {
        const Icon = ENTITY_ICON.FACTION;
        return (
          <span key={f.key} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-2">
            <Icon className="size-3.5" style={{ color: ENTITY_TINT.FACTION }} /> {f.name}
          </span>
        );
      })}
      <span className="sr-only">{ENTITY_TYPE_META.FACTION.plural}</span>
    </div>
  );
}
