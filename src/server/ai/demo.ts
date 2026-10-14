import type { AiKind } from "./schemas";

/**
 * Deterministic demo fixtures (AI_PROVIDER=demo). The UI labels every result produced in
 * demo mode as sample output so it is never mistaken for real generation.
 */
export function demoOutput(kind: AiKind, prompt: string): unknown {
  const ids = [...prompt.matchAll(/\[id:([A-Za-z0-9_-]{6,64})\]/g)].map((m) => m[1]!);
  switch (kind) {
    case "CHARACTER_TRAITS":
      return {
        personality: "Measured and watchful in public; privately restless, prone to second-guessing decisions already made.",
        strengths: ["Reads people quickly", "Keeps promises"],
        flaws: ["Holds grudges", "Distrusts help"],
        values: ["Loyalty", "Craft"],
        fears: ["Being remembered for a single failure"],
      };
    case "CHARACTER_BACKSTORY":
      return { backstory: "(Demo sample) Raised on the margins of a great house, they learned early that silence was safer than truth. A single act of defiance in youth still shapes how others see them." };
    case "CHARACTER_MOTIVATIONS":
      return { motivations: ["Earn a place no one can take away", "Protect the one person who believed in them"], goals: "(Demo sample) Secure a position of influence before the coming succession." };
    case "CHARACTER_CONTRADICTIONS":
      return { issues: [{ title: "(Demo sample) Unclear allegiance", explanation: "The biography describes unwavering loyalty, but recorded relationships include a rivalry with a member of the same faction.", references: ids.slice(0, 2) }] };
    case "CHARACTER_RELATIONSHIPS":
      return { suggestions: ids.slice(1, 3).map((id) => ({ targetId: id, type: "RIVAL_OF", description: "(Demo sample) A quiet rivalry over shared ambitions.", reasoning: "Both seek influence in the same circles." })) };
    case "WORLD_OUTLINE":
      return {
        summary: "(Demo sample) A riverland of feuding city-states, held together by a fading oath sworn at a drowned temple.",
        factions: [{ name: "The Oathbound", summary: "Keepers of the old river oath." }, { name: "House Varel", summary: "Merchant princes who profit from every flood." }],
        characters: [{ name: "Ilsabet Varel", summary: "Heir who doubts the oath.", faction: "House Varel" }, { name: "Brother Tam", summary: "Oathkeeper with a secret debt.", faction: "The Oathbound" }],
        locations: [{ name: "The Drowned Temple", summary: "Where the oath was first sworn." }],
        events: [{ title: "Swearing of the River Oath", year: 1, description: "The founding pact between the river cities." }, { title: "The Great Flood", year: 212, description: "A disaster that tests the oath." }],
      };
    case "IMPACT_SUGGESTIONS":
      return {
        impacts: [
          { title: "(Demo sample) Rumours of foul play spread", description: "Courtiers may whisper that the change was engineered by a rival faction.", category: "POLITICAL", affectedIds: ids.slice(0, 1), reasoning: "Sudden changes in succession often breed suspicion." },
        ],
      };
  }
}
