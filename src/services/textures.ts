/**
 * Offscreen bitmap builders for GPU-uploaded Pixi textures.
 *
 * We CPU-render each asset once to an HTMLCanvasElement and hand it to
 * `PIXI.Texture.from(...)`. The texture upload happens exactly once per
 * bitmap; the hot render path is just `sprite.x/y` mutation. Keeping
 * these builders pure (no Pixi imports) lets them run under jsdom so
 * we can unit-test bitmap invariants without mocking WebGL.
 */

// --- halo sprite ----------------------------------------------------------

/**
 * True Gaussian halo on white. Consumers tint via `sprite.tint` at render
 * time, so we emit pure white RGB and encode the falloff in alpha only.
 *
 * The formula is `alpha = exp(-(r/σ)² / 2)` with σ = half/2.2, chosen so
 * the halo fades to ≤ 2% alpha at the canvas edge — the corner pixels
 * stay effectively black, avoiding a visible sprite boundary when many
 * halos overlap under additive blending.
 *
 * Cost: one `exp()` per pixel. 256×256 runs in ~5 ms on a laptop. Called
 * once at app init; the texture lives for the app lifetime.
 */
export const buildHaloBitmap = (size: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const half = size / 2;
  const sigma = half / 2.2;
  const inv2Sig2 = 1 / (2 * sigma * sigma);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - half;
      const dy = y - half;
      const a = Math.exp(-(dx * dx + dy * dy) * inv2Sig2);
      const i = (y * size + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.min(255, Math.round(a * 255));
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
};

// --- color helpers --------------------------------------------------------

/**
 * Convert a #rrggbb (or #rgb, or bare hex) string to a 24-bit integer
 * suitable for `sprite.tint`. Pixi's tint pipeline multiplies this value
 * against the texture's white RGB at shade time, so we can reuse a
 * single white halo across every genre.
 */
export const hexToTintInt = (hex: string): number => {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map(c => c + c)
          .join('')
      : h;
  return parseInt(full, 16);
};
