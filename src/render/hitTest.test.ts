import { describe, expect, it } from 'vitest';
import { buildHitIndex } from './hitTest';

const points = [
  { x: 0, y: 0, radius: 5 },
  { x: 50, y: 50, radius: 5 },
  { x: -30, y: 40, radius: 2 },
];

describe('buildHitIndex', () => {
  it('returns the star under the pointer', () => {
    const index = buildHitIndex(points);
    expect(index.pick(1, 1, 0)).toBe(0);
    expect(index.pick(51, 50, 0)).toBe(1);
  });

  it('returns null on empty sky and for an empty index', () => {
    expect(buildHitIndex(points).pick(200, 200, 0)).toBeNull();
    expect(buildHitIndex([]).pick(0, 0, 10)).toBeNull();
  });

  it('widens catch radius by slack so tiny stars stay clickable', () => {
    const index = buildHitIndex(points);
    expect(index.pick(-30, 45, 0)).toBeNull();  // 5 from center, radius 2
    expect(index.pick(-30, 45, 4)).toBe(2);
  });

  it('scales radii with the renderer’s zoom-dependent star size', () => {
    const index = buildHitIndex(points);
    expect(index.pick(7, 0, 0)).toBeNull();
    expect(index.pick(7, 0, 0, 1.5)).toBe(0);
  });

  it('resolves overlaps to the star the pointer is relatively deepest inside', () => {
    const index = buildHitIndex([
      { x: 0, y: 0, radius: 10 },
      { x: 6, y: 0, radius: 3 },
    ]);
    expect(index.pick(6, 0, 0)).toBe(1);
    expect(index.pick(-4, 0, 0)).toBe(0);
  });
});
