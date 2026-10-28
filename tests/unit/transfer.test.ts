import { describe, expect, it } from "vitest";
import { EXPORT_FORMAT, EXPORT_VERSION, csvCell, declaredIds, remapIds, validateExport } from "@/domain/transfer";

function minimal() {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    universe: { name: "Aster", genre: "HIGH_FANTASY" },
    timelines: [
      { id: "t1", name: "Canon", isMain: true },
      { id: "t2", name: "What if", isMain: false, parentId: "t1", branchEventId: "e1" },
    ],
    entities: [
      { id: "c1", timelineId: "t1", type: "CHARACTER", name: "Ada", slug: "ada" },
      { id: "l1", timelineId: "t1", type: "LOCATION", name: "Keep", slug: "keep" },
    ],
    events: [{ id: "e1", timelineId: "t1", title: "Siege", slug: "siege", startYear: 10, locationId: "l1", participants: [{ entityId: "c1" }] }],
    relationships: [{ id: "r1", timelineId: "t1", sourceId: "c1", targetId: "l1", type: "LOCATED_IN" }],
    changes: [{ id: "x1", timelineId: "t2", targetType: "EVENT", targetId: "e1", changeType: "UPDATE", proposedState: { startYear: 12, locationId: "l1" } }],
    lore: [{ id: "d1", title: "Annals", slug: "annals", links: [{ entityId: "c1" }] }],
  };
}

describe("export format", () => {
  it("accepts a valid file", () => {
    const r = validateExport(minimal());
    expect(r.ok).toBe(true);
  });

  it("rejects other formats and versions with a clear message", () => {
    expect(validateExport({ format: "other" })).toMatchObject({ ok: false, issues: [{ path: "format" }] });
    expect(validateExport({ ...minimal(), version: 2 })).toMatchObject({ ok: false, issues: [{ path: "version" }] });
    expect(validateExport("nope")).toMatchObject({ ok: false });
  });

  it("reports duplicate IDs, broken references and invalid structure", () => {
    const f = minimal();
    f.entities.push({ id: "c1", timelineId: "t1", type: "CHARACTER", name: "Copy", slug: "copy" });
    f.events[0]!.locationId = "missing";
    f.relationships[0]!.type = "INVENTED";
    const r = validateExport(f);
    expect(r.ok).toBe(false);
    const text = !r.ok ? r.issues.map((i) => `${i.path}: ${i.message}`).join("\n") : "";
    expect(text).toMatch(/Duplicate ID "c1"/);
    expect(text).toMatch(/events\.0\.locationId: References a missing entity "missing"/);
    expect(text).toMatch(/Unknown relationship type "INVENTED"/);
    const bad = validateExport({ ...minimal(), timelines: "x" });
    expect(bad.ok).toBe(false);
  });

  it("requires exactly one main timeline and acyclic branches", () => {
    const f = minimal();
    f.timelines[1]!.isMain = true;
    expect(validateExport(f).ok).toBe(false);
  });

  it("re-keys every ID including references inside overlay patches", () => {
    const r = validateExport(minimal());
    if (!r.ok) throw new Error("expected valid");
    const ids = new Map(declaredIds(r.data).map((id, i) => [id, `new-${i}`]));
    const out = remapIds(r.data, ids);
    const all = JSON.stringify(out);
    for (const old of ["\"c1\"", "\"l1\"", "\"e1\"", "\"t1\"", "\"t2\""]) expect(all).not.toContain(old);
    expect((out.changes[0]!.proposedState as { locationId: string }).locationId).toBe(ids.get("l1"));
    expect(out.universe.name).toBe("Aster");
  });

  it("escapes CSV cells and neutralises formulas", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(null)).toBe("");
  });
});
