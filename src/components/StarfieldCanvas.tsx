import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { select } from 'd3-selection';
import { zoom as d3Zoom, zoomIdentity, type D3ZoomEvent } from 'd3-zoom';
import { useGraphStore } from '../stores/graphStore';
import { useGraphFilters } from '../hooks/useGraphFilters';
import { buildHaloBitmap, hexToTintInt } from '../services/textures';
import { getEdgeColor, getNodeColor, getNodeSize } from '../services/graphBuilder';
import type { MovieEdge, MovieNode } from '../types';

/**
 * WebGL graph renderer — Stage 2.
 *
 * Pixi v8 scene graph:
 *   stage
 *     └─ world (pan/zoom transform target — Task 2.9)
 *          ├─ edgesLayer   (single PIXI.Graphics, rebuilt on filter change)
 *          └─ starsLayer   (2000 tinted halo sprites, one shared texture)
 *
 * Order: edges first so stars render on top of their own connections.
 *
 * Two effects coordinate the scene:
 *   1. `nodes`-dependent: build the entire scene. Rebuilds only when the
 *      graph data identity changes (initial load / Resurvey).
 *   2. `visibleEdges`-dependent: clear() + replay the single Graphics.
 *      This is the hot path for filter toggles and movie selection.
 *
 * The scene ref bridges the two; Effect 2 no-ops until Effect 1 has
 * populated it post-init.
 */

const HALO_SIZE = 256;
// Empirical multiplier: sprite diameter ≈ 6 × base-rating radius. The
// halo's Gaussian falloff means the visible extent is smaller than the
// full sprite bounds, so this factor makes the visible halo match the
// intended star radius.
const STAR_SCALE_MULTIPLIER = 6;

interface SceneRefs {
  edgesLayer: Graphics;
  nodeById: Map<number, MovieNode>;
}

/**
 * Rebuild the single edge Graphics from scratch. Pixi v8 has no in-place
 * segment mutation — you clear() and replay. At 2000 edges, this is in
 * the microseconds; it runs only on filter/selection change, not per frame.
 */
const rebuildEdges = (
  g: Graphics,
  edges: MovieEdge[],
  nodeById: Map<number, MovieNode>,
) => {
  g.clear();
  for (const e of edges) {
    const srcId = typeof e.source === 'number' ? e.source : (e.source as MovieNode).id;
    const tgtId = typeof e.target === 'number' ? e.target : (e.target as MovieNode).id;
    const s = nodeById.get(srcId);
    const t = nodeById.get(tgtId);
    if (!s || !t || s.x == null || s.y == null || t.x == null || t.y == null) continue;

    // Stronger edges draw more prominent: alpha 0.10–0.28, width 0.6–1.6.
    const strength = e.strength;
    const alpha = 0.10 + Math.min(strength - 1, 3) * 0.06;
    const width = 0.6 + (strength - 1) * 0.35;
    const color = hexToTintInt(getEdgeColor(e.types));

    g.moveTo(s.x, s.y);
    g.lineTo(t.x, t.y);
    g.stroke({ color, alpha, width });
  }
};

export const StarfieldCanvas = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneRefs | null>(null);

  const nodes = useGraphStore(state => state.nodes);
  const { visibleEdges } = useGraphFilters();

  // Keep the latest visibleEdges accessible inside the async init() callback
  // so the first draw uses current filter state, not the stale value
  // captured at effect creation.
  const edgesRef = useRef(visibleEdges);
  edgesRef.current = visibleEdges;

  // Effect 1: scene build. Triggers when the nodes array identity changes.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
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

        const haloTex = Texture.from(buildHaloBitmap(HALO_SIZE));

        const world = new Container();
        app.stage.addChild(world);

        // --- pan / zoom via d3-zoom --------------------------------------
        // d3-zoom dispatches a transform { x, y, k } on drag + wheel + pinch.
        // We copy it onto the `world` container so every layer inside pans
        // and zooms together. Store sync lets Stage 4 LOD read current zoom.
        const setZoom = useGraphStore.getState().setZoom;
        const d3zoom = d3Zoom<HTMLCanvasElement, unknown>()
          .scaleExtent([0.15, 6])
          .on('zoom', (event: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
            world.position.set(event.transform.x, event.transform.y);
            world.scale.set(event.transform.k);
            setZoom(event.transform.k);
          });
        // Cast to HTMLElement because d3's canvas type selectors are picky.
        const sel = select(app.canvas as HTMLCanvasElement);
        sel.call(d3zoom);
        // Initial view: world-space origin at the screen center at k=1.
        sel.call(
          d3zoom.transform,
          zoomIdentity.translate(app.screen.width / 2, app.screen.height / 2).scale(1),
        );

        // --- edges (rendered first, behind stars) ------------------------
        const edgesLayer = new Graphics();
        edgesLayer.blendMode = 'add';
        world.addChild(edgesLayer);

        // --- stars --------------------------------------------------------
        const starsLayer = new Container();
        world.addChild(starsLayer);

        const nodeById = new Map<number, MovieNode>();
        for (const node of nodes) {
          if (node.x == null || node.y == null) continue;
          nodeById.set(node.id, node);

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

        // Draw initial edges using whatever filter state is current RIGHT
        // NOW (not whatever was current when this effect was scheduled).
        rebuildEdges(edgesLayer, edgesRef.current, nodeById);

        sceneRef.current = { edgesLayer, nodeById };
        console.log(
          `StarfieldCanvas: ${starsLayer.children.length} stars, ${edgesRef.current.length} edges`,
        );
      })
      .catch((err: unknown) => {
        console.error('StarfieldCanvas: Pixi init failed', err);
      });

    return () => {
      cancelled = true;
      sceneRef.current = null;
      app.destroy(true, { children: true, texture: true });
    };
  }, [nodes]);

  // Effect 2: edge updates. Runs on every filter/selection change, but
  // no-ops until Effect 1's init has resolved.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    rebuildEdges(scene.edgesLayer, visibleEdges, scene.nodeById);
  }, [visibleEdges]);

  return <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />;
};
