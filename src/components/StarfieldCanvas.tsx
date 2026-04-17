import { useEffect, useRef } from 'react';
import { Application, Container, Sprite, Texture } from 'pixi.js';
import { useGraphStore } from '../stores/graphStore';
import { buildHaloBitmap, hexToTintInt } from '../services/textures';
import { getNodeColor, getNodeSize } from '../services/graphBuilder';

/**
 * WebGL graph renderer — Stage 2.
 *
 * Pixi v8 scene graph:
 *   stage
 *     └─ world (pan/zoom transform target — Task 2.9)
 *          └─ starsLayer    (2000 tinted halo sprites, one shared texture)
 *
 * The star layer is a plain Container, not a ParticleContainer: Pixi v8
 * auto-batches sprites that share a texture into a single GL draw call
 * via its BatchRenderer, so we get the same ~1-draw-call throughput for
 * 2000 stars without ParticleContainer's API restrictions. We keep the
 * `world` child separate from `stage` now so the pan/zoom transform in
 * Task 2.9 has a single pivot.
 */

// Texture dimensions in pixels. The star's rendered size is controlled
// by sprite.scale — we normalize so `scale = getNodeSize(rating) * K / HALO_SIZE`.
const HALO_SIZE = 256;
// Empirical multiplier: sprite diameter ≈ 6 × base-rating radius. The
// halo's Gaussian falloff means the visible extent is smaller than the
// full sprite bounds, so this factor makes the visible halo match the
// intended star radius.
const STAR_SCALE_MULTIPLIER = 6;

export const StarfieldCanvas = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const nodes = useGraphStore(state => state.nodes);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // Snapshot at effect start so we don't race with data updates mid-init.
    if (nodes.length === 0) return;

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

        // Shared white Gaussian halo, generated once, uploaded once.
        const haloTex = Texture.from(buildHaloBitmap(HALO_SIZE));

        // World transform target — Task 2.9's pan/zoom pivots on this.
        const world = new Container();
        world.x = app.screen.width / 2;
        world.y = app.screen.height / 2;
        app.stage.addChild(world);

        const starsLayer = new Container();
        world.addChild(starsLayer);

        for (const node of nodes) {
          if (node.x == null || node.y == null) continue;
          const sprite = new Sprite(haloTex);
          sprite.anchor.set(0.5);
          const radius = getNodeSize(node.rating);
          const drawDiameter = radius * STAR_SCALE_MULTIPLIER;
          sprite.scale.set(drawDiameter / HALO_SIZE);
          sprite.tint = hexToTintInt(getNodeColor(node.genres));
          sprite.blendMode = 'add';
          sprite.x = node.x;
          sprite.y = node.y;
          starsLayer.addChild(sprite);
        }

        console.log(`StarfieldCanvas: rendered ${starsLayer.children.length} stars`);
      })
      .catch((err: unknown) => {
        console.error('StarfieldCanvas: Pixi init failed', err);
      });

    return () => {
      cancelled = true;
      app.destroy(true, { children: true, texture: true });
    };
    // Rebuild whenever the nodes array identity changes (e.g. initial load,
    // Resurvey). Zustand gives a new reference on setGraphData.
  }, [nodes]);

  return <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />;
};
