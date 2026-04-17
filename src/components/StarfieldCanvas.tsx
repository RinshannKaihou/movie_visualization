import { useEffect, useRef, useState } from 'react';
import { Application, BlurFilter, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { Selection } from 'd3-selection';
import { select } from 'd3-selection';
import type { ZoomBehavior } from 'd3-zoom';
import { zoom as d3Zoom, zoomIdentity, type D3ZoomEvent } from 'd3-zoom';
import { useGraphStore } from '../stores/graphStore';
import { useGraphFilters } from '../hooks/useGraphFilters';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { buildHaloBitmap, hexToTintInt } from '../services/textures';
import { buildNebulaBitmap } from '../services/nebulaTexture';
import { buildDiffractionBitmap } from '../services/diffractionTexture';
import { buildHitIndex, type HitIndex } from '../services/hitTest';
import { lodStrengthCutoff } from '../services/viewport';
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
// Diffraction sprite dimension. Bigger than the halo core so the rays
// protrude cleanly; scaled by rating so brighter stars have longer rays.
const DIFFRACTION_SIZE = 192;
// Only stars rated this high wear diffraction spikes. Keeps the visual
// clean on the dense mid-rated cluster while marking standouts.
const DIFFRACTION_RATING_THRESHOLD = 7.5;
// Spike sprite draw diameter ≈ halo diameter × this multiplier.
const DIFFRACTION_SCALE_MULTIPLIER = 8;
// Empirical multiplier: sprite diameter ≈ 6 × base-rating radius. The
// halo's Gaussian falloff means the visible extent is smaller than the
// full sprite bounds, so this factor makes the visible halo match the
// intended star radius.
const STAR_SCALE_MULTIPLIER = 6;

interface PhotonState {
  sprite: Sprite;
  srcX: number;
  srcY: number;
  tgtX: number;
  tgtY: number;
  // Color matches edge type; set once per photon.
  color: number;
  // Progress along the edge in [0, 1). Wraps at 1.
  t: number;
}

interface SceneRefs {
  edgesLayer: Graphics;
  focusedEdgesLayer: Graphics;
  photonsLayer: Container;
  photonTex: Texture;
  starSprites: Sprite[];
  nodeById: Map<number, MovieNode>;
  world: Container;
  hitIndex: HitIndex;
  canvas: HTMLCanvasElement;
  canvasSelection: Selection<HTMLCanvasElement, unknown, null, undefined>;
  d3zoom: ZoomBehavior<HTMLCanvasElement, unknown>;
  viewportWidth: number;
  viewportHeight: number;
  app: Application;
  nebula: Sprite;
  nebulaCenterX: number;
  nebulaCenterY: number;
}

// Pointer movement in screen pixels below which a pointerup is treated as
// a click rather than a drag-release. d3-zoom handles drags but emits no
// event for a short press-release, so we disambiguate ourselves.
const CLICK_DRAG_THRESHOLD_PX = 3;
// Hit radius multiplier relative to visual radius. Tuned so pointers near
// (not on) a star still register; tighter feels sticky, looser catches air.
const HIT_RADIUS_MULTIPLIER = 1.5;
// Entrance animation: total window during which every star has faded in.
// We pick a staggered per-star delay in [0, ENTRANCE_STAGGER_MS] and a
// fixed ENTRANCE_FADE_MS fade duration, so the last star is fully visible
// at STAGGER + FADE ≈ 1.6 s.
const ENTRANCE_STAGGER_MS = 800;
const ENTRANCE_FADE_MS = 800;

// Focus animation constants.
const FOCUS_TWEEN_MS = 700;
// Non-connected stars dim to this alpha when a movie is focused.
const FOCUS_DIM_ALPHA = 0.22;
// Pixels of viewport padding around the focused neighborhood bbox.
const FOCUS_BBOX_PADDING = 160;
// Minimum zoom level the camera will settle on when a focused neighborhood
// is very small; prevents zooming in absurdly close on isolated nodes.
const FOCUS_MAX_ZOOM = 1.6;
// Gaussian blur strength for the focused-edge bloom layer.
const FOCUS_EDGE_BLUR = 3;
// Twinkle amplitude (peak deviation from the sprite's base alpha). Kept
// small so the effect reads as "alive" rather than "strobing". Together
// with TWINKLE_SPEED the motion averages out to a gentle breathing.
const TWINKLE_AMPLITUDE = 0.06;
const TWINKLE_SPEED = 0.0009; // radians per ms; period ≈ 7s at phase 0

// Sprites carry an extra `__baseAlpha` numeric so entrance, focus-dim, and
// twinkle can layer: entrance writes sprite.alpha directly during the
// fade-in; focus-dim writes __baseAlpha; twinkle multiplies
// sprite.alpha = __baseAlpha * twinkleFactor each frame.
type StarSpriteExtra = Sprite & { __baseAlpha?: number; __twinklePhase?: number };

// Number of strongest edges from the focused movie that emit photons.
const PHOTON_EDGE_COUNT = 3;
// Per-photon advance per ms along the (source -> target) segment.
// At 0.0005 a photon crosses an edge in 2s; three photons per edge spaced
// evenly at 0.33 phase gives a "beads on a string" effect.
const PHOTON_SPEED = 0.0005;
const PHOTONS_PER_EDGE = 3;
const PHOTON_SCALE = 0.14;

// Maximum nebula offset from center in pixels. The nebula drifts the
// opposite direction of the cursor — classic parallax sense of depth.
const PARALLAX_MAX_OFFSET = 18;
// Inertia factor for cursor-tracking. Each frame the nebula position
// eases toward the target by this fraction; lower = more lag.
const PARALLAX_EASE = 0.06;

// Simple rAF-driven tween runner. No dependency needed; used for star-alpha
// fades and the camera neighborhood pan. Returns an abort function.
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
    // easeOutCubic — fast departure, gentle settle.
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
 * Rebuild the single edge Graphics from scratch. Pixi v8 has no in-place
 * segment mutation — you clear() and replay. At 2000 edges, this is in
 * the microseconds; it runs only on filter/selection/zoom change, not per
 * frame.
 *
 * The zoom-based `strengthCutoff` skips edges whose strength is too weak
 * at the current zoom level: at extreme zoom-out only the strongest
 * connections are drawn, to keep the visual readable.
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
  const selectedMovie = useGraphStore(state => state.selectedMovie);
  const zoom = useGraphStore(state => state.zoom);
  const { visibleEdges } = useGraphFilters();
  const reducedMotion = useReducedMotion();

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

        // --- nebula backdrop --------------------------------------------
        // Sits on the stage directly, BEHIND the world container, so the
        // nebula does not scroll along with pan/zoom. Size is chosen once;
        // we center it on the viewport. Subtle drift handled in Task 4.8
        // (parallax) — here the nebula is static.
        const nebulaTex = Texture.from(buildNebulaBitmap(2048, 1024));
        const nebula = new Sprite(nebulaTex);
        nebula.anchor.set(0.5);
        nebula.alpha = 0.55;
        nebula.x = app.screen.width / 2;
        nebula.y = app.screen.height / 2;
        app.stage.addChild(nebula);

        // --- stardust field (tiny background stars, static behind world) ---
        // Replaces the standalone StardustField canvas. Uses the same halo
        // texture at tiny scale so stardust shares the GPU batch with stars.
        const dustTex = Texture.from(buildHaloBitmap(32));
        const stardustLayer = new Container();
        app.stage.addChildAt(stardustLayer, app.stage.getChildIndex(nebula) + 1);
        const STARDUST_DENSITY = 1 / 8000;
        const stardustCount = Math.min(
          Math.floor(app.screen.width * app.screen.height * STARDUST_DENSITY),
          500,
        );
        const dustSprites: StarSpriteExtra[] = [];
        for (let i = 0; i < stardustCount; i++) {
          const s: StarSpriteExtra = new Sprite(dustTex);
          s.anchor.set(0.5);
          s.blendMode = 'add';
          s.scale.set(0.08 + Math.random() * 0.15);
          s.__baseAlpha = 0.3 + Math.random() * 0.5;
          s.alpha = s.__baseAlpha;
          s.__twinklePhase = Math.random() * Math.PI * 2;
          s.x = Math.random() * app.screen.width;
          s.y = Math.random() * app.screen.height;
          stardustLayer.addChild(s);
          dustSprites.push(s);
        }

        if (!reducedMotion && dustSprites.length > 0) {
          const dustTwinkleSpeed = 0.0004; // slower than main stars
          const dustTick = (ticker: { lastTime: number }) => {
            const t = ticker.lastTime;
            for (let i = 0; i < dustSprites.length; i++) {
              const s = dustSprites[i];
              const base = s.__baseAlpha ?? 0.5;
              const phase = s.__twinklePhase ?? 0;
              const wobble = 1 - TWINKLE_AMPLITUDE
                + Math.sin(t * dustTwinkleSpeed + phase) * TWINKLE_AMPLITUDE;
              s.alpha = base * wobble;
            }
          };
          app.ticker.add(dustTick);
        }

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
        const sel: Selection<HTMLCanvasElement, unknown, null, undefined> =
          select(app.canvas as HTMLCanvasElement);
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

        // --- focused edges (bloom layer for connected-movie edges) ------
        // Separate Graphics with a BlurFilter so the bloom affects only
        // the selected movie's connections, not the baseline web.
        const focusedEdgesLayer = new Graphics();
        focusedEdgesLayer.blendMode = 'add';
        focusedEdgesLayer.filters = [new BlurFilter({ strength: FOCUS_EDGE_BLUR })];
        world.addChild(focusedEdgesLayer);

        // --- photon layer (focused-only beads flowing along strong edges) -
        // Reuses the halo texture at a tiny scale so photons share the
        // GPU batch with the star sprites. Populated/drained by Effect 4.
        const photonsLayer = new Container();
        world.addChild(photonsLayer);
        const photonTex = haloTex;

        // --- stars --------------------------------------------------------
        // Shared diffraction texture built once; each high-rating sprite
        // gets a spike child so alpha (twinkle, focus dim, entrance)
        // inherits automatically through the scene graph.
        const diffractionTex = Texture.from(buildDiffractionBitmap(DIFFRACTION_SIZE));
        const starsLayer = new Container();
        world.addChild(starsLayer);

        const nodeById = new Map<number, MovieNode>();
        // Per-sprite birth delay for the entrance fade-in. Parallel array to
        // starsLayer.children so we can read both cheaply in the ticker.
        const starSprites: Sprite[] = [];
        const starBirthDelays: number[] = [];

        for (const node of nodes) {
          if (node.x == null || node.y == null) continue;
          nodeById.set(node.id, node);

          const sprite: StarSpriteExtra = new Sprite(haloTex);
          sprite.anchor.set(0.5);
          const radius = getNodeSize(node.rating);
          const drawDiameter = radius * STAR_SCALE_MULTIPLIER;
          sprite.scale.set(drawDiameter / HALO_SIZE);
          sprite.tint = hexToTintInt(getNodeColor(node.genres));
          sprite.blendMode = 'add';
          sprite.x = node.x;
          sprite.y = node.y;
          sprite.alpha = reducedMotion ? 1 : 0;
          // Focus effect uses __baseAlpha; twinkle multiplies against it.
          sprite.__baseAlpha = 1;
          sprite.__twinklePhase = Math.random() * Math.PI * 2;
          starsLayer.addChild(sprite);
          starSprites.push(sprite);
          starBirthDelays.push(Math.random() * ENTRANCE_STAGGER_MS);

          // Diffraction spikes only on the bright stars. The spike is a
          // CHILD of the halo sprite so alpha (entrance, twinkle, focus
          // dim) inherits for free through the Pixi scene graph. Spike's
          // local (x, y) is (0, 0) relative to the parent halo.
          if (node.rating >= DIFFRACTION_RATING_THRESHOLD) {
            const spike = new Sprite(diffractionTex);
            spike.anchor.set(0.5);
            // Spike diameter relative to halo diameter. Bright stars get
            // longer rays. Because spike is a child of a halo that is
            // itself scaled by radius/HALO_SIZE, we divide to get the
            // spike scale in the parent's LOCAL space.
            const ratingBonus = (node.rating - DIFFRACTION_RATING_THRESHOLD) * 0.3;
            const spikeDiameter = radius * DIFFRACTION_SCALE_MULTIPLIER * (1 + ratingBonus);
            const haloLocalScale = drawDiameter / HALO_SIZE;
            spike.scale.set(spikeDiameter / DIFFRACTION_SIZE / haloLocalScale);
            spike.alpha = 0.65; // constant; inherits host sprite's alpha
            // Spike tint starts pure white — halo tints via parent, and
            // additive blend keeps them in the halo's spectral family.
            spike.blendMode = 'add';
            sprite.addChild(spike);
          }
        }

        // --- entrance animation -----------------------------------------
        // Skip entirely under prefers-reduced-motion: sprites are already
        // full-alpha and no ticker cost is incurred. Twinkle also skips
        // under reducedMotion.
        if (!reducedMotion) {
          const startMs = performance.now();
          const entranceTick = () => {
            const elapsed = performance.now() - startMs;
            let stillAnimating = false;
            for (let i = 0; i < starSprites.length; i++) {
              const delay = starBirthDelays[i];
              const t = (elapsed - delay) / ENTRANCE_FADE_MS;
              if (t >= 1) {
                starSprites[i].alpha = 1;
              } else if (t > 0) {
                // easeOutCubic — pops then settles rather than linear.
                const eased = 1 - Math.pow(1 - t, 3);
                starSprites[i].alpha = eased;
                stillAnimating = true;
              } else {
                stillAnimating = true;
              }
            }
            if (!stillAnimating) {
              app.ticker.remove(entranceTick);
              // Hand off to the twinkle ticker. It reads __baseAlpha
              // (set by scene build and updated by the focus effect) and
              // multiplies by a gentle per-star sinusoid.
              const twinkleTick = (ticker: { lastTime: number }) => {
                const t2 = ticker.lastTime;
                for (let i = 0; i < starSprites.length; i++) {
                  const sprite = starSprites[i] as StarSpriteExtra;
                  const base = sprite.__baseAlpha ?? 1;
                  const phase = sprite.__twinklePhase ?? 0;
                  const wobble = 1 - TWINKLE_AMPLITUDE
                    + Math.sin(t2 * TWINKLE_SPEED + phase) * TWINKLE_AMPLITUDE;
                  sprite.alpha = base * wobble;
                }
              };
              app.ticker.add(twinkleTick);
            }
          };
          app.ticker.add(entranceTick);
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
          focusedEdgesLayer,
          photonsLayer,
          photonTex,
          starSprites,
          nodeById,
          world,
          hitIndex,
          canvas: app.canvas,
          canvasSelection: sel,
          d3zoom,
          viewportWidth: app.screen.width,
          viewportHeight: app.screen.height,
          app,
          nebula,
          nebulaCenterX: app.screen.width / 2,
          nebulaCenterY: app.screen.height / 2,
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
  }, [nodes, reducedMotion]);

  // Effect 2: edge updates. Runs on filter/selection change, on scene
  // ready, and on zoom change (zoom drives the LOD strength cutoff).
  // Rebuild cost ~1ms for 2000 edges; we do not debounce because d3-zoom
  // already coalesces wheel events.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !sceneReady) return;
    rebuildEdges(scene.edgesLayer, visibleEdges, scene.nodeById, lodStrengthCutoff(zoom));
  }, [visibleEdges, sceneReady, zoom]);

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

  // Effect 4: focus animation. When selectedMovie changes, dim non-connected
  // stars, draw a bloomed overlay for the selected movie's edges, and pan
  // the camera to frame the neighborhood. Deselection reverses the dim and
  // clears the bloom; camera stays where the user left it.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !sceneReady) return;

    const {
      focusedEdgesLayer,
      photonsLayer,
      photonTex,
      starSprites,
      nodeById,
      canvasSelection,
      d3zoom,
      viewportWidth,
      viewportHeight,
      app,
    } = scene;

    // Compute the ID set we want visible at full brightness.
    const connectedIds = selectedMovie
      ? new Set<number>([
          selectedMovie.id,
          ...useGraphStore.getState().getConnectedMovieIds(selectedMovie.id),
        ])
      : null;

    // --- star alpha tween ------------------------------------------------
    // Each sprite's target alpha is 1 when no focus, or when it is the
    // selected movie or one of its connections. Otherwise dim.
    // We need a sprite-index -> node-id mapping. The scene build insertion
    // order matches `nodes.filter(n => n.x != null && n.y != null)`, so we
    // cache that id list on the sprite array once per scene build.
    type SpriteIdCache = Sprite[] & { __ids?: number[] };
    const cache = starSprites as SpriteIdCache;
    if (!cache.__ids) {
      const ids: number[] = [];
      for (const node of nodeById.values()) {
        if (node.x != null && node.y != null) ids.push(node.id);
      }
      cache.__ids = ids;
    }
    const spriteIds = cache.__ids;
    // Focus tweens __baseAlpha, not sprite.alpha. Twinkle ticker multiplies
    // __baseAlpha by a wobble each frame; under reducedMotion (twinkle off)
    // we also write alpha so the dim is visible without a ticker.
    const startBaseAlphas = starSprites.map(s => (s as StarSpriteExtra).__baseAlpha ?? 1);
    const targetBaseAlphas = starSprites.map((_, i) =>
      !connectedIds || connectedIds.has(spriteIds[i]) ? 1 : FOCUS_DIM_ALPHA,
    );

    const cancelAlphaTween = reducedMotion
      ? (() => {
          for (let i = 0; i < starSprites.length; i++) {
            const s = starSprites[i] as StarSpriteExtra;
            s.__baseAlpha = targetBaseAlphas[i];
            s.alpha = targetBaseAlphas[i];
          }
          return () => {};
        })()
      : tween(FOCUS_TWEEN_MS, (eased) => {
          for (let i = 0; i < starSprites.length; i++) {
            const s = starSprites[i] as StarSpriteExtra;
            s.__baseAlpha = startBaseAlphas[i] + (targetBaseAlphas[i] - startBaseAlphas[i]) * eased;
          }
        });

    // --- focused-edge bloom + photons -----------------------------------
    focusedEdgesLayer.clear();
    // Tear down any previous photons — they belonged to the prior focus.
    for (const child of photonsLayer.children) child.destroy();
    photonsLayer.removeChildren();
    const photons: PhotonState[] = [];

    if (selectedMovie) {
      const edges = useGraphStore.getState().getConnectedEdges(selectedMovie.id);
      // Render the full bloomed edge set.
      for (const e of edges) {
        const srcId = typeof e.source === 'number' ? e.source : (e.source as MovieNode).id;
        const tgtId = typeof e.target === 'number' ? e.target : (e.target as MovieNode).id;
        const s = nodeById.get(srcId);
        const t = nodeById.get(tgtId);
        if (!s || !t || s.x == null || s.y == null || t.x == null || t.y == null) continue;
        const color = hexToTintInt(getEdgeColor(e.types));
        focusedEdgesLayer.moveTo(s.x, s.y);
        focusedEdgesLayer.lineTo(t.x, t.y);
        focusedEdgesLayer.stroke({ color, alpha: 0.9, width: 1.6 + e.strength * 0.5 });
      }

      // Seed photons on the top-N strongest connected edges. Each edge gets
      // PHOTONS_PER_EDGE photons phase-offset so they feel continuous.
      const strongest = [...edges]
        .sort((a, b) => b.strength - a.strength)
        .slice(0, PHOTON_EDGE_COUNT);
      for (const e of strongest) {
        const srcId = typeof e.source === 'number' ? e.source : (e.source as MovieNode).id;
        const tgtId = typeof e.target === 'number' ? e.target : (e.target as MovieNode).id;
        const s = nodeById.get(srcId);
        const t = nodeById.get(tgtId);
        if (!s || !t || s.x == null || s.y == null || t.x == null || t.y == null) continue;
        const color = hexToTintInt(getEdgeColor(e.types));
        // Direction: photons always flow from the selected movie outward.
        const outward = srcId === selectedMovie.id
          ? { ax: s.x, ay: s.y, bx: t.x, by: t.y }
          : { ax: t.x, ay: t.y, bx: s.x, by: s.y };
        for (let k = 0; k < PHOTONS_PER_EDGE; k++) {
          const sprite = new Sprite(photonTex);
          sprite.anchor.set(0.5);
          sprite.tint = color;
          sprite.blendMode = 'add';
          sprite.scale.set(PHOTON_SCALE);
          photonsLayer.addChild(sprite);
          photons.push({
            sprite,
            srcX: outward.ax,
            srcY: outward.ay,
            tgtX: outward.bx,
            tgtY: outward.by,
            color,
            t: (k / PHOTONS_PER_EDGE) % 1,
          });
        }
      }
    }

    // Ticker advances every photon each frame. Callback removes itself
    // when the photon array is empty (on deselect).
    let photonTick: ((ticker: { deltaMS: number }) => void) | null = null;
    if (photons.length > 0) {
      photonTick = (ticker: { deltaMS: number }) => {
        for (const p of photons) {
          p.t = (p.t + PHOTON_SPEED * ticker.deltaMS) % 1;
          p.sprite.x = p.srcX + (p.tgtX - p.srcX) * p.t;
          p.sprite.y = p.srcY + (p.tgtY - p.srcY) * p.t;
          // Fade in the first 15% and fade out the last 15% so photons
          // don't pop in/out at the endpoints.
          const fade = p.t < 0.15 ? p.t / 0.15 : p.t > 0.85 ? (1 - p.t) / 0.15 : 1;
          p.sprite.alpha = fade;
        }
      };
      app.ticker.add(photonTick);
    }

    // --- camera tween to neighborhood bbox ------------------------------
    let cancelCameraTween: (() => void) | null = null;
    if (selectedMovie && connectedIds) {
      // Compute bbox of selected + connected in world coords.
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
          // Hand-rolled tween from the current d3-zoom transform to
          // targetTransform. We interpolate the (x, y, k) triple and set
          // it on d3-zoom each frame so the store's zoom value and the
          // user's subsequent wheel/drag gestures stay consistent.
          // Read current transform via the world container (kept in sync
          // by the zoom handler).
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
      if (photonTick) app.ticker.remove(photonTick);
      for (const p of photons) p.sprite.destroy();
    };
  }, [selectedMovie, sceneReady, reducedMotion]);

  // Effect 5: mouse parallax on the nebula backdrop. Nebula drifts by up
  // to PARALLAX_MAX_OFFSET pixels AWAY from the cursor (opposite direction
  // gives the "cursor is in front, backdrop is behind" depth cue).
  // Skips entirely under prefers-reduced-motion.
  useEffect(() => {
    if (reducedMotion) return;
    const scene = sceneRef.current;
    if (!scene || !sceneReady) return;

    const { canvas, nebula, nebulaCenterX, nebulaCenterY, app } = scene;
    let targetOffsetX = 0;
    let targetOffsetY = 0;
    let currentOffsetX = 0;
    let currentOffsetY = 0;

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      // Normalize cursor to [-1, 1] in each axis, then invert for the
      // opposite-direction drift.
      const nx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const ny = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
      targetOffsetX = -nx * PARALLAX_MAX_OFFSET;
      targetOffsetY = -ny * PARALLAX_MAX_OFFSET;
    };

    const parallaxTick = () => {
      currentOffsetX += (targetOffsetX - currentOffsetX) * PARALLAX_EASE;
      currentOffsetY += (targetOffsetY - currentOffsetY) * PARALLAX_EASE;
      nebula.x = nebulaCenterX + currentOffsetX;
      nebula.y = nebulaCenterY + currentOffsetY;
    };

    canvas.addEventListener('pointermove', onMove);
    app.ticker.add(parallaxTick);

    return () => {
      canvas.removeEventListener('pointermove', onMove);
      app.ticker.remove(parallaxTick);
    };
  }, [sceneReady, reducedMotion]);

  // Effect 6: pause Pixi ticker after 1s idle to save battery.
  // Re-wakes on any pointer/wheel/pointerdown event. Skips pausing
  // while a movie is selected — photons need the ticker to animate.
  // A timestamp guard prevents pausing during the entrance animation
  // (~1.6s from scene build), since stars start at alpha 0.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !sceneReady) return;

    const { app, canvas } = scene;
    const safeAfter = performance.now() + ENTRANCE_STAGGER_MS + ENTRANCE_FADE_MS;
    let idleTimer: number | null = null;

    const wake = () => {
      if (!app.ticker.started) app.ticker.start();
      if (idleTimer != null) window.clearTimeout(idleTimer);
      // Guard: do not schedule pause while photons are flowing.
      if (useGraphStore.getState().selectedMovie) return;
      idleTimer = window.setTimeout(() => {
        // Entrance may still be running; reschedule instead of pausing.
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

  // Re-wake ticker when selectedMovie changes so photons animate.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !sceneReady) return;
    if (selectedMovie && !scene.app.ticker.started) {
      scene.app.ticker.start();
    }
  }, [selectedMovie, sceneReady]);

  return (
    <>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
      <NodeTooltip node={hoveredNode} />
    </>
  );
};
