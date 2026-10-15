import { describe, expect, it } from "vitest";
import { ancestorChain, diffSnapshots, resolveSnapshot, type Overlay } from "@/domain/timeline-resolution";
import { entity, event, world } from "../helpers/world";

const timelines = [
  { id: "main", parentId: null },
  { id: "alt", parentId: "main" },
  { id: "alt2", parentId: "alt" },
];

const base = world({
  entities: [entity("king", { beginYear: 800, endYear: 851 }), entity("rival"), entity("alt-only", { timelineId: "alt" })],
  events: [event("murder", [851, 11, 3]), event("crisis", [851, 12])],
  relationships: [
    { id: "r1", sourceId: "king", targetId: "rival", type: "ENEMY_OF", validFromYear: null, validToYear: null, originEventId: null, endEventId: null, canonStatus: "CANON", timelineId: "main", version: 1 },
  ],
  participants: [{ eventId: "murder", entityId: "king", role: "VICTIM" }],
  dependencies: [{ id: "d1", sourceId: "murder", targetId: "crisis", type: "CAUSES", timelineId: "main" }],
});

const overlay = (o: Partial<Overlay> & Pick<Overlay, "id" | "timelineId" | "targetId">): Overlay => ({
  targetType: "EVENT", changeType: "UPDATE", proposedState: {}, createdAt: "2026-01-01T00:00:00Z", ...o,
});

describe("timeline resolution", () => {
  it("builds the ancestor chain root-first and survives cycles", () => {
    expect(ancestorChain(timelines, "alt2")).toEqual(["main", "alt", "alt2"]);
    expect(ancestorChain([{ id: "a", parentId: "b" }, { id: "b", parentId: "a" }], "a")).toEqual(["b", "a"]);
  });

  it("shows canon unchanged when resolving the main timeline", () => {
    const overlays = [overlay({ id: "c1", timelineId: "alt", targetId: "murder", proposedState: { startYear: 835 } })];
    const main = resolveSnapshot(base, ["main"], overlays);
    expect(main.events.find((e) => e.id === "murder")!.startYear).toBe(851);
    expect(main.entities.map((e) => e.id)).not.toContain("alt-only");
    expect(main.overridden.size).toBe(0);
  });

  it("applies branch overlays and recomputes ordinals", () => {
    const overlays = [overlay({ id: "c1", timelineId: "alt", targetId: "murder", proposedState: { startYear: 835 } })];
    const alt = resolveSnapshot(base, ["main", "alt"], overlays);
    const murder = alt.events.find((e) => e.id === "murder")!;
    expect(murder.startYear).toBe(835);
    expect(murder.startOrdinal).toBe(835 * 1000 + 10 * 40 + 2);
    expect(alt.overridden.get("murder")?.timelineId).toBe("alt");
    expect(alt.entities.map((e) => e.id)).toContain("alt-only");
    // Base snapshot objects are never mutated.
    expect(base.events[0]!.startYear).toBe(851);
  });

  it("lets descendants inherit and further override", () => {
    const overlays = [
      overlay({ id: "c1", timelineId: "alt", targetId: "murder", proposedState: { startYear: 835 } }),
      overlay({ id: "c2", timelineId: "alt2", targetId: "murder", proposedState: { startYear: 840 }, createdAt: "2025-01-01T00:00:00Z" }),
    ];
    expect(resolveSnapshot(base, ["main", "alt2"].slice(0, 1).concat(["alt", "alt2"]), overlays).events.find((e) => e.id === "murder")!.startYear).toBe(840);
    expect(resolveSnapshot(base, ["main", "alt"], overlays).events.find((e) => e.id === "murder")!.startYear).toBe(835);
  });

  it("removes tombstoned records and their dangling links", () => {
    const overlays = [overlay({ id: "c1", timelineId: "alt", targetType: "ENTITY", targetId: "king", changeType: "DELETE", proposedState: null })];
    const alt = resolveSnapshot(base, ["main", "alt"], overlays);
    expect(alt.removed.has("king")).toBe(true);
    expect(alt.relationships).toHaveLength(0);
    expect(alt.participants).toHaveLength(0);
  });

  it("ignores patch keys that are not record fields", () => {
    const overlays = [overlay({ id: "c1", timelineId: "alt", targetId: "murder", proposedState: { startYear: 835, ownerId: "attacker" } })];
    const murder = resolveSnapshot(base, ["main", "alt"], overlays).events.find((e) => e.id === "murder")!;
    expect("ownerId" in murder).toBe(false);
  });

  it("diffs a branch against its parent", () => {
    const overlays = [overlay({ id: "c1", timelineId: "alt", targetId: "murder", proposedState: { startYear: 835 } })];
    const diffs = diffSnapshots(resolveSnapshot(base, ["main"], overlays), resolveSnapshot(base, ["main", "alt"], overlays));
    const murder = diffs.find((d) => d.id === "murder");
    expect(murder).toBeDefined();
    expect(JSON.stringify(murder)).toContain("835");
  });
});
