import {
  Map, Users, Shield, Clock3, Network, BookOpen, Images, LayoutDashboard, MapPin, Gem, Shapes, Flame, GitBranch, Settings, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: (worldId: string) => string;
  label: string;
  icon: LucideIcon;
  match: string;
}

/** Primary destinations (top bar). */
export const PRIMARY_NAV: NavItem[] = [
  { href: (w) => `/worlds/${w}/atlas`, label: "Atlas", icon: Map, match: "/atlas" },
  { href: (w) => `/worlds/${w}/characters`, label: "Characters", icon: Users, match: "/characters" },
  { href: (w) => `/worlds/${w}/factions`, label: "Factions", icon: Shield, match: "/factions" },
  { href: (w) => `/worlds/${w}/timeline`, label: "Chronos", icon: Clock3, match: "/timeline" },
  { href: (w) => `/worlds/${w}/graph`, label: "Graph", icon: Network, match: "/graph" },
  { href: (w) => `/worlds/${w}/codex`, label: "Lore Codex", icon: BookOpen, match: "/codex" },
  { href: (w) => `/worlds/${w}/assets`, label: "Assets", icon: Images, match: "/assets" },
];

/** Contextual tool rail. */
export const RAIL_NAV: NavItem[] = [
  { href: (w) => `/worlds/${w}`, label: "Overview", icon: LayoutDashboard, match: "$overview" },
  { href: (w) => `/worlds/${w}/characters`, label: "Characters", icon: Users, match: "/characters" },
  { href: (w) => `/worlds/${w}/factions`, label: "Factions", icon: Shield, match: "/factions" },
  { href: (w) => `/worlds/${w}/locations`, label: "Locations", icon: MapPin, match: "/locations" },
  { href: (w) => `/worlds/${w}/artifacts`, label: "Artifacts", icon: Gem, match: "/artifacts" },
  { href: (w) => `/worlds/${w}/entities`, label: "Other entities", icon: Shapes, match: "/entities" },
  { href: (w) => `/worlds/${w}/simulator`, label: "Living World Engine", icon: Flame, match: "/simulator" },
  { href: (w) => `/worlds/${w}/branches`, label: "Alternate timelines", icon: GitBranch, match: "/branches" },
  { href: (w) => `/worlds/${w}/settings`, label: "Universe settings", icon: Settings, match: "/settings" },
];

export function isActive(pathname: string, worldId: string, item: NavItem): boolean {
  const base = `/worlds/${worldId}`;
  if (item.match === "$overview") return pathname === base;
  return pathname.startsWith(base + item.match);
}
