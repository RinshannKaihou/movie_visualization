import { Application, BitmapFont, BitmapText, Cache, CanvasSource, Container, Graphics, Sprite, Texture, Ticker, TilingSprite } from 'pixi.js';
import { select, type Selection } from 'd3-selection';
import { zoom as d3Zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior } from 'd3-zoom';
import { interpolateZoom } from 'd3-interpolate';
import type { Dataset } from '../core/types.ts';
import { ALL_CONNECTIONS_MASK } from '../core/connections.ts';
import { otherEnd } from '../core/dataset.ts';
import { familyColor } from '../core/genres.ts';
import { buildDiscBitmap, buildDustBitmap, buildGlowBitmap, hexToTintInt } from './textures.ts';
import { buildHitIndex, type HitIndex } from './hitTest.ts';
import { boundsOf, fitTransform, screenToWorld, type Bounds, type Insets, type ViewTransform } from './camera.ts';
import { applyEdgeVisibility, buildEdgeLayer, curveControl, edgeColor, visibleBuckets, type EdgeGroup } from './edges.ts';
import { estimateTextWidth, placeLabels, type LabelBox } from './labels.ts';

/**
 * Imperative Pixi v8 scene for the starfield. React mounts it once and pushes
 * state through update(); pan, zoom, and hover never re-render React.
 *
 *   stage
 *     ├─ dust ×2      screen-space TilingSprites, parallax with the camera
 *     ├─ world        d3-zoom target; a render group, so panning is a uniform
 *     │   ├─ edges        hairline groups by (mask, weight bucket), built once
 *     │   ├─ focusEdges   selected / hovered neighborhood, constant pixel width
 *     │   ├─ glows        one tinted Gaussian sprite per star
 *     │   ├─ rings        selection + hover rings, selection ping
 *     │   └─ cores        one tinted disc sprite per star
 *     └─ labels       screen-space BitmapText, greedy collision-free placement
 *
 * Rendering is on demand: nothing draws unless the camera moves, state
 * changes, or an animation is running, so an idle tab costs nothing.
 */

export interface FocusState {
  selected: number | null;
  hovered: number | null;
  /** Search matches, best first; null when there is no query. */
  matches: readonly number[] | null;
  activeMask: number;
}

export interface RendererOptions {
  reducedMotion: boolean;
  /** Screen areas covered by UI panels, so camera fits avoid them. */
  getInsets: () => Insets;
  /** Fires on every pointer move over the canvas (index null = empty sky). */
  onHover: (index: number | null, clientX: number, clientY: number) => void;
  /** Click on a star, or on empty sky (null). */
  onSelect: (index: number | null) => void;
}

const TEXTURE_SIZE = 64;
const GLOW_SCALE = 5;           // glow diameter in star radii
const GLOW_ALPHA = 0.34;
const DIM_ALPHA = 0.09;
const FOCUS_EDGE_DIM = 0.16;    // base edge layer alpha while something is focused
const MAX_ZOOM = 10;
const PICK_SLACK_PX = { mouse: 5, touch: 14 };
const FOCUS_MS = 420;
const HOVER_MS = 140;
const ENTRANCE_MS = 1400;
const PING_MS = 900;
const FONT_TIMEOUT_MS = 3000;

const LABEL_FONT = 'cineverse-label';
const LABEL_STRONG_FONT = 'cineverse-label-strong';
const LABEL_SIZE = 11;
const LABEL_STRONG_SIZE = 13;
const MAX_LABELS = 60;
const LABEL_STYLE = {
  fontFamily: '"JetBrains Mono Variable", ui-monospace, Menlo, monospace',
  fontSize: LABEL_SIZE,
  fill: '#d9d6e8',
  letterSpacing: 0.2,
  dropShadow: { color: '#05060d', alpha: 0.95, blur: 3, distance: 0, angle: 0 },
};
const LABEL_STRONG_STYLE = { ...LABEL_STYLE, fontSize: LABEL_STRONG_SIZE, fontWeight: '500' as const, fill: '#fffbe6' };

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

interface Animation {
  start: number;
  duration: number;
  ease: (t: number) => number;
  step: (t: number) => void;
  done?: () => void;
}

const mipmapped = (canvas: HTMLCanvasElement) =>
  new Texture({ source: new CanvasSource({ resource: canvas, autoGenerateMipmaps: true }) });

// Installed once per page. Fonts live in Pixi's global cache and outlive any
// one Application (StrictMode mounts the scene twice in development), so
// re-installing per instance would only race.
let fontsInstalled: Promise<void> | null = null;
const installFonts = (resolution: number): Promise<void> =>
  (fontsInstalled ??= (async () => {
    try {
      // The glyph atlas is rasterized at install time, so the webfont must be
      // loaded first or every label would bake in the fallback font — but a
      // stalled font request must not hold the loading screen forever.
      await Promise.race([
        Promise.all([
          document.fonts.load(`400 ${LABEL_SIZE}px "JetBrains Mono Variable"`),
          document.fonts.load(`500 ${LABEL_STRONG_SIZE}px "JetBrains Mono Variable"`),
        ]),
        new Promise(resolve => setTimeout(resolve, FONT_TIMEOUT_MS)),
      ]);
    } catch {
      // Offline or blocked: labels fall back to the system monospace.
    }
    for (const [name, style] of [[LABEL_FONT, LABEL_STYLE], [LABEL_STRONG_FONT, LABEL_STRONG_STYLE]] as const) {
      if (!Cache.has(`${name}-bitmap`)) BitmapFont.install({ name, style, resolution, chars: [[' ', '~']] });
    }
  })());

export class StarfieldRenderer {
  static async create(host: HTMLElement, dataset: Dataset, options: RendererOptions): Promise<StarfieldRenderer> {
    const app = new Application();
    const resolution = Math.min(window.devicePixelRatio || 1, 2);
    await app.init({
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      backgroundAlpha: 0,
      antialias: true,
      resolution,
      autoDensity: true,
      autoStart: false,
      preference: 'webgl',
    });
    // Render-on-demand means no Pixi ticker may run while idle, but two Pixi
    // systems keep the global system ticker (and so requestAnimationFrame)
    // spinning forever:
    //  - the federated event system, which also hit-tests every sprite on each
    //    pointer move; picking goes through the Flatbush index instead, so
    //    detach it (documented as setTargetElement(null), typed non-null);
    //  - the scheduler behind texture GC; this scene's GPU resources are built
    //    once and reused, so periodic GC buys nothing.
    try {
      app.renderer.events.setTargetElement(null as unknown as HTMLElement);
      Ticker.system.autoStart = false;
      Ticker.system.stop();
      await installFonts(resolution);
      return new StarfieldRenderer(host, app, dataset, options);
    } catch (err) {
      app.destroy(true, { children: true, texture: true }); // do not leak the WebGL context
      throw err;
    }
  }

  private readonly host: HTMLElement;
  private readonly app: Application;
  private readonly dataset: Dataset;
  private options: RendererOptions;
  private readonly canvas: HTMLCanvasElement;
  private readonly world = new Container({ isRenderGroup: true });
  private readonly edgeLayer: Container;
  private readonly edgeGroups: EdgeGroup[];
  private readonly focusEdges = new Graphics();
  private readonly rings = new Graphics();
  private readonly ping = new Graphics();
  private readonly labelLayer = new Container();
  private readonly dust: [TilingSprite, number][];
  private readonly glows: Sprite[] = [];
  private readonly cores: Sprite[] = [];
  private readonly hitIndex: HitIndex;
  private readonly bounds: Bounds;
  /** Node indices, most prominent first (ambient label priority). */
  private readonly prominence: number[];

  private readonly zoomBehavior: ZoomBehavior<HTMLCanvasElement, unknown>;
  private readonly canvasSel: Selection<HTMLCanvasElement, unknown, null, undefined>;
  private readonly resizeObserver: ResizeObserver;

  private width: number;
  private height: number;
  private transform: ViewTransform = { x: 0, y: 0, k: 1 };
  private fitK = 1;
  private radiusScale = 1;
  private lodBucket = -1;

  private state: FocusState = { selected: null, hovered: null, matches: null, activeMask: ALL_CONNECTIONS_MASK };
  private matchSet: Set<number> | null = null;
  private focusSet: Set<number> | null = null;

  private readonly alpha: Float32Array;
  private readonly pop: Float32Array;   // hover scale boost, 0..1
  private readonly animations = new Set<Animation>();
  private frame = 0;
  private cancelFocus: (() => void) | null = null;
  private cancelEntrance: (() => void) | null = null;
  private cancelFly: (() => void) | null = null;
  /** Where an in-progress flight will land, so zoomBy can compose on it. */
  private flyTarget: ViewTransform | null = null;
  /** Set while we drive d3-zoom ourselves (see setTransform). */
  private programmatic = false;
  private destroyed = false;
  private lastPointerType: 'mouse' | 'touch' = 'mouse';
  /** Mouse position over the canvas, to re-pick hover when the camera moves. */
  private lastPointer: { x: number; y: number } | null = null;
  private hoverStale = false;

  private readonly labels = new Map<number, BitmapText>();
  private readonly labelPools: Record<'normal' | 'strong', BitmapText[]> = { normal: [], strong: [] };

  private constructor(host: HTMLElement, app: Application, dataset: Dataset, options: RendererOptions) {
    this.host = host;
    this.app = app;
    this.dataset = dataset;
    this.options = options;
    const { nodes } = dataset;
    this.canvas = app.canvas;
    this.width = Math.max(1, host.clientWidth);
    this.height = Math.max(1, host.clientHeight);
    this.canvas.style.display = 'block';
    this.canvas.style.touchAction = 'none';
    host.appendChild(this.canvas);

    // --- backdrop ---------------------------------------------------------
    this.dust = [
      [new TilingSprite({ texture: Texture.from(buildDustBitmap(512, 150, 7)), width: this.width, height: this.height, alpha: 0.5 }), 0.03],
      [new TilingSprite({ texture: Texture.from(buildDustBitmap(640, 46, 19)), width: this.width, height: this.height, alpha: 0.85 }), 0.08],
    ];
    for (const [sprite] of this.dust) app.stage.addChild(sprite);
    app.stage.addChild(this.world, this.labelLayer);

    // --- edges ------------------------------------------------------------
    const edgeLayer = buildEdgeLayer(dataset);
    this.edgeLayer = edgeLayer.container;
    this.edgeGroups = edgeLayer.groups;
    this.world.addChild(this.edgeLayer, this.focusEdges);

    // --- stars ------------------------------------------------------------
    const glowTexture = mipmapped(buildGlowBitmap(TEXTURE_SIZE));
    const discTexture = mipmapped(buildDiscBitmap(TEXTURE_SIZE));
    const glowLayer = new Container();
    const coreLayer = new Container();
    for (const n of nodes) {
      const tint = hexToTintInt(familyColor(n.family));
      const glow = new Sprite({ texture: glowTexture, anchor: 0.5, x: n.x, y: n.y, tint, blendMode: 'add' });
      const core = new Sprite({ texture: discTexture, anchor: 0.5, x: n.x, y: n.y, tint });
      glowLayer.addChild(glow);
      coreLayer.addChild(core);
      this.glows.push(glow);
      this.cores.push(core);
    }
    this.world.addChild(glowLayer, this.rings, this.ping, coreLayer);

    this.alpha = new Float32Array(nodes.length).fill(options.reducedMotion ? 1 : 0);
    this.pop = new Float32Array(nodes.length);
    this.hitIndex = buildHitIndex(nodes);
    this.bounds = boundsOf(nodes);
    // Rating is the best fame proxy the data has; degree only breaks ties so
    // hubs do not outrank classics.
    this.prominence = nodes
      .map(n => n.index)
      .sort((a, b) => nodes[b].rating + 0.03 * nodes[b].degree - (nodes[a].rating + 0.03 * nodes[a].degree));

    // --- camera -----------------------------------------------------------
    this.zoomBehavior = d3Zoom<HTMLCanvasElement, unknown>()
      .clickDistance(4)
      .on('zoom', (e: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
        // A user gesture (wheel, drag, pinch) takes over from any flight. Not
        // on 'start': d3 emits that on every mousedown, so the second click of
        // a double-click would strand the flight the first click started.
        if (e.sourceEvent && !this.programmatic) this.stopFly();
        this.onCamera(e.transform);
      });
    this.canvasSel = select(this.canvas);
    this.canvasSel.call(this.zoomBehavior).on('dblclick.zoom', null);

    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
    this.canvas.addEventListener('click', this.onClick);
    // Pixi rebuilds GPU state after a context loss but leaves drawing to a
    // ticker; with render-on-demand nothing would redraw until the next input.
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(host);

    this.updateExtents();
    this.setTransform(this.fitView());
    this.applyAllStars();
    this.playEntrance();
  }

  // --- public API ------------------------------------------------------------

  update(next: FocusState): void {
    const prev = this.state;
    this.state = next;
    // A query with no results highlights nothing rather than dimming everything.
    if (next.matches !== prev.matches) this.matchSet = next.matches?.length ? new Set(next.matches) : null;

    const maskChanged = next.activeMask !== prev.activeMask;
    if (maskChanged) applyEdgeVisibility(this.edgeGroups, next.activeMask, this.lodBucket);

    const focusChanged = maskChanged || next.selected !== prev.selected || next.matches !== prev.matches;
    if (focusChanged) this.retargetFocus();
    if (next.selected !== prev.selected) {
      // The focus tween skips stars whose alpha does not change, but the
      // selection glow does.
      if (prev.selected != null) this.applyStar(prev.selected);
      if (next.selected != null) this.applyStar(next.selected);
    }
    if (next.hovered !== prev.hovered) this.retargetHover(prev.hovered, next.hovered);
    if (next.selected != null && next.selected !== prev.selected) {
      this.flyToNeighborhood(next.selected);
      this.playPing(next.selected);
    }

    this.drawFocusEdges();
    this.drawRings();
    this.layoutLabels();
    this.requestRender();
  }

  /** Zoom around the viewport center (toolbar +/− buttons). */
  zoomBy(factor: number): void {
    // Compose on a flight still in progress so quick repeated clicks add up.
    const t = this.flyTarget ?? this.transform;
    const k = Math.min(MAX_ZOOM, Math.max(this.fitK * 0.6, t.k * factor));
    const cx = this.width / 2;
    const cy = this.height / 2;
    this.flyTo({ k, x: cx - ((cx - t.x) * k) / t.k, y: cy - ((cy - t.y) * k) / t.k }, 260);
  }

  resetView(): void {
    this.flyTo(this.fitView());
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.options = { ...this.options, reducedMotion };
    if (reducedMotion) {
      for (const a of [...this.animations]) {
        a.step(1);
        a.done?.();
      }
      this.animations.clear();
      this.requestRender();
    }
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.animations.clear();
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('click', this.onClick);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.canvasSel.on('.zoom', null);
    this.app.destroy(true, { children: true, texture: true });
  }

  // --- frame loop --------------------------------------------------------------

  private requestRender() {
    if (!this.frame) this.frame = requestAnimationFrame(this.onFrame);
  }

  private onFrame = (now: number) => {
    this.frame = 0;
    if (this.hoverStale) {
      this.hoverStale = false;
      this.repickHover();
    }
    for (const a of [...this.animations]) {
      const t = Math.min(1, Math.max(0, (now - a.start) / a.duration));
      a.step(a.ease(t));
      if (t >= 1) {
        this.animations.delete(a);
        a.done?.();
      }
    }
    this.app.render();
    if (this.animations.size > 0) this.requestRender();
  };

  /** Runs `step` from 0→1 over `duration`; instant under reduced motion. */
  private animate(duration: number, step: (t: number) => void, done?: () => void, ease = easeOutCubic): () => void {
    if (this.options.reducedMotion || duration <= 0) {
      step(1);
      done?.();
      this.requestRender();
      return () => {};
    }
    const anim: Animation = { start: performance.now(), duration, ease, step, done };
    this.animations.add(anim);
    this.requestRender();
    return () => this.animations.delete(anim);
  }

  // --- camera ------------------------------------------------------------------

  private fitView(): ViewTransform {
    return fitTransform(this.bounds, this.width, this.height, { insets: this.options.getInsets(), padding: 28 });
  }

  private updateExtents() {
    this.fitK = fitTransform(this.bounds, this.width, this.height, { padding: 28 }).k;
    const b = this.bounds;
    const padX = (b.maxX - b.minX) * 0.35;
    const padY = (b.maxY - b.minY) * 0.35;
    this.zoomBehavior
      .scaleExtent([this.fitK * 0.6, MAX_ZOOM])
      .translateExtent([[b.minX - padX, b.minY - padY], [b.maxX + padX, b.maxY + padY]]);
  }

  private setTransform(t: ViewTransform) {
    // While a wheel gesture lingers (~150 ms), d3 reuses it for programmatic
    // transforms, so their zoom events still carry its sourceEvent.
    this.programmatic = true;
    try {
      this.canvasSel.call(this.zoomBehavior.transform, zoomIdentity.translate(t.x, t.y).scale(t.k));
    } finally {
      this.programmatic = false;
    }
  }

  private onCamera = ({ x, y, k }: ViewTransform) => {
    if (this.destroyed) return; // d3 window listeners can outlive a mid-drag destroy
    this.transform = { x, y, k };
    this.world.position.set(x, y);
    this.world.scale.set(k);
    for (const [sprite, depth] of this.dust) sprite.tilePosition.set(x * depth, y * depth);

    const bucket = visibleBuckets(k / this.fitK);
    if (bucket !== this.lodBucket) {
      this.lodBucket = bucket;
      applyEdgeVisibility(this.edgeGroups, this.state.activeMask, bucket);
    }

    // Stars grow sub-linearly with zoom so close-ups stay crisp points,
    // quantized so tiny zoom steps do not touch every sprite.
    const rel = Math.max(1, k / this.fitK);
    const radiusScale = Math.round(rel ** -0.45 * 50) / 50;
    if (radiusScale !== this.radiusScale) {
      this.radiusScale = radiusScale;
      this.applyAllStars();
    }

    this.drawFocusEdges();
    this.drawRings();
    this.layoutLabels();
    // Stars moved under a still pointer; re-pick on the next frame rather than
    // here, where hover would re-enter update() mid-camera-change.
    if (this.lastPointer) this.hoverStale = true;
    this.requestRender();
  };

  private flyTo(target: ViewTransform, minDuration = 650) {
    this.stopFly();
    this.flyTarget = target;
    const { width: w, height: h } = this;
    const view = (t: ViewTransform): [number, number, number] => [(w / 2 - t.x) / t.k, (h / 2 - t.y) / t.k, w / t.k];
    const path = interpolateZoom(view(this.transform), view(target));
    const duration = Math.min(1600, Math.max(minDuration, path.duration * 0.6));
    this.cancelFly = this.animate(
      duration,
      t => {
        const [cx, cy, vw] = path(t);
        const k = w / vw;
        // Center on the current size, so a resize mid-flight is not undone.
        this.setTransform({ x: this.width / 2 - cx * k, y: this.height / 2 - cy * k, k });
      },
      () => {
        this.cancelFly = null;
        this.flyTarget = null;
      },
      easeInOutCubic,
    );
  }

  private stopFly() {
    this.cancelFly?.();
    this.cancelFly = null;
    this.flyTarget = null;
  }

  /**
   * Center on the film and zoom so most of its neighbors fit. Fitting *all*
   * of them would let one far-flung link (a remake on another continent)
   * shrink the whole neighborhood to a speck; its edge still points the way.
   */
  private flyToNeighborhood(index: number) {
    const { nodes } = this.dataset;
    const self = nodes[index];
    const distances = this.neighbors(index)
      .map(i => Math.hypot(nodes[i].x - self.x, nodes[i].y - self.y))
      .sort((a, b) => a - b);
    const reach = distances.length ? distances[Math.floor((distances.length - 1) * 0.75)] : 0;
    const r = Math.max(reach, 40) + self.radius;
    this.flyTo(
      fitTransform({ minX: self.x - r, minY: self.y - r, maxX: self.x + r, maxY: self.y + r }, this.width, this.height, {
        insets: this.options.getInsets(),
        padding: 48,
        minK: this.fitK * 1.5,
        maxK: Math.min(MAX_ZOOM, this.fitK * 8),
      }),
    );
  }

  private onResize = () => {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    if (w === this.width && h === this.height) return;
    const center = screenToWorld(this.transform, this.width / 2, this.height / 2);
    this.width = w;
    this.height = h;
    this.app.renderer.resize(w, h);
    for (const [sprite] of this.dust) {
      sprite.width = w;
      sprite.height = h;
    }
    this.updateExtents();
    const { k } = this.transform;
    this.setTransform({ x: w / 2 - center.x * k, y: h / 2 - center.y * k, k });
  };

  // --- stars & focus -------------------------------------------------------------

  /** Active-mask neighbors of a node. */
  private neighbors(index: number): number[] {
    const { edges, adjacency } = this.dataset;
    const out: number[] = [];
    for (const ei of adjacency[index]) {
      if (edges[ei].mask & this.state.activeMask) out.push(otherEnd(edges[ei], index));
    }
    return out;
  }

  private applyStar(i: number) {
    const n = this.dataset.nodes[i];
    const hovered = this.state.hovered === i;
    const selected = this.state.selected === i;
    const alpha = hovered ? Math.max(this.alpha[i], 0.95) : this.alpha[i];
    const radius = n.radius * this.radiusScale * (1 + 0.35 * this.pop[i]);
    this.cores[i].alpha = alpha;
    this.cores[i].scale.set((radius * 2) / TEXTURE_SIZE);
    this.glows[i].alpha = alpha * GLOW_ALPHA * (selected ? 1.8 : 1);
    this.glows[i].scale.set((radius * GLOW_SCALE) / TEXTURE_SIZE);
  }

  private applyAllStars() {
    for (let i = 0; i < this.cores.length; i++) this.applyStar(i);
  }

  private retargetFocus() {
    this.cancelEntrance?.();
    this.cancelFocus?.();
    const { selected } = this.state;
    this.focusSet = selected != null ? new Set([selected, ...this.neighbors(selected)]) : this.matchSet;

    const focus = this.focusSet;
    const from = Float32Array.from(this.alpha);
    const to = new Float32Array(this.alpha.length);
    for (let i = 0; i < to.length; i++) to[i] = !focus || focus.has(i) ? 1 : DIM_ALPHA;
    const edgeFrom = this.edgeLayer.alpha;
    const edgeTo = focus ? FOCUS_EDGE_DIM : 1;

    this.cancelFocus = this.animate(FOCUS_MS, t => {
      for (let i = 0; i < to.length; i++) {
        if (from[i] === to[i]) continue;
        this.alpha[i] = from[i] + (to[i] - from[i]) * t;
        this.applyStar(i);
      }
      this.edgeLayer.alpha = edgeFrom + (edgeTo - edgeFrom) * t;
    });
  }

  private retargetHover(prev: number | null, next: number | null) {
    const tweenPop = (i: number, target: number) => {
      const start = this.pop[i];
      this.animate(HOVER_MS, t => {
        this.pop[i] = start + (target - start) * t;
        this.applyStar(i);
      });
    };
    if (prev != null) tweenPop(prev, 0);
    if (next != null) tweenPop(next, 1);
  }

  private playEntrance() {
    const { nodes } = this.dataset;
    if (this.options.reducedMotion) return;
    const cx = (this.bounds.minX + this.bounds.maxX) / 2;
    const cy = (this.bounds.minY + this.bounds.maxY) / 2;
    const reach = Math.hypot(this.bounds.maxX - cx, this.bounds.maxY - cy) || 1;
    const delays = nodes.map(n => (Math.hypot(n.x - cx, n.y - cy) / reach) * 0.55);
    this.edgeLayer.alpha = 0;
    this.cancelEntrance = this.animate(
      ENTRANCE_MS,
      t => {
        for (let i = 0; i < nodes.length; i++) {
          this.alpha[i] = easeOutCubic(Math.min(1, Math.max(0, (t - delays[i]) / 0.45)));
          this.applyStar(i);
        }
        this.edgeLayer.alpha = Math.min(1, Math.max(0, (t - 0.35) / 0.65));
      },
      () => (this.cancelEntrance = null),
      t => t,
    );
    // Cancelling mid-way (an early click) must not leave stars invisible.
    const cancel = this.cancelEntrance;
    this.cancelEntrance = () => {
      cancel();
      this.alpha.fill(1);
      this.edgeLayer.alpha = 1;
      this.applyAllStars();
      this.cancelEntrance = null;
    };
  }

  private playPing(index: number) {
    const n = this.dataset.nodes[index];
    this.animate(PING_MS, t => {
      const k = this.transform.k;
      this.ping
        .clear()
        .circle(n.x, n.y, n.radius * this.radiusScale + (6 + 22 * t) / k)
        .stroke({ color: 0xfffbe6, alpha: 0.55 * (1 - t), width: 1.4 / k });
    }, () => this.ping.clear());
  }

  // --- overlays ------------------------------------------------------------------

  private drawFocusEdges() {
    const g = this.focusEdges.clear();
    const { nodes, edges, adjacency } = this.dataset;
    const { selected, hovered, activeMask } = this.state;
    const k = this.transform.k;
    const drawEdge = (ei: number, emphasis: number) => {
      const e = edges[ei];
      const active = e.mask & activeMask;
      if (!active) return;
      const s = nodes[e.source];
      const t = nodes[e.target];
      const { cx, cy } = curveControl(e, s.x, s.y, t.x, t.y);
      g.moveTo(s.x, s.y)
        .quadraticCurveTo(cx, cy, t.x, t.y)
        .stroke({ color: edgeColor(active), alpha: (0.35 + 0.55 * e.weight) * emphasis, width: (0.9 + 1.7 * e.weight) / k });
    };

    if (selected != null) {
      for (const ei of adjacency[selected]) drawEdge(ei, 1);
    } else if (hovered != null) {
      for (const ei of adjacency[hovered]) drawEdge(ei, 0.8);
    } else if (this.matchSet && this.matchSet.size <= 60) {
      for (const i of this.matchSet) {
        for (const ei of adjacency[i]) {
          if (otherEnd(edges[ei], i) > i && this.matchSet.has(otherEnd(edges[ei], i))) drawEdge(ei, 0.9);
        }
      }
    }
  }

  private drawRings() {
    const g = this.rings.clear();
    const { nodes } = this.dataset;
    const k = this.transform.k;
    const ring = (i: number, gapPx: number, widthPx: number, alpha: number) => {
      const n = nodes[i];
      g.circle(n.x, n.y, n.radius * this.radiusScale * (1 + 0.35 * this.pop[i]) + gapPx / k)
        .stroke({ color: 0xfffbe6, alpha, width: widthPx / k });
    };
    if (this.state.selected != null) ring(this.state.selected, 5, 1.6, 0.95);
    if (this.state.hovered != null && this.state.hovered !== this.state.selected) ring(this.state.hovered, 4, 1.1, 0.55);
  }

  private layoutLabels() {
    const { nodes } = this.dataset;
    const { selected, hovered, matches } = this.state;
    const { x: tx, y: ty, k } = this.transform;
    const seen = new Set<number>();
    const strong = new Set<number>();
    const candidates: LabelBox[] = [];

    const consider = (i: number, isStrong: boolean) => {
      if (seen.has(i)) return;
      seen.add(i);
      if (isStrong) strong.add(i);
      const n = nodes[i];
      const size = isStrong ? LABEL_STRONG_SIZE : LABEL_SIZE;
      const width = estimateTextWidth(n.title, size);
      const sx = n.x * k + tx;
      const sy = n.y * k + ty + n.radius * this.radiusScale * k + 5;
      candidates.push({ id: i, x: sx - width / 2, y: sy, width, height: size + 3 });
    };

    if (selected != null) consider(selected, true);
    if (hovered != null) consider(hovered, true);
    let budget = MAX_LABELS;
    if (selected != null) {
      for (const i of this.neighbors(selected)) consider(i, false);
    } else if (this.matchSet && matches) {
      for (const i of matches.slice(0, 40)) consider(i, false);
    } else {
      // Ambient "city names": a handful when zoomed out, more as space opens up.
      const rel = k / this.fitK;
      budget = Math.round(10 + 40 * Math.min(1, Math.max(0, (rel - 1) / 3)));
      for (const i of this.prominence) consider(i, false);
    }

    // Only strong labels may sit under UI chrome; others would be wasted there.
    const insets = this.options.getInsets();
    const visible = candidates.filter(
      b => strong.has(b.id) ||
        (b.y >= insets.top && b.y + b.height <= this.height - insets.bottom &&
          b.x >= insets.left && b.x + b.width <= this.width - insets.right),
    );
    const placed = placeLabels(visible, { width: this.width, height: this.height }, budget + strong.size);
    const keep = new Set(placed.map(b => b.id));
    for (const [i, label] of this.labels) {
      const kind = strong.has(i) ? 'strong' : 'normal';
      if (!keep.has(i) || label.style.fontFamily !== (kind === 'strong' ? LABEL_STRONG_FONT : LABEL_FONT)) {
        label.visible = false;
        this.labelPools[label.style.fontFamily === LABEL_STRONG_FONT ? 'strong' : 'normal'].push(label);
        this.labels.delete(i);
      }
    }
    const ambient = selected == null && !this.matchSet;
    for (const box of placed) {
      const isStrong = strong.has(box.id);
      let label = this.labels.get(box.id);
      if (!label) {
        label = this.labelPools[isStrong ? 'strong' : 'normal'].pop() ?? this.createLabel(isStrong);
        label.text = nodes[box.id].title;
        label.visible = true;
        this.labels.set(box.id, label);
      }
      label.position.set(Math.round(box.x + box.width / 2), Math.round(box.y));
      label.alpha = isStrong ? 1 : ambient ? 0.7 : 0.92;
    }
  }

  private createLabel(strong: boolean): BitmapText {
    const label = new BitmapText({
      text: '',
      style: { fontFamily: strong ? LABEL_STRONG_FONT : LABEL_FONT, fontSize: strong ? LABEL_STRONG_SIZE : LABEL_SIZE },
      anchor: { x: 0.5, y: 0 },
    });
    this.labelLayer.addChild(label);
    return label;
  }

  // --- pointer -------------------------------------------------------------------

  private pickAt(clientX: number, clientY: number): number | null {
    const rect = this.canvas.getBoundingClientRect();
    const p = screenToWorld(this.transform, clientX - rect.left, clientY - rect.top);
    const slack = PICK_SLACK_PX[this.lastPointerType] / this.transform.k;
    return this.hitIndex.pick(p.x, p.y, slack, this.radiusScale);
  }

  private onPointerDown = (e: PointerEvent) => {
    this.lastPointerType = e.pointerType === 'touch' ? 'touch' : 'mouse';
    this.canvas.style.cursor = 'grabbing';
  };

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return; // no hover on touch; taps select
    this.lastPointerType = 'mouse';
    if (e.buttons !== 0) {
      this.lastPointer = null;
      this.options.onHover(null, e.clientX, e.clientY); // panning
      return;
    }
    this.lastPointer = { x: e.clientX, y: e.clientY };
    const index = this.pickAt(e.clientX, e.clientY);
    this.canvas.style.cursor = index != null ? 'pointer' : 'grab';
    this.options.onHover(index, e.clientX, e.clientY);
  };

  private onPointerLeave = (e: PointerEvent) => {
    this.lastPointer = null;
    this.options.onHover(null, e.clientX, e.clientY);
  };

  private repickHover() {
    if (!this.lastPointer) return;
    const { x, y } = this.lastPointer;
    const index = this.pickAt(x, y);
    if (index !== this.state.hovered) this.options.onHover(index, x, y);
  }

  private onContextRestored = () => this.requestRender();

  private onClick = (e: MouseEvent) => {
    this.canvas.style.cursor = 'grab';
    this.options.onSelect(this.pickAt(e.clientX, e.clientY));
  };
}
