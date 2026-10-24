import { describe, expect, it } from 'vitest';
import { estimateTextWidth, placeLabels, type LabelBox } from './labels';

const box = (id: number, x: number, y: number, width = 40, height = 12): LabelBox => ({ id, x, y, width, height });
const viewport = { width: 500, height: 300 };

describe('placeLabels', () => {
  it('keeps the higher-priority label when two collide', () => {
    const placed = placeLabels([box(1, 100, 100), box(2, 110, 104), box(3, 300, 100)], viewport, 10);
    expect(placed.map(b => b.id)).toEqual([1, 3]);
  });

  it('never returns overlapping boxes', () => {
    const many = Array.from({ length: 400 }, (_, i) => box(i, (i * 37) % 480, (i * 53) % 290, 30 + (i % 20), 12));
    const placed = placeLabels(many, viewport, 1000);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i], b = placed[j];
        const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlap).toBe(false);
      }
    }
  });

  it('skips off-screen labels and stops at maxCount', () => {
    expect(placeLabels([box(1, -100, 10), box(2, 10, 400)], viewport, 10)).toEqual([]);
    expect(placeLabels([box(1, 0, 0), box(2, 100, 0), box(3, 200, 0)], viewport, 2)).toHaveLength(2);
  });
});

describe('estimateTextWidth', () => {
  it('counts CJK glyphs as two columns', () => {
    expect(estimateTextWidth('Ran', 10)).toBeCloseTo(18);
    expect(estimateTextWidth('千と', 10)).toBeCloseTo(24);
  });
});
