/**
 * Deterministic Fruchterman–Reingold layout (repulsion k²/d, attraction d²/k, cooling).
 * Graphs are bounded (≤ 300 nodes) so the O(n²) repulsion stays fast.
 */
export interface LayoutNode {
  id: string;
  x?: number;
  y?: number;
  fixed?: boolean;
}

export function forceLayout(
  nodes: LayoutNode[],
  edges: { source: string; target: string }[],
  opts: { iterations?: number; k?: number; center?: { x: number; y: number } } = {},
): Map<string, { x: number; y: number }> {
  const iterations = opts.iterations ?? 300;
  const k = opts.k ?? 150;
  const cx = opts.center?.x ?? 0;
  const cy = opts.center?.y ?? 0;
  const n = nodes.length;
  const pos = nodes.map((node, i) => {
    if (node.x != null && node.y != null) return { x: node.x, y: node.y };
    // Deterministic phyllotaxis seeding avoids random jumps between renders.
    const a = i * 2.39996;
    const r = k * 0.6 * Math.sqrt(i + 1);
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
  const index = new Map(nodes.map((nd, i) => [nd.id, i]));
  const links = edges
    .map((e) => [index.get(e.source), index.get(e.target)] as const)
    .filter((l): l is readonly [number, number] => l[0] != null && l[1] != null && l[0] !== l[1]);

  let temp = k * 2;
  const cool = temp / (iterations + 1);
  for (let it = 0; it < iterations; it++) {
    const dx = new Float64Array(n);
    const dy = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let vx = pos[i]!.x - pos[j]!.x;
        let vy = pos[i]!.y - pos[j]!.y;
        let d = Math.hypot(vx, vy);
        if (d < 0.01) {
          vx = 0.01 * (i - j);
          vy = 0.01;
          d = 0.02;
        }
        const f = (k * k) / d;
        dx[i] += (vx / d) * f;
        dy[i] += (vy / d) * f;
        dx[j] -= (vx / d) * f;
        dy[j] -= (vy / d) * f;
      }
    }
    for (const [a, b] of links) {
      const vx = pos[a]!.x - pos[b]!.x;
      const vy = pos[a]!.y - pos[b]!.y;
      const d = Math.hypot(vx, vy) || 0.01;
      const f = (d * d) / k;
      dx[a] -= (vx / d) * f;
      dy[a] -= (vy / d) * f;
      dx[b] += (vx / d) * f;
      dy[b] += (vy / d) * f;
    }
    for (let i = 0; i < n; i++) {
      if (nodes[i]!.fixed) continue;
      // Gravity grows with distance (like an attraction to the centre) so disconnected
      // components stay close instead of drifting off-screen.
      const gx = cx - pos[i]!.x;
      const gy = cy - pos[i]!.y;
      const gd = Math.hypot(gx, gy) || 1;
      const gf = (gd * gd) / k * 0.12;
      dx[i] += (gx / gd) * gf;
      dy[i] += (gy / gd) * gf;
      const d = Math.hypot(dx[i]!, dy[i]!) || 1;
      const step = Math.min(d, temp);
      pos[i]!.x += (dx[i]! / d) * step;
      pos[i]!.y += (dy[i]! / d) * step;
    }
    temp = Math.max(temp - cool, 1);
  }
  return new Map(nodes.map((nd, i) => [nd.id, pos[i]!]));
}
