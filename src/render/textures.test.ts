import { describe, expect, it } from 'vitest';
import { buildDiscBitmap, buildDustBitmap, buildGlowBitmap, hexToTintInt } from './textures';

const alphaAt = (canvas: HTMLCanvasElement, x: number, y: number) =>
  canvas.getContext('2d')!.getImageData(x, y, 1, 1).data[3];

describe('buildGlowBitmap', () => {
  it('is bright at the center and fully transparent at the rim', () => {
    const glow = buildGlowBitmap(64);
    expect(glow.width).toBe(64);
    expect(alphaAt(glow, 32, 32)).toBeGreaterThan(240);
    expect(alphaAt(glow, 0, 0)).toBe(0);
    expect(alphaAt(glow, 63, 32)).toBeLessThan(3); // edge midpoint: no visible sprite border
  });

  it('falls off monotonically along a row', () => {
    const row = buildGlowBitmap(64).getContext('2d')!.getImageData(32, 32, 32, 1).data;
    for (let x = 1; x < 32; x++) expect(row[x * 4 + 3]).toBeLessThanOrEqual(row[(x - 1) * 4 + 3]);
  });
});

describe('buildDiscBitmap', () => {
  it('is an opaque disc with transparent corners and a soft rim', () => {
    const disc = buildDiscBitmap(64);
    expect(alphaAt(disc, 32, 32)).toBe(255);
    expect(alphaAt(disc, 0, 0)).toBe(0);
    const rim = alphaAt(disc, 63, 32);
    expect(rim).toBeLessThan(255);
  });
});

describe('buildDustBitmap', () => {
  it('is deterministic for a seed', () => {
    const a = buildDustBitmap(128, 40, 7).toDataURL();
    expect(buildDustBitmap(128, 40, 7).toDataURL()).toBe(a);
    expect(buildDustBitmap(128, 40, 8).toDataURL()).not.toBe(a);
  });
});

describe('hexToTintInt', () => {
  it('parses #rrggbb, #rgb, and bare hex', () => {
    expect(hexToTintInt('#ffd27a')).toBe(0xffd27a);
    expect(hexToTintInt('#abc')).toBe(0xaabbcc);
    expect(hexToTintInt('00ff00')).toBe(0x00ff00);
  });
});
