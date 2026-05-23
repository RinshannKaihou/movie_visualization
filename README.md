# Movie Network

An interactive starfield of 2000 top-rated movies. Each star is a film; edges connect movies that share actors, directors, or genres. Pan, zoom, and click to explore the constellations that famous careers and collaborations leave behind.

**Live demo:** https://wangyipei06.github.io/movie_visualization/

![Movie Network screenshot](docs/screenshot.png)

> _Add `docs/screenshot.png` (or any other path) before publishing — the image link above is a placeholder._

## What it does

- Renders ~2000 of TMDB's top-rated movies as a force-directed graph in WebGL.
- Connects films by shared cast, shared director, or shared genre. Edge thickness encodes how many of those dimensions overlap.
- Selecting a film fades the rest of the sky and animates photons along the strongest connections out of it.
- Search and filter to narrow the constellation.

## Tech stack

| Library | Why |
| --- | --- |
| **React 19** + **TypeScript** | UI shell, panels, store wiring. |
| **Pixi.js 8** (WebGL) | Single-batch renderer for 2000 nodes + ~10k edges at 60 fps. |
| **d3-force** (in a Web Worker) | Deterministic seeded layout; positions are baked into the static data at build time so the deployed site does no physics at runtime. |
| **d3-zoom / d3-selection** | Pan/zoom interaction that drives the Pixi world transform. |
| **flatbush** | Static R-tree for O(log n) pointer hit-testing against pinned node positions. |
| **Zustand** | Tiny store for selected movie, filters, search query, zoom level. |
| **idb** | IndexedDB cache (7-day TTL) when running against the live TMDB API. |
| **Vite 7** + **Tailwind v4** | Dev server, build, styling. |

## Running locally

You need Node.js ≥ 20.

```bash
git clone https://github.com/wangyipei06/movie_visualization.git
cd movie_visualization
cp .env.example .env          # fill in your TMDB key
npm install
npm run build:data            # fetch 2000 movies from TMDB (~5 minutes, one-time)
npm run dev
```

Get a free TMDB API key at https://www.themoviedb.org/settings/api and put it in `.env` as `VITE_TMDB_API_KEY=...`.

If you already have `public/data/movies.json` (committed in this repo), you can skip `npm run build:data` and the dev server will load the static dataset directly.

## Architecture in 90 seconds

The data flows through three sources in priority order and every path funnels through the same position guard before the renderer ever sees a node:

1. **Static JSON** (`public/data/movies.json`) — pre-built by `scripts/build-static-data.mjs` with layout positions baked in. This is what the deployed site uses.
2. **IndexedDB cache** — 7-day TTL, holds the last fetched dataset with positions baked in.
3. **Live TMDB** — paginated fetch with rate-limit backoff, runs the layout worker on first arrival, then caches.

The Pixi scene graph is `stage → bgStars → world (pan/zoom target) → edges → nodes`. Pointer hits go through a flatbush R-tree built once from the pinned positions; the runtime physics simulation is **frozen** (no ticks). For more detail see [`CLAUDE.md`](./CLAUDE.md).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server with HMR. |
| `npm run build` | TypeScript project-references check, then Vite production build. |
| `npm run lint` | ESLint over the repo. |
| `npm test` | Vitest run (single pass); `npm run test:watch` for watch mode. |
| `npm run build:data` | Fetch 2000 top-rated movies from TMDB and emit `public/data/movies.json` with layout positions baked in. Required before deploying so the public site works without an API key. |
| `npm run deploy` | `gh-pages -d dist` — manual deploy to GitHub Pages. |

## Acknowledgements

This product uses the TMDB API but is not endorsed or certified by TMDB.

<a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">
  TMDB attribution logo
</a>
&nbsp;— download the official logo from https://www.themoviedb.org/about/logos-attribution and replace this link with an `<img>` before publishing.

## License

MIT — see [`LICENSE`](./LICENSE).
