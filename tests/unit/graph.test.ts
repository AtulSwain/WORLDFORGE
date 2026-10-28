import { describe, expect, it } from "vitest";
import { boundedBfs, buildAdjacency, findCycleIfAdded, findCycles, shortestPath } from "@/domain/graph";

const chain = [
  { source: "a", target: "b" },
  { source: "b", target: "c" },
  { source: "c", target: "d" },
];

describe("graph", () => {
  it("detects a cycle that a new edge would create", () => {
    expect(findCycleIfAdded(chain, "d", "a")).toEqual(["a", "b", "c", "d"].length ? expect.arrayContaining(["a", "b", "c", "d"]) : null);
    expect(findCycleIfAdded(chain, "a", "d")).toBeNull();
    expect(findCycleIfAdded(chain, "x", "x")).not.toBeNull();
  });

  it("finds strongly connected cycles", () => {
    const cycles = findCycles(["a", "b", "c", "d"], [...chain, { source: "c", target: "a" }]);
    expect(cycles).toHaveLength(1);
    expect(new Set(cycles[0])).toEqual(new Set(["a", "b", "c"]));
    expect(findCycles(["a", "b", "c", "d"], chain)).toEqual([]);
  });

  it("bounds traversal by depth and node count", () => {
    const adj = buildAdjacency(chain);
    const shallow = boundedBfs(["a"], (n) => adj.get(n) ?? [], 2);
    expect([...shallow.depth.keys()]).toEqual(["a", "b", "c"]);
    expect(shallow.truncated).toBe(false);
    const capped = boundedBfs(["a"], (n) => adj.get(n) ?? [], 10, 2);
    expect(capped.depth.size).toBe(2);
    expect(capped.truncated).toBe(true);
  });

  it("finds the shortest undirected path", () => {
    expect(shortestPath(chain, "d", "a")).toEqual(["d", "c", "b", "a"]);
    expect(shortestPath(chain, "a", "z")).toBeNull();
    expect(shortestPath(chain, "a", "d", 2)).toBeNull();
  });
});
