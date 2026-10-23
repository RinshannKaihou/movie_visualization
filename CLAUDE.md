# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> `AGENTS.md` (for Codex) is a thin pointer to this file. Keep architecture notes here only.

## Common Commands

- `npm run dev` — Vite dev server with HMR (served under `/movie_visualization/`)
- `npm run build` — TypeScript project-references check (`tsc -b`), then Vite production build
- `npm run lint` — ESLint over the repo
- `npm test` — Vitest, single pass (`npm run test:watch` to watch). Tests live next to source as `*.test.ts(x)` under jsdom; the `canvas` package backs `getContext`.
- `npm run data:build` — offline, deterministic: `data/movies.json` → similarity graph → layout → `src/generated/dataset.json`. Add `-- --preview out.png` to render the layout to a PNG for tuning.
- `npm run data:fetch` — network: TMDB top-rated → `data/movies.json` (needs `TMDB_API_KEY`; `-- --limit N`). Refuses to overwrite the file if more than 2% of requests fail unless `-- --allow-partial`. Run `data:build` afterwards.
- `npm run deploy` — `gh-pages -d dist` (Vite `base: '/movie_visualization/'`).

Node ≥ 22.18 is required: the data scripts are `.ts` files run directly by Node's native type stripping.

## Environment Setup

`.env` holds `TMDB_API_KEY=…` (v3 key or v4 read-access token), used only by `data:fetch` in Node. **Never prefix it with `VITE_`**: Vite inlines every `import.meta.env.VITE_*` reference into the public bundle, which is how an earlier key leaked. The browser never talks to TMDB except for poster images.

## Project Architecture

### Data pipeline (build time, never in the browser)

```
TMDB ──data:fetch──▶ data/movies.json ──data:build──▶ src/generated/dataset.json ──fetch──▶ app
       (network)       (canonical, 1 movie/line)       (graph + baked positions)
```

- `src/core/` is shared by the browser, the Node scripts, and tests. It must stay **DOM-free** and import siblings with explicit **`.ts` extensions** (Node's resolver needs them; Vite/tsc accept them via `allowImportingTsExtensions`). `erasableSyntaxOnly` is on, so no enums, namespaces, or constructor parameter properties anywhere.
- `core/graph.ts` — similarity graph. Candidate pairs come from inverted indexes (directors, billing-weighted cast, IDF-weighted keywords with mood/meta tags stoplisted and `"city, country"` locations half-weighted); genre Jaccard only sharpens scores, plus a fallback so no film is isolated. Each film keeps its top neighbors under a degree cap. `sharedAttributes()` explains an edge to the UI.
- `core/layout.ts` — seeded Mulberry32 + d3-force, deterministic for a given input. Genre-family anchors on a ring give readable continents; **only links with weight ≥ `layoutMinWeight` pull on the layout** (weak links are still drawn), which keeps clusters tight; collision turns on late (`collideAfter`). Retune with `data:build -- --preview`.
- `core/dataset.ts` — format v5: one interned string table, tuple rows, flat edge quads, positions always baked. Decoding validates every field and throws a `DatasetError` (version mismatch → "run `data:build`"). The build stamps a hash of every pipeline input (`scripts/inputHash.ts`: the data plus the graph/layout/codec sources) into the file, and `scripts/dataset.test.ts` fails when it no longer matches — after editing any of those files, run `npm run data:build`.
- `core/genres.ts` — the **single palette**. A film's family is its most distinctive genre by `GENRE_PRIORITY`, not `genres[0]`. Legend, panels, and stars all read from here.
- Node indices (position in `dataset.nodes`), not TMDB ids, identify films everywhere at runtime; edges store indices.

### Runtime

- `main.tsx` starts the dataset fetch (`stores/loadDataset.ts`, URL via `?url` so it is content-hashed) and the lazy Pixi chunk in parallel before React renders.
- `stores/graphStore.ts` (Zustand) holds the dataset, `selected` / `hovered` node indices, `activeMask` (connection-type bits from `core/connections.ts`), `query`, and the ranked `matches` (search index built lazily on the first query). Components subscribe with narrow selectors.
- `components/StarfieldCanvas.tsx` mounts the renderer once and pipes store changes in via `useGraphStore.subscribe` — hover, selection, search, and filters never re-render React for the canvas. `HoverCard` follows the pointer by writing `transform` directly.
- `components/layout.ts` computes the screen insets panels cover (the camera asks before React mounts the details panel, so this is computed, not measured).

### Renderer (`render/StarfieldRenderer.ts`, imperative Pixi v8)

`stage → dust (2 TilingSprites, parallax) · world (render group, d3-zoom target) → edges · focusEdges · glows · rings · cores · labels (screen space)`.

- **Render on demand.** `autoStart: false`; frames are requested only by camera moves, state changes, or running animations. Pixi's federated event system is detached and `Ticker.system` stopped — both otherwise spin `requestAnimationFrame` forever. Verify any change here by counting idle rAF callbacks (should be 0).
- **Edges** (`render/edges.ts`) are built once as `pixelLine` hairline Graphics grouped by (mask, weight bucket). Filters and zoom LOD only flip `visible`/`tint`; nothing re-tessellates. Selected/hovered neighborhoods are redrawn in `focusEdges` with constant pixel width.
- **Stars** are one glow + one disc sprite each (shared mipmapped textures, tinted). They grow sub-linearly with zoom (`radiusScale`), and hit-testing (`render/hitTest.ts`, Flatbush) uses the same scale.
- **Labels** (`render/labels.ts`) are BitmapText placed greedily by priority (selected › hovered › neighbors/matches › ambient prominence) with a grid collision test, recomputed per camera frame, kept out of the areas UI chrome covers. Bitmap fonts are installed once per page after `document.fonts.load` (3 s timeout).
- **Camera**: selection flies (d3 `interpolateZoom`) to center the film with its 75th-percentile neighbor radius in view; animations respect `useReducedMotion`. Only real user camera movement (a d3 `zoom` event with a `sourceEvent`, outside our own `setTransform`) cancels a flight — never d3's `start`, which fires on every mousedown.

### Type contracts (`core/types.ts`)

- `Movie` — id, title, year, posterPath, rating, genres, directors, cast, keywords, overview.
- `MovieNode extends Movie` — adds index, x, y, family, radius, degree. Positions are always present.
- `Edge` — `{ source, target }` node indices, `mask` (connection bits), `weight` 0–1.
- `ConnectionType` — `'director' | 'cast' | 'theme' | 'genre'`.

## Tech Stack

- **Build**: Vite 7 + React 19 + Tailwind v4 (`@theme` tokens and `@utility` classes in `src/index.css`). `base: '/movie_visualization/'`.
- **Fonts**: self-hosted variable Fraunces (opsz, real italic) and JetBrains Mono via `@fontsource-variable/*`, imported in `main.tsx`. No Google Fonts: it was render-blocking and is unreachable in some regions.
- **State**: Zustand 5.
- **Graph**: Pixi.js 8 (WebGL) + d3-force (build-time layout) + d3-zoom/d3-selection/d3-interpolate (camera) + flatbush (hit testing). Do not reintroduce `react-force-graph`, `three`, IndexedDB caching, or in-browser TMDB fetching.
- **Testing**: Vitest + jsdom + `canvas`.

## Worktree note

`.worktrees/webgl-renderer/` is a stale sibling worktree from the WebGL migration (behind `main`). Treat it as a separate checkout — don't edit files there from the main checkout.
