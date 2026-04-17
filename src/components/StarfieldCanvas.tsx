import { useEffect, useRef, useState } from 'react';
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { Selection } from 'd3-selection';
import { select } from 'd3-selection';
import type { ZoomBehavior } from 'd3-zoom';
import { zoom as d3Zoom, zoomIdentity, type D3ZoomEvent } from 'd3-zoom';
import { useGraphStore } from '../stores/graphStore';
import { useGraphFilters } from '../hooks/useGraphFilters';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { buildGlowBitmap, hexToTintInt } from '../services/textures';
import { buildHitIndex, type HitIndex } from '../services/hitTest';
import { lodStrengthCutoff } from '../services/viewport';
import { getEdgeColor, getNodeColor, getNodeSize } from '../services/graphBuilder';
import { NodeTooltip } from './NodeTooltip';
import type { MovieEdge, MovieNode } from '../types';

/**
 * Celestial Constellation renderer — clean, crisp graph visualization.
 *
 * Pixi v8 scene graph:
 *   stage
 *     ├─ bgStars   (static viewport stars, no pan/zoom)
 *     └─ world     (pan/zoom transform target)
 *          ├─ edgesLayer   (Graphics, curved bezier edges)
 *          └─ nodesLayer   (Container per node: glow + ring + core + label)
 *
 * Normal blend mode throughout — no additive bleeding. Nodes are crisp
 * circles with a subtle outer glow. Edges are curved, visible bezier
 * paths. Labels appear on hover/selection.
 */

const GLOW_SIZE = 64;
// Glow sprite scale multiplier: glow diameter ≈ node radius × this
const GLOW_SCALE_MULTIPLIER = 4;
// Base glow alpha — subtle, not overwhelming
const GLOW_ALPHA = 0.22;
// Rating threshold for drawing a white accent ring
const RING_RATING_THRESHOLD = 8.0;


// Pointer movement threshold for click vs drag
const CLICK_DRAG_THRESHOLD_PX = 3;
// Hit radius multiplier — larger because nodes are smaller now
const HIT_RADIUS_MULTIPLIER = 2.2;

// Entrance animation
const ENTRANCE_STAGGER_MS = 600;
const ENTRANCE_FADE_MS = 500;

// Focus animation
const FOCUS_TWEEN_MS = 600;
const FOCUS_DIM_ALPHA = 0.12;
const FOCUS_BBOX_PADDING = 160;
const FOCUS_MAX_ZOOM = 1.6;

// Background star count
const BG_STAR_COUNT = 100;

// Edge curvature range in pixels (perpendicular offset)
const EDGE_CURVATURE_MAX = 24;

// Deterministic hash for edge curvature so curves don't jitter on redraw.
const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
};

const getEdgeCurvature = (edgeKey: string): number => {
  const hash = Math.abs(hashString(edgeKey));
  return (hash % 1000) / 1000 * EDGE_CURVATURE_MAX * 2 - EDGE_CURVATURE_MAX;
};

interface NodeRenderData {
  container: Container;
  glow: Sprite;
  ring: Graphics;
  core: Graphics;
  label: Text;
  node: MovieNode;
  baseRadius: number;
  color: number;
}

interface SceneRefs {
  app: Application;
  canvas: HTMLCanvasElement;
  world: Container;
  edgesLayer: Graphics;
  nodesLayer: Container;
  nodeRenders: Map<number, NodeRenderData>;
  nodeById: Map<number, MovieNode>;
  canvasSelection: Selection<HTMLCanvasElement, unknown, null, undefined>;
  d3zoom: ZoomBehavior<HTMLCanvasElement, unknown>;
  viewportWidth: number;
  viewportHeight: number;
  hitIndex: HitIndex;
}

// Simple rAF-driven tween runner.
const tween = (
  durationMs: number,
  onStep: (t: number) => void,
  onDone?: () => void,
): (() => void) => {
  const start = performance.now();
  let rafId = 0;
  let cancelled = false;
  const step = () => {
    if (cancelled) return;
    const raw = (performance.now() - start) / durationMs;
    const t = raw >= 1 ? 1 : raw;
    const eased = 1 - Math.pow(1 - t, 3);
    onStep(eased);
    if (t >= 1) {
      onDone?.();
      return;
    }
    rafId = requestAnimationFrame(step);
  };
  rafId = requestAnimationFrame(step);
  return () => {
    cancelled = true;
    cancelAnimationFrame(rafId);
  };
};

/**
 * Rebuild the edges Graphics from scratch with curved bezier paths.
 */
const rebuildEdges = (
  g: Graphics,
  edges: MovieEdge[],
  nodeById: Map<number, MovieNode>,
  strengthCutoff: number,
) => {
  g.clear();
  for (const e of edges) {
    if (e.strength < strengthCutoff) continue;

    const srcId = typeof e.source === 'number' ? e.source : (e.source as MovieNode).id;
    const tgtId = typeof e.target === 'number' ? e.target : (e.target as MovieNode).id;
    const s = nodeById.get(srcId);
    const t = nodeById.get(tgtId);
    if (!s || !t || s.x == null || s.y == null || t.x == null || t.y == null) continue;

    const strength = e.strength;
    const alpha = 0.25 + Math.min(strength - 1, 3) * 0.10;
    const width = 1.0 + (strength - 1) * 0.40;
    const color = hexToTintInt(getEdgeColor(e.types));

    const key = srcId < tgtId ? `${srcId}-${tgtId}` : `${tgtId}-${srcId}`;
    const curvature = getEdgeCurvature(key);

    const mx = (s.x + t.x) / 2;
    const my = (s.y + t.y) / 2;
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const cx = mx + nx * curvature;
    const cy = my + ny * curvature;

    g.moveTo(s.x, s.y);
    g.quadraticCurveTo(cx, cy, t.x, t.y);
    g.stroke({ color, alpha, width });
  }
};

export const StarfieldCanvas = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneRefs | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<MovieNode | null>(null);

  const nodes = useGraphStore(state => state.nodes);
  const selectMovie = useGraphStore(state => state.selectMovie);
  const selectedMovie = useGraphStore(state => state.selectedMovie);
  const zoom = useGraphStore(state => state.zoom);
  const { visibleEdges } = useGraphFilters();
  const reducedMotion = useReducedMotion();

  // Effect 1: build the entire scene.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (nodes.length === 0) return;

    const app = new Application();
    let cancelled = false;
    let initDone = false;

    app
      .init({
        resizeTo: host,
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      })
      .then(() => {
        initDone = true;
        if (cancelled) {
          app.destroy(true, { children: true, texture: true });
          return;
        }
        host.appendChild(app.canvas);

        // --- background stars (static, on stage, no pan/zoom) ----------
        const bgStars = new Graphics();
        for (let i = 0; i < BG_STAR_COUNT; i++) {
          const x = Math.random() * app.screen.width;
          const y = Math.random() * app.screen.height;
          const r = 0.4 + Math.random() * 0.8;
          const a = 0.1 + Math.random() * 0.25;
          bgStars.circle(x, y, r);
          bgStars.fill({ color: 0xffffff, alpha: a });
        }
        app.stage.addChild(bgStars);

        // --- world container (pan/zoom target) -------------------------
        const world = new Container();
        app.stage.addChild(world);

        const setZoom = useGraphStore.getState().setZoom;
        const d3zoom = d3Zoom<HTMLCanvasElement, unknown>()
          .scaleExtent([0.15, 6])
          .on('zoom', (event: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
            world.position.set(event.transform.x, event.transform.y);
            world.scale.set(event.transform.k);
            setZoom(event.transform.k);
          });
        const sel: Selection<HTMLCanvasElement, unknown, null, undefined> =
          select(app.canvas as HTMLCanvasElement);
        sel.call(d3zoom);
        sel.call(
          d3zoom.transform,
          zoomIdentity.translate(app.screen.width / 2, app.screen.height / 2).scale(1),
        );

        // --- edges layer (behind nodes) --------------------------------
        const edgesLayer = new Graphics();
        world.addChild(edgesLayer);

        // --- nodes layer -----------------------------------------------
        const nodesLayer = new Container();
        world.addChild(nodesLayer);

        const glowTex = Texture.from(buildGlowBitmap(GLOW_SIZE));
        const nodeById = new Map<number, MovieNode>();
        const nodeRenders = new Map<number, NodeRenderData>();
        const nodeContainers: Container[] = [];

        for (const node of nodes) {
          if (node.x == null || node.y == null) continue;
          nodeById.set(node.id, node);

          const radius = getNodeSize(node.rating);
          const color = hexToTintInt(getNodeColor(node.genres));

          const container = new Container();
          container.x = node.x;
          container.y = node.y;
          container.alpha = reducedMotion ? 1 : 0;
          nodesLayer.addChild(container);
          nodeContainers.push(container);

          // Glow sprite (subtle, normal blend)
          const glow = new Sprite(glowTex);
          glow.anchor.set(0.5);
          const glowDiameter = radius * GLOW_SCALE_MULTIPLIER;
          glow.scale.set(glowDiameter / GLOW_SIZE);
          glow.tint = color;
          glow.alpha = GLOW_ALPHA;
          glow.blendMode = 'normal';
          container.addChild(glow);

          // Accent ring (hidden by default)
          const ring = new Graphics();
          ring.circle(0, 0, radius + 2.5);
          ring.stroke({ color: 0xffffff, width: 1.5, alpha: 0.9 });
          ring.visible = false;
          container.addChild(ring);

          // Core circle (crisp fill + stroke)
          const core = new Graphics();
          core.circle(0, 0, radius);
          core.fill({ color });
          core.stroke({ color, width: 1, alpha: 0.7 });
          container.addChild(core);

          // Label (hidden by default)
          const label = new Text({
            text: node.title,
            style: {
              fontFamily: 'JetBrains Mono, ui-monospace, Menlo, Consolas, monospace',
              fontSize: 10,
              fill: 0xfffbe6,
              align: 'center',
            },
          });
          label.anchor.set(0.5, 0);
          label.y = radius + 5;
          label.alpha = 0.85;
          label.visible = false;
          label.resolution = Math.min(window.devicePixelRatio || 1, 2);
          container.addChild(label);

          // Pre-show ring for high-rated nodes
          if (node.rating >= RING_RATING_THRESHOLD) {
            ring.visible = true;
            ring.clear();
            ring.circle(0, 0, radius + 2.5);
            ring.stroke({ color: 0xffffff, width: 1.5, alpha: 0.35 });
          }

          nodeRenders.set(node.id, {
            container,
            glow,
            ring,
            core,
            label,
            node,
            baseRadius: radius,
            color,
          });
        }

        // --- entrance animation ----------------------------------------
        if (!reducedMotion) {
          const startMs = performance.now();
          const delays = nodeContainers.map(() => Math.random() * ENTRANCE_STAGGER_MS);
          const entranceTick = () => {
            const elapsed = performance.now() - startMs;
            let allDone = true;
            for (let i = 0; i < nodeContainers.length; i++) {
              const t = (elapsed - delays[i]) / ENTRANCE_FADE_MS;
              if (t < 0) {
                nodeContainers[i].alpha = 0;
                allDone = false;
              } else if (t < 1) {
                const eased = 1 - Math.pow(1 - t, 3);
                nodeContainers[i].alpha = eased;
                allDone = false;
              } else {
                nodeContainers[i].alpha = 1;
              }
            }
            if (allDone) app.ticker.remove(entranceTick);
          };
          app.ticker.add(entranceTick);
        }

        // --- hit index -------------------------------------------------
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
          app,
          canvas: app.canvas,
          world,
          edgesLayer,
          nodesLayer,
          nodeRenders,
          nodeById,
          canvasSelection: sel,
          d3zoom,
          viewportWidth: app.screen.width,
          viewportHeight: app.screen.height,
          hitIndex,
        };
        setSceneReady(true);
        console.log(`StarfieldCanvas: ${nodeContainers.length} nodes rendered`);
      })
      .catch((err: unknown) => {
        console.error('StarfieldCanvas: Pixi init failed', err);
      });

    return () => {
      cancelled = true;
      sceneRef.current = null;
      setSceneReady(false);
      if (initDone) {
        app.destroy(true, { children: true, texture: true });
      }
    };
  }, [nodes, reducedMotion]);

  // Effect 2: rebuild edges on filter/selection/zoom change.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !sceneReady) return;
    rebuildEdges(scene.edgesLayer, visibleEdges, scene.nodeById, lodStrengthCutoff(zoom));
  }, [visibleEdges, sceneReady, zoom]);

  // Effect 3: pointer hit-test.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !sceneReady) return;

    const { canvas, world, hitIndex, nodeRenders } = scene;
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
        // Reset previous hover
        if (lastHoveredId != null) {
          const prev = nodeRenders.get(lastHoveredId);
          if (prev) {
            prev.container.scale.set(1);
            if (selectedMovie?.id !== lastHoveredId) {
              prev.label.visible = false;
            }
          }
        }

        lastHoveredId = id;
        setHoveredNode(id == null ? null : nodes.find(n => n.id === id) ?? null);

        // Apply new hover
        if (id != null) {
          const next = nodeRenders.get(id);
          if (next) {
            next.container.scale.set(1.25);
            next.label.visible = true;
          }
        }
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
        const prev = nodeRenders.get(lastHoveredId);
        if (prev) {
          prev.container.scale.set(1);
          if (selectedMovie?.id !== lastHoveredId) {
            prev.label.visible = false;
          }
        }
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
  }, [nodes, selectMovie, sceneReady, selectedMovie]);

  // Effect 4: focus animation on selectedMovie change.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !sceneReady) return;

    const { nodeRenders, nodeById, canvasSelection, d3zoom, viewportWidth, viewportHeight } = scene;

    const connectedIds = selectedMovie
      ? new Set<number>([
          selectedMovie.id,
          ...useGraphStore.getState().getConnectedMovieIds(selectedMovie.id),
        ])
      : null;

    // --- node alpha & ring & label tween ----------------------------
    const startAlphas = new Map<number, number>();
    const targetAlphas = new Map<number, number>();
    const startScales = new Map<number, number>();
    const targetScales = new Map<number, number>();

    for (const [id, data] of nodeRenders) {
      startAlphas.set(id, data.container.alpha);
      startScales.set(id, data.container.scale.x);

      if (!connectedIds) {
        // No focus: full visibility
        targetAlphas.set(id, 1);
        targetScales.set(id, 1);
      } else if (connectedIds.has(id)) {
        targetAlphas.set(id, 1);
        targetScales.set(id, selectedMovie && id === selectedMovie.id ? 1.35 : 1.15);
      } else {
        targetAlphas.set(id, FOCUS_DIM_ALPHA);
        targetScales.set(id, 0.85);
      }
    }

    const cancelAlphaTween = reducedMotion
      ? (() => {
          for (const [id, data] of nodeRenders) {
            const ta = targetAlphas.get(id) ?? 1;
            const ts = targetScales.get(id) ?? 1;
            data.container.alpha = ta;
            data.container.scale.set(ts);
            // Ring logic
            if (selectedMovie) {
              if (connectedIds?.has(id)) {
                data.ring.visible = true;
                data.ring.clear();
                if (id === selectedMovie.id) {
                  data.ring.circle(0, 0, data.baseRadius + 3.5);
                  data.ring.stroke({ color: 0xffffff, width: 2, alpha: 0.9 });
                  data.glow.alpha = 0.5;
                } else {
                  data.ring.circle(0, 0, data.baseRadius + 2.5);
                  data.ring.stroke({ color: 0xffffff, width: 1.5, alpha: 0.5 });
                  data.glow.alpha = GLOW_ALPHA;
                }
                data.label.visible = true;
              } else {
                data.ring.visible = false;
                data.label.visible = false;
                data.glow.alpha = GLOW_ALPHA;
              }
            } else {
              // Deselect: restore default ring for high-rated nodes
              if (data.node.rating >= RING_RATING_THRESHOLD) {
                data.ring.visible = true;
                data.ring.clear();
                data.ring.circle(0, 0, data.baseRadius + 2.5);
                data.ring.stroke({ color: 0xffffff, width: 1.5, alpha: 0.35 });
              } else {
                data.ring.visible = false;
              }
              data.label.visible = false;
              data.glow.alpha = GLOW_ALPHA;
            }
          }
          return () => {};
        })()
      : tween(FOCUS_TWEEN_MS, (eased) => {
          for (const [id, data] of nodeRenders) {
            const sa = startAlphas.get(id) ?? 1;
            const ta = targetAlphas.get(id) ?? 1;
            const ss = startScales.get(id) ?? 1;
            const ts = targetScales.get(id) ?? 1;
            data.container.alpha = sa + (ta - sa) * eased;
            const s = ss + (ts - ss) * eased;
            data.container.scale.set(s);
          }
        }, () => {
          // Tween complete: set final ring/label states
          for (const [id, data] of nodeRenders) {
            if (selectedMovie) {
              if (connectedIds?.has(id)) {
                data.ring.visible = true;
                data.ring.clear();
                if (id === selectedMovie.id) {
                  data.ring.circle(0, 0, data.baseRadius + 3.5);
                  data.ring.stroke({ color: 0xffffff, width: 2, alpha: 0.9 });
                  data.glow.alpha = 0.5;
                } else {
                  data.ring.circle(0, 0, data.baseRadius + 2.5);
                  data.ring.stroke({ color: 0xffffff, width: 1.5, alpha: 0.5 });
                  data.glow.alpha = GLOW_ALPHA;
                }
                data.label.visible = true;
              } else {
                data.ring.visible = false;
                data.label.visible = false;
                data.glow.alpha = GLOW_ALPHA;
              }
            } else {
              if (data.node.rating >= RING_RATING_THRESHOLD) {
                data.ring.visible = true;
                data.ring.clear();
                data.ring.circle(0, 0, data.baseRadius + 2.5);
                data.ring.stroke({ color: 0xffffff, width: 1.5, alpha: 0.35 });
              } else {
                data.ring.visible = false;
              }
              data.label.visible = false;
              data.glow.alpha = GLOW_ALPHA;
            }
          }
        });

    // --- camera tween to neighborhood bbox --------------------------
    let cancelCameraTween: (() => void) | null = null;
    if (selectedMovie && connectedIds) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const id of connectedIds) {
        const n = nodeById.get(id);
        if (!n || n.x == null || n.y == null) continue;
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x > maxX) maxX = n.x;
        if (n.y > maxY) maxY = n.y;
      }
      if (isFinite(minX)) {
        const bboxW = Math.max(maxX - minX, 1);
        const bboxH = Math.max(maxY - minY, 1);
        const availW = viewportWidth - FOCUS_BBOX_PADDING * 2;
        const availH = viewportHeight - FOCUS_BBOX_PADDING * 2;
        const targetK = Math.min(availW / bboxW, availH / bboxH, FOCUS_MAX_ZOOM);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const targetX = viewportWidth / 2 - centerX * targetK;
        const targetY = viewportHeight / 2 - centerY * targetK;
        const targetTransform = zoomIdentity.translate(targetX, targetY).scale(targetK);

        if (reducedMotion) {
          canvasSelection.call(d3zoom.transform, targetTransform);
        } else {
          const startX = scene.world.position.x;
          const startY = scene.world.position.y;
          const startK = scene.world.scale.x;
          cancelCameraTween = tween(FOCUS_TWEEN_MS, (eased) => {
            const nx = startX + (targetX - startX) * eased;
            const ny = startY + (targetY - startY) * eased;
            const nk = startK + (targetK - startK) * eased;
            canvasSelection.call(
              d3zoom.transform,
              zoomIdentity.translate(nx, ny).scale(nk),
            );
          });
        }
      }
    }

    return () => {
      cancelAlphaTween();
      cancelCameraTween?.();
    };
  }, [selectedMovie, sceneReady, reducedMotion]);

  // Effect 5: pause ticker after idle to save battery.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !sceneReady) return;

    const { app, canvas } = scene;
    const safeAfter = performance.now() + ENTRANCE_STAGGER_MS + ENTRANCE_FADE_MS;
    let idleTimer: number | null = null;

    const wake = () => {
      if (!app.ticker.started) app.ticker.start();
      if (idleTimer != null) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        if (performance.now() < safeAfter) { wake(); return; }
        app.ticker.stop();
      }, 1000);
    };

    canvas.addEventListener('pointermove', wake);
    canvas.addEventListener('wheel', wake);
    canvas.addEventListener('pointerdown', wake);

    return () => {
      canvas.removeEventListener('pointermove', wake);
      canvas.removeEventListener('wheel', wake);
      canvas.removeEventListener('pointerdown', wake);
      if (idleTimer != null) window.clearTimeout(idleTimer);
    };
  }, [sceneReady]);

  return (
    <>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
      <NodeTooltip node={hoveredNode} />
    </>
  );
};
