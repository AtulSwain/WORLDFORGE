import { describe, expect, it } from "vitest";
import { CAPABILITIES, can } from "@/domain/permissions";

describe("permissions", () => {
  it("gives owners every capability", () => {
    for (const c of CAPABILITIES) expect(can("OWNER", c)).toBe(true);
  });
  it("lets editors write, branch, use AI and export but not administer", () => {
    expect(can("EDITOR", "content:write")).toBe(true);
    expect(can("EDITOR", "timeline:branch")).toBe(true);
    expect(can("EDITOR", "ai:use")).toBe(true);
    expect(can("EDITOR", "export")).toBe(true);
    expect(can("EDITOR", "universe:settings")).toBe(false);
    expect(can("EDITOR", "members:manage")).toBe(false);
    expect(can("EDITOR", "universe:delete")).toBe(false);
  });
  it("limits viewers to reading", () => {
    expect(CAPABILITIES.filter((c) => can("VIEWER", c))).toEqual(["universe:read"]);
  });
  it("denies non-members everything", () => {
    for (const c of CAPABILITIES) expect(can(null, c)).toBe(false);
  });
});
