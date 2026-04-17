import { describe, it, expect } from 'vitest';
import { isEdgeVisible, lodRatingCutoff, lodStrengthCutoff } from './viewport';

describe('isEdgeVisible', () => {
  const view = { minX: 0, minY: 0, maxX: 100, maxY: 100 };

  it('returns true if either endpoint is inside the viewport', () => {
    expect(isEdgeVisible({ x: 50, y: 50 }, { x: 200, y: 200 }, view)).toBe(true);
  });

  it('returns true for an edge entirely inside the viewport', () => {
    expect(isEdgeVisible({ x: 10, y: 10 }, { x: 90, y: 90 }, view)).toBe(true);
  });

  it('returns false if segment bbox misses viewport entirely (top-left)', () => {
    expect(isEdgeVisible({ x: -50, y: -50 }, { x: -10, y: -10 }, view)).toBe(false);
  });

  it('returns false if segment bbox misses viewport entirely (bottom-right)', () => {
    expect(isEdgeVisible({ x: 110, y: 110 }, { x: 200, y: 200 }, view)).toBe(false);
  });

  it('returns true for an edge that spans the viewport horizontally', () => {
    expect(isEdgeVisible({ x: -50, y: 50 }, { x: 150, y: 50 }, view)).toBe(true);
  });
});

describe('lodRatingCutoff', () => {
  it('raises the cutoff at extreme zoom-out', () => {
    expect(lodRatingCutoff(0.3)).toBeGreaterThanOrEqual(8.0);
  });

  it('shows every star once zoom reaches 1.0', () => {
    expect(lodRatingCutoff(1.0)).toBe(0);
    expect(lodRatingCutoff(2.5)).toBe(0);
  });

  it('is monotonic (lower zoom never lowers the cutoff)', () => {
    const levels = [0.1, 0.3, 0.5, 0.8, 1.0, 2.0];
    const cutoffs = levels.map(lodRatingCutoff);
    for (let i = 1; i < cutoffs.length; i++) {
      expect(cutoffs[i]).toBeLessThanOrEqual(cutoffs[i - 1]);
    }
  });
});

describe('lodStrengthCutoff', () => {
  it('requires stronger edges at extreme zoom-out', () => {
    expect(lodStrengthCutoff(0.3)).toBeGreaterThanOrEqual(3);
  });

  it('admits weaker edges as zoom increases', () => {
    expect(lodStrengthCutoff(1.0)).toBeLessThanOrEqual(2);
    expect(lodStrengthCutoff(2.0)).toBeLessThanOrEqual(1);
  });
});
