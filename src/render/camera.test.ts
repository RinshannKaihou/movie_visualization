import { describe, expect, it } from 'vitest';
import { boundsOf, fitTransform, screenToWorld } from './camera';

const square = { minX: -50, minY: -50, maxX: 50, maxY: 50 };

describe('fitTransform', () => {
  it('centers and scales bounds into the viewport', () => {
    const t = fitTransform(square, 400, 200);
    expect(t.k).toBe(2); // limited by height: 200 / 100
    expect(screenToWorld(t, 200, 100)).toEqual({ x: 0, y: 0 });
  });

  it('centers in the area left uncovered by insets', () => {
    const t = fitTransform(square, 400, 200, { insets: { top: 0, right: 200, bottom: 0, left: 0 } });
    expect(screenToWorld(t, 100, 100)).toEqual({ x: 0, y: 0 });
  });

  it('respects padding and zoom limits', () => {
    expect(fitTransform(square, 400, 200, { padding: 50 }).k).toBe(1);
    expect(fitTransform(square, 400, 200, { maxK: 1.5 }).k).toBe(1.5);
    expect(fitTransform({ minX: 0, minY: 0, maxX: 0, maxY: 0 }, 400, 200, { maxK: 4 }).k).toBe(4);
  });
});

describe('boundsOf', () => {
  it('includes star radii', () => {
    expect(boundsOf([{ x: 0, y: 0, radius: 2 }, { x: 10, y: 5 }])).toEqual({ minX: -2, minY: -2, maxX: 10, maxY: 5 });
  });
});
