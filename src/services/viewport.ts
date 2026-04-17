/**
 * Viewport culling + level-of-detail math.
 *
 * Pure functions, no Pixi or DOM dependencies, so the hot edge-rebuild
 * path can call these without import side effects. All consumers pass
 * world-space coordinates (post-pan/zoom inverse transform).
 */

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Axis-aligned segment-vs-rect test. Approximates segment visibility by
 * rejecting only when the segment's bounding box is disjoint from the
 * viewport. False positives (diagonal segments near a corner) are cheap
 * to draw anyway; false negatives (popping) are the bug we cannot
 * tolerate, so we err on the side of drawing.
 */
export const isEdgeVisible = (a: Point, b: Point, view: Bounds): boolean => {
  const segMinX = a.x < b.x ? a.x : b.x;
  const segMaxX = a.x < b.x ? b.x : a.x;
  const segMinY = a.y < b.y ? a.y : b.y;
  const segMaxY = a.y < b.y ? b.y : a.y;
  if (segMaxX < view.minX) return false;
  if (segMinX > view.maxX) return false;
  if (segMaxY < view.minY) return false;
  if (segMinY > view.maxY) return false;
  return true;
};

// --- Level-of-detail cutoffs ---------------------------------------------
// Thresholds tuned for the 2000-movie dataset at the Stage 1 layout scale.
// The idea: at extreme zoom-out the screen packs too many bodies to parse,
// so we hide the dim ones and the weak edges. As the user zooms in, the
// scene reveals more detail, keeping information density roughly constant.

/**
 * Minimum rating to draw at full brightness for a given zoom. Stars below
 * the cutoff are drawn dim (~10% alpha) or skipped entirely by the consumer.
 */
export const lodRatingCutoff = (zoom: number): number => {
  if (zoom < 0.4) return 8.0;
  if (zoom < 0.7) return 7.0;
  return 0;
};

/**
 * Minimum edge strength (1 = single connection type; 4 = all four types
 * overlap) to include in the visible set for a given zoom.
 */
export const lodStrengthCutoff = (zoom: number): number => {
  if (zoom < 0.4) return 3;
  if (zoom < 1.0) return 2;
  return 1;
};
