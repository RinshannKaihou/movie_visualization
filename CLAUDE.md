# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> A parallel `AGENTS.md` exists for Codex with the same architectural notes — keep the two in sync when making meaningful changes.

## Common Commands

- `npm run dev` — Vite dev server with HMR
- `npm run build` — TypeScript project-references check, then Vite production build
- `npm run lint` — ESLint over the repo
- `npm test` — Vitest run (single pass); `npm run test:watch` for watch mode. Tests live next to source as `*.test.ts(x)` and run under jsdom (the `canvas` npm package backs `getContext` so texture/glow code is testable).
- `npm run build:data` — Run `scripts/build-static-data.mjs` to fetch 2000 top-rated movies from TMDB and emit `public/data/movies.json`. Required before deploying so the public site works without an API key.
- `npm run deploy` — `gh-pages -d dist` (vite is configured with `base: '/movie_visualization/'`).

## Environment Setup

Create a `.env` file with `VITE_TMDB_API_KEY=...` (free key from https://www.themoviedb.org/settings/api). The key is needed for `npm run dev` only when the static dataset is missing, and for `npm run build:data`.

## Project Architecture

### Load priority (the key invariant)

`useMovieData` tries three sources in order, and **every** path funnels through `ensurePositions()` before calling `setGraphData`:

1. `loadStaticData()` — fetch `public/data/movies.json` (the deployed-site path).
2. `loadGraphData()` — IndexedDB cache (`movie-network-viz`, `DB_VERSION=4`, 7-day TTL). v4 bakes layout positions into the cached blob; older versions are intentionally rejected.
3. `fetchMoviesWithDetails()` — live TMDB calls with rate-limit backoff.

Why the funnel matters: the runtime force simulation is **frozen**. `StarfieldCanvas` reads `node.x/y` directly and does no physics ticks. Any node missing coordinates renders piled at the origin. `ensurePositions` calls the layout Web Worker (`runLayoutInWorker`) when needed; positions are then cached so reloads are pre-placed.

### Layout pipeline

- `services/graphBuilder.ts` — turns movies into nodes/edges via inverted indexes (actor/director/genre → movie IDs), with clique thresholds + `MAX_EDGES_PER_NODE` pruning to keep the graph readable. **`similar_plot` connections are currently disabled** (commented out for performance); the type still exists in the union but no edges are emitted with it at runtime. Also exports `getNodeColor`, `getEdgeColor`, `getNodeSize`, and the `SPECTRAL_COLORS` palette consumed by the renderer.
- `services/layout.ts` — `computeLayout(movies, edges, {seed, iterations})` with seeded Mulberry32 RNG + d3-force. Deterministic for a given seed/input/engine. Pure (no DOM) so it runs in a worker and under tests.
- `workers/layoutWorker.ts` + `services/layoutClient.ts` — single-shot worker (terminates after one layout). The duplicate copy of fetch + graph-build logic in `scripts/build-static-data.mjs` must be kept aligned with `services/tmdb.ts` and `services/graphBuilder.ts` when those change.

### Renderer (`components/StarfieldCanvas.tsx`)

Pixi v8 scene graph: `stage → bgStars (no transform), world (pan/zoom target) → edgesLayer (Graphics, quadratic bezier curves) → nodesLayer (per-node Container of glow Sprite + ring Graphics + core Graphics + label Text)`.

- **Pan/zoom** is driven by `d3-zoom` attached to the Pixi canvas; the zoom callback writes `world.position`/`world.scale` and pushes `zoom` into the store so `services/viewport.ts` LOD cutoffs (`lodStrengthCutoff`, `lodRatingCutoff`) can hide weak edges / dim stars at low zoom.
- **Hit testing** uses `services/hitTest.ts`, a `flatbush` static R-tree built once from pinned positions. Pointer moves call `hitIndex.pick(x, y)` after inverting the world transform; selection is gated by a 3px click-vs-drag threshold.
- **Glow** is a single white CPU-rendered Gaussian bitmap (`services/textures.ts::buildGlowBitmap`) uploaded once and tinted per-node via `sprite.tint`.
- **Animations** (entrance stagger, focus alpha/scale tween, camera-fit tween on selection) all run through a small `tween()` helper and are short-circuited when `useReducedMotion()` is true. The idle ticker pauses 1s after the last interaction but stays awake until entrance finishes.

### State (`stores/graphStore.ts`)

Zustand store. Holds movies/nodes/edges, an `edgeAdjacency: Map<id, MovieEdge[]>` built once in `setGraphData` for O(1) neighborhood lookups, plus UI state (`selectedMovie`, `activeFilters`, `searchQuery`, `zoom`). Edge source/target are *numeric IDs* — d3-force used to mutate them into node objects, so getters defensively unwrap both shapes.

`useGraphFilters` derives `visibleEdges` reactively: when a movie is selected it returns just that node's neighborhood; when there's a search query without a selection it limits to matching nodes; otherwise it returns the filter-toggle subset.

### Type contracts

- `Movie` — id/title/year/poster/rating/genres/directors/leadActors/plotKeywords/overview.
- `MovieNode extends Movie` — adds optional x/y/z + vx/vy/vz. **Position is required at render time** (see invariant above).
- `MovieEdge` — `{ source: number; target: number; types: ConnectionType[]; strength: number }` where `strength` equals `types.length` (1–4).
- `ConnectionType` — `'same_actor' | 'same_director' | 'same_genre' | 'similar_plot'` (last one currently unused, see graphBuilder note).
- `GraphData` — `{ nodes, links }` (note: `links`, not `edges`, in the container — the in-flight d3 / static-data naming carryover).

## Tech Stack

- **Build**: Vite 7 + React 19 + Tailwind v4 (Vite plugin). `base: '/movie_visualization/'` for GitHub Pages.
- **State**: Zustand 5.
- **Graph**: Pixi.js 8 (WebGL) + d3-force (layout, in worker) + d3-zoom/d3-selection (camera) + flatbush (hit-test R-tree). `react-force-graph` and `three` were removed during the WebGL migration; do not reintroduce them.
- **Storage**: `idb` for IndexedDB caching (positions baked in at v4).
- **Testing**: Vitest + jsdom + `canvas` package (so Pixi/CPU-bitmap code can run headless).

## Worktree note

`.worktrees/webgl-renderer/` is a sibling git worktree from the WebGL migration. Treat it as a separate checkout — don't accidentally edit files there from the main checkout.
