/**
 * Camera math, kept pure so it is testable without Pixi or a DOM.
 * A transform maps world → screen as screen = world · k + (x, y).
 */

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Screen regions covered by UI chrome, in CSS pixels. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ViewTransform {
  x: number;
  y: number;
  k: number;
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

export const boundsOf = (points: Iterable<{ x: number; y: number; radius?: number }>): Bounds => {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of points) {
    const r = p.radius ?? 0;
    b.minX = Math.min(b.minX, p.x - r);
    b.minY = Math.min(b.minY, p.y - r);
    b.maxX = Math.max(b.maxX, p.x + r);
    b.maxY = Math.max(b.maxY, p.y + r);
  }
  return b;
};

/**
 * Transform that fits `bounds` inside the part of a width×height viewport not
 * covered by `insets`, leaving `padding` pixels around it. Zoom is clamped to
 * [minK, maxK] so a single star does not fill the screen.
 */
export const fitTransform = (
  bounds: Bounds,
  width: number,
  height: number,
  { insets = NO_INSETS, padding = 0, minK = 0, maxK = Infinity }: {
    insets?: Insets;
    padding?: number;
    minK?: number;
    maxK?: number;
  } = {},
): ViewTransform => {
  const availW = Math.max(1, width - insets.left - insets.right - padding * 2);
  const availH = Math.max(1, height - insets.top - insets.bottom - padding * 2);
  const bw = Math.max(1e-6, bounds.maxX - bounds.minX);
  const bh = Math.max(1e-6, bounds.maxY - bounds.minY);
  const k = Math.min(maxK, Math.max(minK, Math.min(availW / bw, availH / bh)));
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const screenCx = insets.left + (width - insets.left - insets.right) / 2;
  const screenCy = insets.top + (height - insets.top - insets.bottom) / 2;
  return { x: screenCx - cx * k, y: screenCy - cy * k, k };
};

/** The world point under a screen point. */
export const screenToWorld = (t: ViewTransform, sx: number, sy: number) => ({
  x: (sx - t.x) / t.k,
  y: (sy - t.y) / t.k,
});
