import Flatbush from 'flatbush';

/**
 * Spatial index for pointer hit-testing.
 *
 * Build once from pinned positions (Stage 1 guarantees x/y on every
 * node), then query at pointer-move rate. Flatbush is a static R-tree
 * backed by flat typed arrays — 10-100x faster than tree-of-objects
 * structures, at the cost of being immutable after `finish()`. Positions
 * never change at runtime in this app, so immutability is free.
 */

export interface HitNode {
  id: number;
  x: number;
  y: number;
  radius: number;
}

export interface HitIndex {
  /**
   * Find the node whose circle (x, y, radius) contains the given point.
   * If multiple circles contain the point, returns the one whose center
   * is closest — important when two halos overlap.
   * Returns null when no circle contains the point.
   */
  pick: (x: number, y: number) => HitNode | null;
}

export const buildHitIndex = (nodes: HitNode[]): HitIndex => {
  if (nodes.length === 0) {
    return { pick: () => null };
  }

  const index = new Flatbush(nodes.length);
  for (const n of nodes) {
    index.add(n.x - n.radius, n.y - n.radius, n.x + n.radius, n.y + n.radius);
  }
  index.finish();

  return {
    pick: (x, y) => {
      // Fast candidate set: all bboxes overlapping the point.
      const ids = index.search(x, y, x, y);
      if (ids.length === 0) return null;
      let best: HitNode | null = null;
      let bestDist = Infinity;
      for (const i of ids) {
        const n = nodes[i];
        const dx = n.x - x;
        const dy = n.y - y;
        const d2 = dx * dx + dy * dy;
        // Circle test — rejects corners of the bbox outside the radius.
        if (d2 <= n.radius * n.radius && d2 < bestDist) {
          best = n;
          bestDist = d2;
        }
      }
      return best;
    },
  };
};
