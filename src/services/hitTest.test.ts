import { describe, it, expect } from 'vitest';
import { buildHitIndex } from './hitTest';

describe('buildHitIndex', () => {
  const nodes = [
    { id: 1, x: 0, y: 0, radius: 5 },
    { id: 2, x: 50, y: 50, radius: 5 },
    { id: 3, x: -30, y: 40, radius: 5 },
  ];

  it('returns the node under the cursor', () => {
    const idx = buildHitIndex(nodes);
    expect(idx.pick(1, 1)?.id).toBe(1);
    expect(idx.pick(51, 50)?.id).toBe(2);
  });

  it('returns null if click is outside all radii', () => {
    const idx = buildHitIndex(nodes);
    expect(idx.pick(200, 200)).toBeNull();
  });

  it('returns null for an empty input', () => {
    const idx = buildHitIndex([]);
    expect(idx.pick(0, 0)).toBeNull();
  });

  it('prefers the closest node when two are both in range', () => {
    const overlapping = [
      { id: 10, x: 0, y: 0, radius: 10 },
      { id: 11, x: 5, y: 0, radius: 10 },
    ];
    const idx = buildHitIndex(overlapping);
    expect(idx.pick(-1, 0)?.id).toBe(10);
    expect(idx.pick(6, 0)?.id).toBe(11);
  });

  it('rejects a click outside the radius even if inside the bbox', () => {
    const idx = buildHitIndex([{ id: 1, x: 0, y: 0, radius: 5 }]);
    // (4, 4) is inside the bounding box [-5, 5]² but outside the circle r=5.
    expect(idx.pick(4, 4)).toBeNull();
  });
});
