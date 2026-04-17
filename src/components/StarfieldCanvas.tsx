import { useEffect, useRef } from 'react';
import { Application } from 'pixi.js';

/**
 * WebGL graph renderer — Stage 2 stub.
 *
 * Owns a Pixi v8 Application mounted inside a host div sized to the
 * viewport. Subsequent Stage 2 tasks add the star layer, edge layer,
 * pan/zoom, and hit-test. The full aesthetic layer (nebula, focus
 * animation, LOD) lands in Stage 4.
 *
 * Lifecycle:
 *   mount   → Application.init() resolves asynchronously → canvas attached.
 *   unmount → app.destroy() tears down GPU resources. The `cancelled`
 *             flag handles the case where React strict-mode double-mounts
 *             and unmounts before init() resolves.
 */
export const StarfieldCanvas = () => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();
    let cancelled = false;

    app
      .init({
        resizeTo: host,
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      })
      .then(() => {
        if (cancelled) {
          app.destroy(true, { children: true, texture: true });
          return;
        }
        host.appendChild(app.canvas);
      })
      .catch((err: unknown) => {
        console.error('StarfieldCanvas: Pixi init failed', err);
      });

    return () => {
      cancelled = true;
      // If app.canvas exists and was attached, destroy tears it down.
      app.destroy(true, { children: true, texture: true });
    };
  }, []);

  return (
    <div
      ref={hostRef}
      style={{ position: 'absolute', inset: 0 }}
    />
  );
};
