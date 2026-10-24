import Flatbush from 'flatbush';

/**
 * Pointer picking over pinned star positions. Flatbush is a static R-tree
 * on flat typed arrays; positions never change at runtime, so it is built
 * once and queried at pointer-move rate.
 */

export interface HitPoint {
  x: number;
  y: number;
  radius: number;
}

export interface HitIndex {
  /**
   * Index of the star under (x, y) in world units, or null. `slack` widens
   * every star's catch radius (pass screen pixels / zoom, so tiny stars stay
   * clickable when zoomed out); `radiusScale` matches the renderer's
   * zoom-dependent star size. Overlaps resolve to the star the pointer is
   * relatively deepest inside (distance ÷ catch radius), so a small star
   * next to a big one stays pickable.
   */
  pick(x: number, y: number, slack: number, radiusScale?: number): number | null;
}

export const buildHitIndex = (points: readonly HitPoint[]): HitIndex => {
  if (points.length === 0) return { pick: () => null };

  const index = new Flatbush(points.length);
  let maxRadius = 0;
  for (const p of points) {
    index.add(p.x, p.y, p.x, p.y);
    maxRadius = Math.max(maxRadius, p.radius);
  }
  index.finish();

  return {
    pick(x, y, slack, radiusScale = 1) {
      let best: number | null = null;
      let bestDepth = Infinity;
      for (const i of index.neighbors(x, y, 8, maxRadius * radiusScale + slack)) {
        const p = points[i];
        const depth = Math.hypot(p.x - x, p.y - y) / (p.radius * radiusScale + slack);
        if (depth <= 1 && depth < bestDepth) {
          best = i;
          bestDepth = depth;
        }
      }
      return best;
    },
  };
};
