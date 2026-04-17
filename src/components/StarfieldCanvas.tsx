import { useEffect, useRef, useState } from 'react';
import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { select } from 'd3-selection';
import { zoom as d3Zoom, zoomIdentity, type D3ZoomEvent } from 'd3-zoom';
import { useGraphStore } from '../stores/graphStore';
import { useGraphFilters } from '../hooks/useGraphFilters';
import { buildHaloBitmap, hexToTintInt } from '../services/textures';
import { buildHitIndex, type HitIndex } from '../services/hitTest';
import { getEdgeColor, getNodeColor, getNodeSize } from '../services/graphBuilder';
import { NodeTooltip } from './NodeTooltip';
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
  world: Container;
  hitIndex: HitIndex;
  canvas: HTMLCanvasElement;
}

// Pointer movement in screen pixels below which a pointerup is treated as
// a click rather than a drag-release. d3-zoom handles drags but emits no
// event for a short press-release, so we disambiguate ourselves.
const CLICK_DRAG_THRESHOLD_PX = 3;
// Hit radius multiplier relative to visual radius. Tuned so pointers near
// (not on) a star still register; tighter feels sticky, looser catches air.
const HIT_RADIUS_MULTIPLIER = 1.5;

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
  // Flips true once Pixi init resolves and the scene is populated.
  // Effect 2 depends on this so it re-runs once the scene becomes ready,
  // even if `visibleEdges` hasn't changed since effect setup.
  const [sceneReady, setSceneReady] = useState(false);

  // Local hover state powers the NodeTooltip overlay. We don't route this
  // through the store because the tooltip is a pure UI detail and we want
  // the hover → tooltip latency to be minimal (direct setState, no global
  // re-render).
  const [hoveredNode, setHoveredNode] = useState<MovieNode | null>(null);

  const nodes = useGraphStore(state => state.nodes);
  const selectMovie = useGraphStore(state => state.selectMovie);
  const { visibleEdges } = useGraphFilters();

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

        // --- hit index for pointer hover/click --------------------------
        // Built once from pinned positions. Radius is the visual-halo
        // extent scaled for a comfortable hit margin.
        const hitNodes = nodes
          .filter(n => n.x != null && n.y != null)
          .map(n => ({
            id: n.id,
            x: n.x as number,
            y: n.y as number,
            radius: getNodeSize(n.rating) * HIT_RADIUS_MULTIPLIER,
          }));
        const hitIndex = buildHitIndex(hitNodes);

        sceneRef.current = {
          edgesLayer,
          nodeById,
          world,
          hitIndex,
          canvas: app.canvas,
        };
        // Flip state so Effect 2 runs its first edge draw now that the
        // scene is populated. React batches this as a state update.
        setSceneReady(true);
        console.log(`StarfieldCanvas: ${starsLayer.children.length} stars rendered`);
      })
      .catch((err: unknown) => {
        console.error('StarfieldCanvas: Pixi init failed', err);
      });

    return () => {
      cancelled = true;
      sceneRef.current = null;
      setSceneReady(false);
      app.destroy(true, { children: true, texture: true });
    };
  }, [nodes]);

  // Effect 2: edge updates. Runs on every filter/selection change AND
  // when scene flips from not-ready to ready (which is when the first
  // edge draw after init happens).
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !sceneReady) return;
    rebuildEdges(scene.edgesLayer, visibleEdges, scene.nodeById);
  }, [visibleEdges, sceneReady]);

  // Effect 3: pointer hit-test. Runs once the scene is ready; rebinds when
  // the node set changes (because the hit index rebuilds with it).
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !sceneReady) return;

    const { canvas, world, hitIndex } = scene;
    let lastHoveredId: number | null = null;
    let pointerDownAt: { x: number; y: number } | null = null;

    const toWorld = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      return {
        x: (sx - world.position.x) / world.scale.x,
        y: (sy - world.position.y) / world.scale.y,
      };
    };

    const onMove = (e: PointerEvent) => {
      const { x, y } = toWorld(e.clientX, e.clientY);
      const hit = hitIndex.pick(x, y);
      const id = hit?.id ?? null;
      if (id !== lastHoveredId) {
        lastHoveredId = id;
        setHoveredNode(id == null ? null : nodes.find(n => n.id === id) ?? null);
      }
    };

    const onDown = (e: PointerEvent) => {
      pointerDownAt = { x: e.clientX, y: e.clientY };
    };

    const onUp = (e: PointerEvent) => {
      if (!pointerDownAt) return;
      const dx = e.clientX - pointerDownAt.x;
      const dy = e.clientY - pointerDownAt.y;
      pointerDownAt = null;
      // Only treat as a click if the pointer barely moved. Otherwise
      // this was a drag and d3-zoom handled it.
      if (Math.hypot(dx, dy) > CLICK_DRAG_THRESHOLD_PX) return;
      const { x, y } = toWorld(e.clientX, e.clientY);
      const hit = hitIndex.pick(x, y);
      if (hit) {
        const node = nodes.find(n => n.id === hit.id);
        if (node) selectMovie(node);
      }
    };

    const onLeave = () => {
      if (lastHoveredId != null) {
        lastHoveredId = null;
        setHoveredNode(null);
      }
    };

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onLeave);

    return () => {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, [nodes, selectMovie, sceneReady]);

  return (
    <>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
      <NodeTooltip node={hoveredNode} />
    </>
  );
};
