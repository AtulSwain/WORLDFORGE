import { describe, expect, it } from "vitest";
import { analyzeImpact, ImpactError } from "@/domain/impact";
import { parseSettings } from "@/domain/schemas";
import { CALENDAR } from "@/sample/ashen-crown";
import { sampleSnapshot } from "@/sample/snapshot";
import type { CalendarConfig } from "@/domain/chronology";

const opts = { settings: parseSettings({}), calendar: CALENDAR as unknown as CalendarConfig };

describe("Living World Engine impact analysis", () => {
  const report = analyzeImpact(sampleSnapshot(), "assassination", { startYear: 835, startMonth: 3, startDay: 1 }, opts);

  it("is deterministic", () => {
    const again = analyzeImpact(sampleSnapshot(), "assassination", { startYear: 835, startMonth: 3, startDay: 1 }, opts);
    expect(again).toEqual(report);
  });

  it("records the primary change and the field diff", () => {
    expect(report.fieldChanges.map((f) => f.field)).toContain("startYear");
    expect(report.modified?.startYear).toBe(835);
    expect(report.items.some((i) => i.strength === "DIRECT")).toBe(true);
  });

  it("gives every item a basis, a strength and affected records, and no numeric confidence", () => {
    expect(report.items.length).toBeGreaterThan(0);
    for (const item of report.items) {
      expect(item.basis).toBeTruthy();
      expect(["DIRECT", "LIKELY", "POSSIBLE", "QUESTION"]).toContain(item.strength);
      expect(item.title.length).toBeGreaterThan(0);
      expect(JSON.stringify(item)).not.toMatch(/confidence|probability/i);
    }
  });

  it("propagates to the victim's lifespan", () => {
    const victim = report.items.find((i) => i.affected.some((a) => a.id === "aldren") && i.suggestedChange?.patch && "endYear" in i.suggestedChange.patch);
    expect(victim?.suggestedChange?.patch.endYear).toBe(835);
  });

  it("finds contradictions the change introduces", () => {
    expect(report.newFindings.length).toBeGreaterThan(0);
  });

  it("traces dependants when the event never happens", () => {
    const cancelled = analyzeImpact(sampleSnapshot(), "assassination", { cancelled: true }, opts);
    expect(cancelled.cancelled).toBe(true);
    const ids = new Set(cancelled.items.flatMap((i) => i.affected.map((a) => a.id)));
    expect(ids.has("succession_crisis")).toBe(true);
  });

  it("respects the traversal bounds", () => {
    const shallow = analyzeImpact(sampleSnapshot(), "treaty", { cancelled: true }, { ...opts, maxDepth: 1 });
    const deep = analyzeImpact(sampleSnapshot(), "treaty", { cancelled: true }, { ...opts, maxDepth: 4 });
    expect(shallow.stats.depthLimit).toBe(1);
    expect(shallow.stats.eventsTraversed).toBeLessThanOrEqual(deep.stats.eventsTraversed);
    const capped = analyzeImpact(sampleSnapshot(), "treaty", { cancelled: true }, { ...opts, maxItems: 3 });
    expect(capped.items.length).toBeLessThanOrEqual(3);
  });

  it("does not mutate the input snapshot", () => {
    const snap = sampleSnapshot();
    const before = JSON.stringify(snap);
    analyzeImpact(snap, "assassination", { startYear: 835 }, opts);
    expect(JSON.stringify(snap)).toBe(before);
  });

  it("rejects events outside the timeline", () => {
    expect(() => analyzeImpact(sampleSnapshot(), "nope", { startYear: 1 }, opts)).toThrow(ImpactError);
  });
});
