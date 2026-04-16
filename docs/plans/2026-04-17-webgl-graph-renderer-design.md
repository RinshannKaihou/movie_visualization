# WebGL Graph Renderer Redesign — CineVerse

**Date:** 2026-04-17
**Status:** Design approved, ready for implementation planning
**Owner:** yipei-wang

## Problem

CineVerse visualizes 2000 movies as a force-directed "Celestial Cinema" starfield.
The current canvas 2D renderer hits three pain points the user has confirmed as
laggy:

1. **Initial load / first render** — the scene takes noticeable time to appear
   and stutters as it settles.
2. **Panning, zooming, idle animation** — frame drops while navigating the graph.
3. **Selecting / hovering nodes** — visible pause before focus state resolves.

Filter toggles are acceptable, so the simulation re-tick is not the lone culprit;
the render loop itself is saturating the CPU.

The secondary goal is aesthetic: the current overlap of 2000 glowing halos
produces visual mud, and the crisscross of thousands of edges reads as a web
of noise rather than an elegant map.

## Constraints

- **Target devices:** desktop and mobile browsers.
- **Dataset size:** 2000 movies, fixed.
- **Aesthetic floor:** must stay cinematic; "cheap" or "low-poly" is
  unacceptable.
- **Freedom:** any file, architecture, or visual choice is on the table.

## Chosen approach — PixiJS rendering

Replace the `react-force-graph` rendering layer with a purpose-built
`<StarfieldCanvas>` component backed by PixiJS (WebGL). The layout still uses
d3-force but runs once off-thread and pins positions; there is no runtime
simulation. All hot-path drawing becomes GPU-batched.

### Why this approach

Canvas 2D cannot batch 2000 additively-blended bloom sprites and thousands of
edges on mobile — the browser falls back to CPU compositing. Pixi's
`ParticleContainer` collapses a sharing-texture sprite fleet into roughly one
GPU draw call, and a single `Graphics` object batches all edge geometry into
one mesh. This moves the bottleneck from the CPU compositor to the GPU, which
is what 2000 bloom sprites + additive-blended edges are priced for.

### Approaches considered and rejected

- **Surgical canvas 2D optimization.** Pin positions, add viewport culling,
  sprite atlas, drop blend modes, LOD. Realistic ceiling ~30 fps on mobile.
  Cheaper diff but leaves the architecture in a regime where the next dataset
  bump would re-break it.
- **sigma.js / cosmograph + edge bundling.** Biggest aesthetic leap (GPU
  layout, hierarchical edge bundling, semantic-zoom constellations). Rewrite
  cost is the largest of the three. Worth revisiting if we ever scale past
  ~5000 nodes or want edge bundling.

## Architecture

### Component tree

```
GraphScene
  └─ StarfieldCanvas           ← new, owns everything below
       ├─ PixiApp (renderer)
       ├─ BackdropLayer         ← nebula + stardust folded into Pixi
       ├─ EdgeGraphics          ← batched edge geometry, rebuilt on filter/select
       ├─ StarParticleContainer ← 2000 tinted halo sprites, ~1 draw call
       ├─ PhotonContainer       ← moving dots along focused edges only
       └─ FocusLayer            ← ring, flare, bright core for selected star
```

### Data flow

- `useMovieData` loads movies + pinned positions from static JSON (unchanged).
- `buildGraphData` (graphBuilder.ts) keeps its inverted-index edge build.
- `StarfieldCanvas` subscribes to Zustand store (`nodes`, `visibleEdges`,
  `selectedMovie`, `hoveredNode`) and reacts to changes:
  - visible-edge-set change → rebuild edge Graphics.
  - selection/hover change → apply focus transitions, recompute photons.
- "Resurvey" spawns `src/workers/layoutWorker.ts` which runs d3-force and
  posts positions back; main thread writes them to the store and persists to
  static JSON via the existing export path.

### Interaction

- **Pan/zoom:** `d3-zoom` bound to the Pixi canvas, transform propagated to
  the root Pixi Container.
- **Hit-test:** `Flatbush` (or hand-rolled quadtree) built once from pinned
  positions. Pointer move → spatial query → hover state. O(log n).
- **Zustand store:** unchanged API. Adds a `zoom` value so LOD logic can read it.

### Dependencies

- `+ pixi.js` (~400 KB gzipped)
- `+ d3-zoom`
- `+ flatbush`
- `- react-force-graph-2d`
- `- react-force-graph-3d`

## Rendering pipeline

### Star layer

- One shared 256×256 **true Gaussian** halo texture, built once in
  `src/services/textures.ts` and uploaded as a Pixi `Texture`.
- Each movie = one `Sprite` in a `ParticleContainer`.
- `sprite.tint` applies the genre spectral color (existing map in
  `graphBuilder.ts`).
- `sprite.blendMode = ADD` for additive bloom.
- `sprite.scale` driven by rating via the existing `getNodeSize`.
- Twinkle: per-star phase offset, shared shader uniform modulating alpha by
  ~5%. Disabled under `prefers-reduced-motion`.

### Focus / diffraction layer

- Second, smaller sprite pool for diffraction-spike sprites. Drawn only for
  stars with rating ≥ 7.5 plus the focused star.
- When a movie is selected or hovered: a flare sprite + inner white hotspot
  are added to the focus layer; a `BlurFilter` (radius 2) is applied to the
  focused edge Graphics.

### Edge layer

- A single `PIXI.Graphics` object.
- On visible-edge-set change, `clear()` and replay segments. Endpoint colors
  use Pixi vertex colors for free per-edge spectral gradients — no per-frame
  gradient allocation.
- Default edge: additive blend, width scaled by `strength`, alpha 0.10–0.18.
- Focused edges: second Graphics with `BlurFilter`, alpha 0.6–0.85, ~2× width.
- Unfocused edges when something is focused: alpha drops to 0.04.

### Photon layer

- Only the selected movie's top 3 strongest edges emit photons.
- Photons are tiny sprites from a shared texture; positions lerped along the
  edge each ticker frame.
- Deliberate, not ambient — quieter than the current "every strength ≥ 2 edge"
  policy.

### Backdrop

- Nebula: one 2048×1024 perlin-noise color texture, pre-rendered (build-time
  script or first-run worker) and slowly UV-scrolled via a cheap shader
  uniform.
- Fine film grain: baked into the nebula texture; SVG overlay deleted.
- Stardust field: folded into Pixi as a `ParticleContainer` of tiny dots with
  the same twinkle math.
- Vignette: unchanged CSS gradient.

## Performance strategy

| Lever | Win |
|---|---|
| Pin positions, no runtime d3-force tick | Removes biggest source of first-paint and filter-freeze lag |
| `ParticleContainer` for stars | 2000 sprites → ~1 draw call |
| One batched `Graphics` for edges | Thousands of edges → 1 draw call, updated on filter/select only |
| Viewport cull edges | Edge rebuild is O(visible), not O(all) |
| LOD by zoom | Less visual mud + fewer GPU vertices at far zoom |
| Pause ticker after 1s idle | Zero battery drain when stationary |
| Flatbush hit-test | Hover O(log n), no area-paint pass |
| Cap renderer resolution at `min(DPR, 2)` | Avoids 6000×12000 framebuffers on 3×DPR phones |
| Rebuild focus edges only on focus change | Hover no longer triggers full edge rebuild |

### LOD thresholds (tentative, will tune)

- `zoom < 0.4` — only stars with rating ≥ 8.0 drawn bright; others at 10%
  alpha. Edges: only strength ≥ 3.
- `0.4 ≤ zoom < 1.0` — all stars; edges filtered by active type + strength ≥ 2.
- `zoom ≥ 1.0` — full detail; star-layer `BlurFilter` applied for true bloom.

## Aesthetic refinements

### Kept

- Spectral color map (genre → stellar class color).
- Rating → node size mapping.
- "Celestial Cinema" overall identity.
- Vignette, radial dark gradient background tone.

### Upgraded

- Gaussian halo texture replaces the current 6-stop radial gradient (smoother,
  less banded).
- Nebula moves from stacked CSS gradients to a single animated Pixi texture
  (richer noise structure + cheaper).
- True bloom via additive blending of Gaussian sprites + optional `BlurFilter`
  at close zoom.
- Edges use vertex-color endpoint tinting instead of per-edge canvas
  gradients.
- **Camera focus animation:** on movie select, gentle zoom-pan to the
  neighborhood bounding box over ~800ms with `d3-interpolate` easing.
  Non-connected stars fade to 0.3 alpha; connected edges brighten with bloom;
  photons start flowing on top 3 edges.
- **Entrance animation:** stars fade in over 1.2s with random per-star delay
  on first load.
- **Mouse parallax:** when idle, nebula layer shifts 3–5 px with pointer.

### Cut / simplified

- CSS `mixBlendMode` overlays (replaced by GPU additive blending).
- `nebula-pan` CSS keyframes (replaced by Pixi texture scroll).
- Always-on photons on every strength ≥ 2 edge (replaced with focused-only).
- Diffraction spikes baked into every star (gated to rating ≥ 7.5 + focused).
- `ForceGraph3D` path (removable in cleanup stage; can be re-added later).
- `useGraphMode` 2D/3D branching (simplifies to `useReducedMotion`).

### Accessibility / preferences

- `prefers-reduced-motion`: disables twinkle, parallax, entrance animation,
  camera focus tween. Focus transitions become instant.

## Migration plan (staged)

Each stage is independently shippable. We pause and evaluate between stages.

1. **Stage 1 — Pin positions + layout worker.** Move d3-force to
   `src/workers/layoutWorker.ts`. Runtime tick disabled. ForceGraph2D still
   renders. *Measure:* initial load time, filter toggle responsiveness.
2. **Stage 2 — `StarfieldCanvas` behind a feature flag.** Render Pixi scene
   alongside ForceGraph2D in a dev-only side-by-side view. Verify visual
   parity on key states (unfocused, selected-Inception, actor-filter-only,
   extreme zoom-out).
3. **Stage 3 — Cut over.** Make `StarfieldCanvas` default, delete
   `MovieGraph.tsx`, remove `react-force-graph-*` deps.
4. **Stage 4 — Aesthetics.** Gaussian halo, focus animation, Pixi nebula, LOD,
   entrance animation, mouse parallax.
5. **Stage 5 — Polish + cleanup.** Reduced-motion support, mobile DPR cap,
   remove 3D code, delete `StardustField.tsx` (folded into Pixi), simplify
   `useGraphMode`.

## Files affected

- **New:**
  - `src/components/StarfieldCanvas.tsx`
  - `src/workers/layoutWorker.ts`
  - `src/services/textures.ts` (halo, photon, nebula texture generation)
  - `src/services/hitTest.ts` (Flatbush wrapper)
  - `src/services/viewport.ts` (zoom transform + cull math)
- **Modified:**
  - `src/components/GraphScene.tsx` (swap MovieGraph → StarfieldCanvas)
  - `src/hooks/useMovieData.ts` (wire worker path for Resurvey)
  - `src/stores/graphStore.ts` (add zoom state)
  - `package.json` (add pixi.js, d3-zoom, flatbush; remove react-force-graph-*)
- **Deleted (stage 3/5):**
  - `src/components/MovieGraph.tsx`
  - `src/components/StardustField.tsx` (folded into Pixi)
  - `src/hooks/useGraphMode.ts` (replaced by `useReducedMotion`)

## Testing

### Unit tests (Vitest)

- `layoutWorker.ts` — stable positions given same seed.
- `hitTest.ts` — quadtree returns correct node for sample coordinates.
- `viewport.ts` — edge with both endpoints off-screen is culled; LOD
  rating/strength thresholds map correctly to current zoom.

### Manual perf testing

- Chrome DevTools Performance profile at each migration stage. Record
  before/after FPS, paint time, GC pauses.
- Device matrix: desktop Chrome, iOS Safari (recent iPhone), Android Chrome
  (mid-range).

### Visual verification

- Screenshot set at four canonical states, captured before and after cut-over:
  unfocused / selected-node / single-filter-active / extreme-zoom-out.

## Success criteria

| Scenario | Device | Target fps |
|---|---|---|
| Idle | Desktop Chrome | 60 (or ticker paused) |
| Pan / zoom | Desktop Chrome | 60 |
| Pan / zoom | iOS Safari (recent iPhone) | 45+ |
| Pan / zoom | Android Chrome (mid-range) | 30+ |
| Movie select (focus transition) | Any | Smooth 800ms tween, no drops |
| Filter toggle | Any | < 100ms from click to draw |
| Initial load (static JSON) | Any | First paint < 1s |

## Error handling

- **WebGL unavailable:** detect via Pixi renderer selection; fall back to a
  minimal canvas 2D renderer drawing pinned positions as flat-colored circles
  with plain white lines, no animation. Graceful degradation, not a crash.
- **Worker failure on Resurvey:** surface via existing `ErrorScreen`; user
  can retry.
- **Texture generation failure:** halo + photon + nebula textures are built
  in-process (no network). On failure, fall back to small solid-color
  bitmaps and log.

## Open questions (for implementation planning)

- Exact `BlurFilter` radius for close-zoom bloom — tune during stage 4.
- Whether nebula texture is shipped as a static asset or generated on first
  run (decide by measuring size).
- Whether to keep `ForceGraph3D` available as an optional mode or fully
  remove in cleanup. Current plan: remove; can re-add if user asks.
