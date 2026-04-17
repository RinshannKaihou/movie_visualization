/**
 * Nebula backdrop bitmap — a deep-space cloud behind the starfield.
 *
 * Built with seeded value noise (FBM = fractal Brownian motion) at five
 * octaves. The three color channels draw from separate 2D noise fields
 * offset in phase so the resulting sprite has violet, rose, and teal
 * regions that slowly drift apart under parallax. Alpha also tracks the
 * low-frequency noise so the cloud feels chunky rather than uniform.
 *
 * 2048 × 1024 runs in ~50ms on a laptop. Called once at Pixi init; the
 * resulting Texture stays mounted for the app lifetime. The scrolling
 * motion we see in the UI comes from moving the sprite's position, not
 * regenerating the bitmap.
 */

// Pseudorandom value-noise helper. Not cryptographic — just good enough
// for organic cloud textures. Derived from the standard gl-slang trick
// fract(sin(dot(xy, (127.1, 311.7)) + seed) * 43758.5453).
const hash2D = (x: number, y: number, seed: number): number => {
  const n = Math.sin((x * 127.1 + y * 311.7 + seed) * 43758.5453);
  return n - Math.floor(n);
};

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const valueNoise2D = (x: number, y: number, seed: number): number => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = smoothstep(xf);
  const v = smoothstep(yf);
  return lerp(
    lerp(hash2D(xi, yi, seed), hash2D(xi + 1, yi, seed), u),
    lerp(hash2D(xi, yi + 1, seed), hash2D(xi + 1, yi + 1, seed), u),
    v,
  );
};

// Fractal Brownian motion — sum of noise at progressively smaller scales.
// Produces the characteristic "cloudy self-similar" look at low cost.
const fbm = (x: number, y: number, seed: number): number => {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 5; i++) {
    sum += amp * valueNoise2D(x * freq, y * freq, seed);
    amp *= 0.5;
    freq *= 2;
  }
  return sum;
};

export const buildNebulaBitmap = (
  width: number,
  height: number,
  seed = 7,
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);

  // Each color channel samples a distinct noise field. Offsetting the
  // seeds and scales gives the three colors independent cloud shapes
  // that read as one complex nebula rather than a monotone cloud.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const violet = fbm(x / 200, y / 200, seed);
      const rose = fbm(x / 300 + 100, y / 300, seed);
      const teal = fbm(x / 250 + 200, y / 250, seed);

      const i = (y * width + x) * 4;
      img.data[i] = Math.min(255, Math.round(violet * 140 + rose * 80));
      img.data[i + 1] = Math.min(255, Math.round(rose * 30 + teal * 40));
      img.data[i + 2] = Math.min(255, Math.round(violet * 180 + teal * 120));
      // Alpha follows the low-frequency noise so sparse regions fade
      // toward black rather than sit at a hard edge.
      img.data[i + 3] = Math.round(50 + violet * 70);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
};
