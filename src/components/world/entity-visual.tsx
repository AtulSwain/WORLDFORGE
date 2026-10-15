import {
  BookOpen, Castle, Crown, Diamond, Flame, Gem, Languages, MapPin, PawPrint, Shield, Sparkles, User, Users, Wrench, Church, Dna, Shapes,
  type LucideIcon,
} from "lucide-react";
import type { EntityTypeKey } from "@/domain/catalog";
import { cn } from "@/lib/utils";

export const ENTITY_ICON: Record<EntityTypeKey, LucideIcon> = {
  CHARACTER: User,
  FACTION: Shield,
  LOCATION: MapPin,
  ARTIFACT: Gem,
  SPECIES: Dna,
  CREATURE: PawPrint,
  CULTURE: Users,
  RELIGION: Church,
  LANGUAGE: Languages,
  TECHNOLOGY: Wrench,
  MAGIC_SYSTEM: Sparkles,
  CUSTOM: Shapes,
};

/** Restrained per-type tints; gold stays reserved for selection. */
export const ENTITY_TINT: Record<EntityTypeKey, string> = {
  CHARACTER: "#b7b2a6",
  FACTION: "#9aa6b8",
  LOCATION: "#7fa3a0",
  ARTIFACT: "#c29a6b",
  SPECIES: "#9fb08a",
  CREATURE: "#a68f7a",
  CULTURE: "#a99cc3",
  RELIGION: "#b8a1a1",
  LANGUAGE: "#8fa2b8",
  TECHNOLOGY: "#8f9b9e",
  MAGIC_SYSTEM: "#8d80b8",
  CUSTOM: "#9a9aa5",
};

export function EntityIcon({ type, className }: { type: EntityTypeKey; className?: string }) {
  const Icon = ENTITY_ICON[type];
  return <Icon className={cn("size-4", className)} style={{ color: ENTITY_TINT[type] }} aria-hidden="true" />;
}

export const EventIcon = Diamond;
export const LoreIcon = BookOpen;
export const UniverseIcon = Castle;
export const RulerIcon = Crown;
export const EngineIcon = Flame;
