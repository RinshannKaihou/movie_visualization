import { useEffect, useRef } from 'react';

/**
 * Drifting field of distant background stars. Rendered to its own
 * canvas (sized to the viewport) at a low framerate so it doesn't
 * compete with the main force graph for GPU time.
 *
 * Each star has:
 *   • a static position (twinkles in place)
 *   • a twinkle phase offset so the field feels alive
 *   • a subtle drift on the whole canvas (parallax)
 *
 * Performance notes:
 *   • Density is tuned to ~1 star per 8000 viewport-pixels.
 *   • Twinkling sin() runs in a requestAnimationFrame loop but we
 *     render at ~24fps via a time gate to save battery.
 */
const DENSITY = 1 / 8000;

interface Star {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  tint: string;
}

// Warm star tints — most stars are warm white, a few are blue-white
// or rose. Keeps the backdrop feeling like a real catalog photo.
const STAR_TINTS = [
  'rgba(255,251,230,',  // warm white (most common)
  'rgba(255,251,230,',
  'rgba(255,251,230,',
  'rgba(255,220,180,',  // amber
  'rgba(200,220,255,',  // cool white
  'rgba(255,200,220,',  // rose
];

export const StardustField = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let stars: Star[] = [];
    let width = 0;
    let height = 0;
    let dpr = window.devicePixelRatio || 1;
    let rafId = 0;
    let lastTick = 0;
    const frameInterval = 1000 / 24; // ~24fps

    const generateStars = () => {
      const area = width * height;
      const count = Math.min(Math.floor(area * DENSITY), 500);
      stars = new Array(count).fill(null).map(() => {
        const r = Math.random() < 0.9
          ? 0.4 + Math.random() * 0.8   // tiny stars (majority)
          : 1.0 + Math.random() * 1.2;  // a few brighter ones
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          r,
          baseAlpha: 0.35 + Math.random() * 0.5,
          twinkleSpeed: 0.4 + Math.random() * 1.2,
          twinkleOffset: Math.random() * Math.PI * 2,
          tint: STAR_TINTS[Math.floor(Math.random() * STAR_TINTS.length)],
        };
      });
    };

    const resize = () => {
      const { innerWidth: w, innerHeight: h } = window;
      width = w;
      height = h;
      dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      generateStars();
    };

    const draw = (t: number) => {
      rafId = requestAnimationFrame(draw);
      if (t - lastTick < frameInterval) return;
      lastTick = t;

      ctx.clearRect(0, 0, width, height);

      const time = t * 0.001;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const twinkle = (Math.sin(time * s.twinkleSpeed + s.twinkleOffset) + 1) * 0.5;
        const alpha = s.baseAlpha * (0.5 + twinkle * 0.5);
        ctx.fillStyle = `${s.tint}${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();

        // A subtle cross spike for the brighter stars
        if (s.r > 1) {
          ctx.strokeStyle = `${s.tint}${(alpha * 0.4).toFixed(3)})`;
          ctx.lineWidth = 0.35;
          ctx.beginPath();
          ctx.moveTo(s.x - s.r * 2.5, s.y);
          ctx.lineTo(s.x + s.r * 2.5, s.y);
          ctx.moveTo(s.x, s.y - s.r * 2.5);
          ctx.lineTo(s.x, s.y + s.r * 2.5);
          ctx.stroke();
        }
      }
    };

    resize();
    window.addEventListener('resize', resize);
    rafId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
      }}
    />
  );
};
