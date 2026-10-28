import { describe, expect, it } from "vitest";
import { checkConsistency, validateRelationshipCandidate } from "@/domain/consistency";
import { parseSettings } from "@/domain/schemas";
import { sampleSnapshot } from "@/sample/snapshot";
import { entity, event, world } from "../helpers/world";

const settings = parseSettings({});
const rules = (snapshot: Parameters<typeof checkConsistency>[0], s = settings) => checkConsistency(snapshot, s).map((f) => f.rule);

describe("consistency", () => {
  it("flags an event that ends before it starts", () => {
    expect(rules(world({ events: [event("e", [10], { end: [9] })] }))).toContain("EVENT_ENDS_BEFORE_START");
  });

  it("flags a prerequisite dated after the event it causes", () => {
    const w = world({
      events: [event("cause", [20]), event("effect", [10])],
      dependencies: [{ id: "d", sourceId: "cause", targetId: "effect", type: "CAUSES", timelineId: "main" }],
    });
    expect(rules(w)).toContain("PREREQUISITE_AFTER_EVENT");
  });

  it("flags participants who are dead or not yet born", () => {
    const w = world({
      entities: [entity("ghost", { beginYear: 1, endYear: 5 }), entity("babe", { beginYear: 50 })],
      events: [event("feast", [20])],
      participants: [
        { eventId: "feast", entityId: "ghost", role: "PARTICIPANT" },
        { eventId: "feast", entityId: "babe", role: "PARTICIPANT" },
      ],
    });
    expect(rules(w)).toEqual(expect.arrayContaining(["PARTICIPANT_DEAD", "PARTICIPANT_NOT_BORN"]));
  });

  it("does not flag a victim dying in the event that ends their life", () => {
    const w = world({
      entities: [entity("king", { beginYear: 1, endYear: 20 })],
      events: [event("murder", [20, 5, 1], { eventType: "ASSASSINATION" })],
      participants: [{ eventId: "murder", entityId: "king", role: "VICTIM" }],
    });
    expect(rules(w)).not.toContain("PARTICIPANT_DEAD");
  });

  it("flags circular dependencies", () => {
    const w = world({
      events: [event("a", [1]), event("b", [1])],
      dependencies: [
        { id: "d1", sourceId: "a", targetId: "b", type: "ENABLES", timelineId: "main" },
        { id: "d2", sourceId: "b", targetId: "a", type: "ENABLES", timelineId: "main" },
      ],
    });
    expect(rules(w)).toContain("DEPENDENCY_CYCLE");
  });

  it("flags a character in two places on the same day", () => {
    const w = world({
      entities: [entity("spy"), entity("north", { type: "LOCATION" }), entity("south", { type: "LOCATION" })],
      events: [event("x", [10, 1, 1], { locationId: "north" }), event("y", [10, 1, 1], { locationId: "south" })],
      participants: [
        { eventId: "x", entityId: "spy", role: "PARTICIPANT" },
        { eventId: "y", entityId: "spy", role: "PARTICIPANT" },
      ],
    });
    expect(rules(w)).toContain("TRAVEL_CONFLICT");
    expect(rules(w, parseSettings({ rules: { TRAVEL_CONFLICT: false } }))).not.toContain("TRAVEL_CONFLICT");
  });

  it("is deterministic and finds exactly the contradiction seeded in the sample canon", () => {
    const snap = sampleSnapshot();
    const a = checkConsistency(snap, settings);
    const b = checkConsistency(sampleSnapshot(), settings);
    expect(a).toEqual(b);
    // The sample deliberately records Hesper Quill signing the Truce after her death.
    expect(a.filter((f) => f.severity === "ERROR").map((f) => f.key)).toEqual(["PARTICIPANT_DEAD:truce:hesper"]);
  });

  it("validates relationship candidates", () => {
    const king = { id: "k", type: "CHARACTER", name: "King" };
    const realm = { id: "r", type: "FACTION", name: "Realm" };
    expect(validateRelationshipCandidate({ sourceId: "k", targetId: "k", type: "ALLY_OF" }, king, king, [])).not.toEqual([]);
    expect(validateRelationshipCandidate({ sourceId: "k", targetId: "r", type: "RULES" }, king, realm, [])).toEqual([]);
    expect(validateRelationshipCandidate({ sourceId: "r", targetId: "k", type: "RULES" }, realm, king, []).join(" ")).toMatch(/cannot point to a character/);
    expect(validateRelationshipCandidate({ sourceId: "k", targetId: "r", type: "RULES" }, king, undefined, [])).not.toEqual([]);
  });
});
