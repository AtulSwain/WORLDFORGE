/** Generic, bounded graph algorithms. No unbounded recursion: all traversals are iterative and capped. */

export interface Edge {
  source: string;
  target: string;
}

export function buildAdjacency(edges: Edge[], undirected = false): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  const add = (a: string, b: string) => {
    const list = adj.get(a);
    if (list) list.push(b);
    else adj.set(a, [b]);
  };
  for (const e of edges) {
    add(e.source, e.target);
    if (undirected) add(e.target, e.source);
  }
  return adj;
}

/**
 * Would adding `source → target` create a cycle? Returns the existing path target → … → source
 * (which the new edge would close), or null.
 */
export function findCycleIfAdded(edges: Edge[], source: string, target: string, maxNodes = 10_000): string[] | null {
  if (source === target) return [source];
  const adj = buildAdjacency(edges);
  const parent = new Map<string, string | null>([[target, null]]);
  const queue = [target];
  while (queue.length && parent.size <= maxNodes) {
    const node = queue.shift()!;
    if (node === source) {
      const path: string[] = [];
      let cur: string | null = node;
      while (cur !== null) {
        path.unshift(cur);
        cur = parent.get(cur) ?? null;
      }
      return path;
    }
    for (const next of adj.get(node) ?? []) {
      if (!parent.has(next)) {
        parent.set(next, node);
        queue.push(next);
      }
    }
  }
  return null;
}

/** Strongly connected components with more than one node (or self-loops) — i.e. cycles. Iterative Tarjan. */
export function findCycles(nodes: string[], edges: Edge[]): string[][] {
  const adj = buildAdjacency(edges);
  let index = 0;
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const result: string[][] = [];
  const selfLoops = new Set(edges.filter((e) => e.source === e.target).map((e) => e.source));

  for (const root of nodes) {
    if (indices.has(root)) continue;
    const work: { node: string; i: number }[] = [{ node: root, i: 0 }];
    indices.set(root, index);
    lowlink.set(root, index);
    index++;
    stack.push(root);
    onStack.add(root);

    while (work.length) {
      const frame = work[work.length - 1];
      const neighbors = adj.get(frame.node) ?? [];
      if (frame.i < neighbors.length) {
        const next = neighbors[frame.i++];
        if (!indices.has(next)) {
          indices.set(next, index);
          lowlink.set(next, index);
          index++;
          stack.push(next);
          onStack.add(next);
          work.push({ node: next, i: 0 });
        } else if (onStack.has(next)) {
          lowlink.set(frame.node, Math.min(lowlink.get(frame.node)!, indices.get(next)!));
        }
      } else {
        work.pop();
        if (work.length) {
          const parent = work[work.length - 1].node;
          lowlink.set(parent, Math.min(lowlink.get(parent)!, lowlink.get(frame.node)!));
        }
        if (lowlink.get(frame.node) === indices.get(frame.node)) {
          const component: string[] = [];
          let w: string;
          do {
            w = stack.pop()!;
            onStack.delete(w);
            component.push(w);
          } while (w !== frame.node);
          if (component.length > 1 || selfLoops.has(frame.node)) result.push(component.reverse());
        }
      }
    }
  }
  return result;
}

export interface TraversalResult {
  /** node → depth (start nodes have depth 0) */
  depth: Map<string, number>;
  /** node → predecessor on the shortest discovered path */
  parent: Map<string, string | null>;
  truncated: boolean;
}

/** Breadth-first traversal bounded by depth and node count. */
export function boundedBfs(
  starts: string[],
  neighbors: (node: string) => string[],
  maxDepth: number,
  maxNodes = 500,
): TraversalResult {
  const depth = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const queue: string[] = [];
  for (const s of starts) {
    depth.set(s, 0);
    parent.set(s, null);
    queue.push(s);
  }
  let truncated = false;
  while (queue.length) {
    const node = queue.shift()!;
    const d = depth.get(node)!;
    if (d >= maxDepth) continue;
    for (const next of neighbors(node)) {
      if (depth.has(next)) continue;
      if (depth.size >= maxNodes) {
        truncated = true;
        break;
      }
      depth.set(next, d + 1);
      parent.set(next, node);
      queue.push(next);
    }
  }
  return { depth, parent, truncated };
}

export function pathTo(parent: Map<string, string | null>, node: string): string[] {
  const path: string[] = [];
  let cur: string | null | undefined = node;
  let guard = 0;
  while (cur != null && guard++ < 10_000) {
    path.unshift(cur);
    cur = parent.get(cur);
  }
  return path;
}

/** Shortest undirected path between two nodes, bounded by depth. Returns node ids or null. */
export function shortestPath(edges: Edge[], from: string, to: string, maxDepth = 6): string[] | null {
  if (from === to) return [from];
  const adj = buildAdjacency(edges, true);
  const result = boundedBfs([from], (n) => adj.get(n) ?? [], maxDepth, 50_000);
  if (!result.depth.has(to)) return null;
  return pathTo(result.parent, to);
}
