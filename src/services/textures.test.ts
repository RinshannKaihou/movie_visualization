import { describe, it, expect } from 'vitest';
import { buildGlowBitmap, hexToTintInt } from './textures';

describe('buildGlowBitmap', () => {
  it('returns a canvas of the requested size', () => {
    const canvas = buildGlowBitmap(64);
    expect(canvas.width).toBe(64);
    expect(canvas.height).toBe(64);
  });

  it('center pixel alpha is max, corner alpha is ~0', () => {
    const canvas = buildGlowBitmap(64);
    const ctx = canvas.getContext('2d')!;
    const center = ctx.getImageData(32, 32, 1, 1).data[3];
    const corner = ctx.getImageData(0, 0, 1, 1).data[3];
    expect(center).toBeGreaterThan(240);
    expect(corner).toBeLessThan(20);
  });

  it('alpha falls off monotonically from center to edge along a row', () => {
    const canvas = buildGlowBitmap(64);
    const ctx = canvas.getContext('2d')!;
    const row = ctx.getImageData(32, 32, 32, 1).data;
    // Sample every 4 pixels (each RGBA quad = 4 bytes).
    let prev = row[3];
    for (let x = 1; x < 32; x++) {
      const alpha = row[x * 4 + 3];
      expect(alpha).toBeLessThanOrEqual(prev);
      prev = alpha;
    }
  });
});

describe('hexToTintInt', () => {
  it('converts a #rrggbb string to a 24-bit int', () => {
    expect(hexToTintInt('#ff0000')).toBe(0xff0000);
    expect(hexToTintInt('#00ff00')).toBe(0x00ff00);
    expect(hexToTintInt('#0000ff')).toBe(0x0000ff);
    expect(hexToTintInt('#ffd27a')).toBe(0xffd27a);
  });

  it('accepts a 3-character shorthand', () => {
    expect(hexToTintInt('#f00')).toBe(0xff0000);
    expect(hexToTintInt('#abc')).toBe(0xaabbcc);
  });

  it('accepts a hex without the leading #', () => {
    expect(hexToTintInt('ffd27a')).toBe(0xffd27a);
  });
});
