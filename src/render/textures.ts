/**
 * CPU-drawn bitmaps uploaded once as GPU textures. Pure canvas code (no Pixi
 * imports) so it runs under jsdom + node-canvas in tests.
 *
 * Everything is drawn white and tinted per sprite at render time, so one
 * texture serves every genre color.
 */

const canvasOf = (size: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
};

/**
 * Soft halo: a Gaussian times a smooth window that reaches exactly zero at the
 * rim, so a bright, scaled-up glow never shows the sprite's edge.
 */
export const buildGlowBitmap = (size: number): HTMLCanvasElement => {
  const canvas = canvasOf(size);
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const half = size / 2;
  const inv2Sig2 = 1 / (2 * (half / 1.8) ** 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d2 = (x + 0.5 - half) ** 2 + (y + 0.5 - half) ** 2;
      const t = Math.min(1, Math.sqrt(d2) / half);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(Math.exp(-d2 * inv2Sig2) * (1 - t * t) ** 2 * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
};

/**
 * Filled disc with a one-texel anti-aliased rim and a slightly brighter
 * core, so a tinted star reads as a lit sphere rather than a flat dot.
 */
export const buildDiscBitmap = (size: number): HTMLCanvasElement => {
  const canvas = canvasOf(size);
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const r = size / 2 - 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2);
      const coverage = Math.min(1, Math.max(0, r - d + 0.5));
      const shade = 0.82 + 0.18 * (1 - Math.min(1, d / r)); // 82% at the rim → 100% center
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(255 * shade);
      img.data[i + 3] = Math.round(coverage * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
};

/**
 * Tileable star-dust backdrop. Seeded so the sky does not reshuffle on every
 * reload; dots never straddle the tile edge, so tiling shows no seams.
 */
export const buildDustBitmap = (size: number, count: number, seed: number): HTMLCanvasElement => {
  const canvas = canvasOf(size);
  const ctx = canvas.getContext('2d')!;
  let s = seed >>> 0;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const radius = 0.35 + rand() ** 3 * 1.1;
    const x = radius + rand() * (size - radius * 2);
    const y = radius + rand() * (size - radius * 2);
    ctx.globalAlpha = 0.12 + rand() * 0.45;
    ctx.fillStyle = rand() < 0.15 ? '#cfe0ff' : '#fffbe6';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
};

/** "#rrggbb" / "#rgb" / "rrggbb" → 0xRRGGBB for Pixi tints. */
export const hexToTintInt = (hex: string): number => {
  const h = hex.replace('#', '');
  return parseInt(h.length === 3 ? [...h].map(c => c + c).join('') : h, 16);
};
