import { describe, expect, it } from "vitest";
import { entityInputSchema, eventInputSchema, eventPatchSchema, parseSettings, relationshipInputSchema, ruleEnabled, universeCreateSchema } from "@/domain/schemas";

describe("schemas", () => {
  it("validates events, including date order and day-without-month", () => {
    expect(eventInputSchema.safeParse({ title: "Siege", startYear: 10 }).success).toBe(true);
    const backwards = eventInputSchema.safeParse({ title: "Siege", startYear: 10, endYear: 9 });
    expect(backwards.success).toBe(false);
    const dayOnly = eventInputSchema.safeParse({ title: "Siege", startYear: 10, startDay: 3 });
    expect(dayOnly.success).toBe(false);
    expect(eventInputSchema.safeParse({ title: "", startYear: 10 }).success).toBe(false);
  });

  it("keeps engine patches free of defaults and rejects unknown keys", () => {
    expect(eventPatchSchema.parse({ startYear: 835 })).toEqual({ startYear: 835 });
    expect(eventPatchSchema.safeParse({}).success).toBe(false);
    expect(eventPatchSchema.safeParse({ startYear: 835, ownerId: "x" }).success).toBe(false);
  });

  it("validates entities and their type-specific attributes", () => {
    expect(entityInputSchema.safeParse({ type: "CHARACTER", name: "Seren" }).success).toBe(true);
    expect(entityInputSchema.safeParse({ type: "CHARACTER", name: "Seren", beginYear: 900, endYear: 800 }).success).toBe(false);
    expect(entityInputSchema.safeParse({ type: "DRAGON", name: "x" }).success).toBe(false);
  });

  it("requires UPPER_SNAKE relationship types and ordered validity", () => {
    expect(relationshipInputSchema.safeParse({ sourceId: "a", targetId: "b", type: "ALLY_OF" }).success).toBe(true);
    expect(relationshipInputSchema.safeParse({ sourceId: "a", targetId: "b", type: "ally of" }).success).toBe(false);
    expect(relationshipInputSchema.safeParse({ sourceId: "a", targetId: "b", type: "ALLY_OF", validFromYear: 5, validToYear: 2 }).success).toBe(false);
  });

  it("parses settings with safe defaults", () => {
    const s = parseSettings(null);
    expect(s.aiEnabled).toBe(true);
    expect(ruleEnabled(s, "TRAVEL_CONFLICT")).toBe(true);
    expect(ruleEnabled(parseSettings({ rules: { TRAVEL_CONFLICT: false } }), "TRAVEL_CONFLICT")).toBe(false);
    expect(parseSettings({ minTravelDays: "lots" }).minTravelDays).toBe(0);
  });

  it("requires a universe name", () => {
    expect(universeCreateSchema.safeParse({ name: "A", genre: "HIGH_FANTASY" }).success).toBe(false);
    expect(universeCreateSchema.safeParse({ name: "Aster", genre: "HIGH_FANTASY" }).success).toBe(true);
  });
});
