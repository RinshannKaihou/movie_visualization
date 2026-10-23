import { describe, expect, it } from 'vitest';
import type { Graphics } from 'pixi.js';
import { applyEdgeVisibility, bucketOf, curveControl, edgeColor, visibleBuckets, WEIGHT_BUCKETS, type EdgeGroup } from './edges';
import { CONNECTION_BIT, CONNECTION_META } from '../core/connections';
import { hexToTintInt } from './textures';

describe('weight buckets', () => {
  it('assigns every weight to a bucket, strongest first', () => {
    expect(bucketOf(1)).toBe(0);
    expect(bucketOf(WEIGHT_BUCKETS[0])).toBe(0);
    expect(bucketOf(0.4)).toBe(1);
    expect(bucketOf(0)).toBe(WEIGHT_BUCKETS.length - 1);
  });

  it('reveals weaker buckets as you zoom in, never fewer', () => {
    const levels = [0.6, 1, 1.5, 3, 8].map(visibleBuckets);
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
    expect(levels.at(-1)).toBe(WEIGHT_BUCKETS.length - 1);
  });
});

describe('curveControl', () => {
  it('bows perpendicular to the edge, alternating sides', () => {
    const even = curveControl({ source: 0, target: 2, mask: 1, weight: 1 }, 0, 0, 100, 0);
    const odd = curveControl({ source: 0, target: 1, mask: 1, weight: 1 }, 0, 0, 100, 0);
    expect(even.cx).toBeCloseTo(50);
    expect(Math.sign(even.cy)).toBe(-Math.sign(odd.cy));
    expect(Math.abs(even.cy)).toBeCloseTo(12);
  });
});

describe('applyEdgeVisibility', () => {
  const group = (mask: number, bucket: number): EdgeGroup => ({
    mask,
    bucket,
    graphics: { visible: true, tint: 0 } as unknown as Graphics,
  });

  it('shows groups with an active type within the LOD cut, colored by the strongest active type', () => {
    const both = group(CONNECTION_BIT.director | CONNECTION_BIT.genre, 0);
    const genreOnly = group(CONNECTION_BIT.genre, 0);
    const weak = group(CONNECTION_BIT.director, 2);
    applyEdgeVisibility([both, genreOnly, weak], CONNECTION_BIT.genre, 1);
    expect(both.graphics.visible).toBe(true);
    expect(both.graphics.tint).toBe(hexToTintInt(CONNECTION_META.genre.color));
    expect(genreOnly.graphics.visible).toBe(true);
    expect(weak.graphics.visible).toBe(false);

    applyEdgeVisibility([both], CONNECTION_BIT.director | CONNECTION_BIT.genre, 2);
    expect(both.graphics.tint).toBe(edgeColor(CONNECTION_BIT.director));
  });
});
