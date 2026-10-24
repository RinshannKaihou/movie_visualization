import { describe, expect, it } from 'vitest';
import { computeLayout, DEFAULT_LAYOUT_PARAMS, familyAnchors, nodeRadius, type LayoutNode } from './layout.ts';
import type { Edge, GenreFamilyId } from './types.ts';

const families: GenreFamilyId[] = ['drama', 'crime', 'animation', 'scifi'];
const nodes: LayoutNode[] = Array.from({ length: 40 }, (_, i) => ({ family: families[i % 4], radius: 3 + (i % 3) }));
const edges: Edge[] = Array.from({ length: 39 }, (_, i) => ({
  source: i,
  target: i + 1,
  mask: 1,
  weight: (i % 10) / 10 + 0.1,
}));
const params = { ...DEFAULT_LAYOUT_PARAMS, iterations: 120 };

describe('computeLayout', () => {
  it('is deterministic for a given seed', () => {
    expect(computeLayout(nodes, edges, params)).toEqual(computeLayout(nodes, edges, params));
  });

  it('changes with the seed', () => {
    const a = computeLayout(nodes, edges, params);
    const b = computeLayout(nodes, edges, { ...params, seed: 2 });
    expect(a).not.toEqual(b);
  });

  it('places every node at a finite position', () => {
    const pos = computeLayout(nodes, edges, params);
    expect(pos.length).toBe(nodes.length * 2);
    expect([...pos].every(Number.isFinite)).toBe(true);
  });

  it('keeps stars from overlapping', () => {
    const pos = computeLayout(nodes, edges, params);
    let worst = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = Math.hypot(pos[i * 2] - pos[j * 2], pos[i * 2 + 1] - pos[j * 2 + 1]);
        worst = Math.min(worst, d / (nodes[i].radius + nodes[j].radius));
      }
    }
    expect(worst).toBeGreaterThan(0.9);
  });
});

describe('familyAnchors', () => {
  it('gives each present family a distinct anchor', () => {
    const anchors = familyAnchors(nodes, 100);
    expect([...anchors.keys()].sort()).toEqual([...families].sort());
    const points = [...anchors.values()].map(p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`);
    expect(new Set(points).size).toBe(points.length);
  });
});

describe('nodeRadius', () => {
  it('grows with rating within the dataset range', () => {
    expect(nodeRadius(7.3, 7.3, 8.7)).toBeLessThan(nodeRadius(8.0, 7.3, 8.7));
    expect(nodeRadius(8.0, 7.3, 8.7)).toBeLessThan(nodeRadius(8.7, 7.3, 8.7));
  });

  it('clamps outside the range and survives a zero-width range', () => {
    expect(nodeRadius(1, 7, 9)).toBe(nodeRadius(7, 7, 9));
    expect(nodeRadius(10, 7, 9)).toBe(nodeRadius(9, 7, 9));
    expect(Number.isFinite(nodeRadius(8, 8, 8))).toBe(true);
  });
});
