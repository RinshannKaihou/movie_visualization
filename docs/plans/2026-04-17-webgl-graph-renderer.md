# WebGL Graph Renderer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the canvas 2D `react-force-graph` renderer with a PixiJS-based
`<StarfieldCanvas>` that hits 60fps on desktop / 45fps+ on mobile at 2000
movies while elevating the Celestial Cinema aesthetic.

**Architecture:** New `<StarfieldCanvas>` owns a Pixi `Application` with a
batched star layer (`ParticleContainer`), a single-draw edge layer
(`PIXI.Graphics`), a focused-only photon layer, and a Pixi-native backdrop.
Layout runs once off-thread and positions are pinned; all runtime work is
pure rendering. Pan/zoom via `d3-zoom`, hit-test via `Flatbush`.

**Tech Stack:** React 19 · TypeScript · Vite · Zustand · PixiJS (new) ·
d3-zoom (new) · Flatbush (new) · Vitest (new, for tests) · d3-force (moved
to a Web Worker).

**Reference:** see the approved design at
[docs/plans/2026-04-17-webgl-graph-renderer-design.md](2026-04-17-webgl-graph-renderer-design.md).

---

## Conventions for every task in this plan

- **TDD where applicable.** Pure functions (hit-test, viewport cull, LOD,
  layout) get a failing test first. Rendering tasks are verified manually
  (screenshot + FPS profile) since WebGL can't run under jsdom.
- **Commits are frequent.** Each task ends with a commit. Pre-commit hook
  runs `tsc -b` and `eslint` — do not bypass with `--no-verify`.
- **Never run a d3-force tick on the main thread.** Any simulation work is
  in `src/workers/layoutWorker.ts` from Task 1.4 onward.
- **Never mutate a node's `x`/`y` in a render path.** Positions are data;
  rendering only reads them.
- **Work on feature branches.** Don't push to `main` between tasks; let the
  user PR/merge when a stage is complete.

---

## Stage 0 — Tooling prerequisites

### Task 0.1: Install Vitest + jsdom

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

**Step 1: Install packages**

```bash
npm install --save-dev vitest @vitest/ui jsdom @vitest/coverage-v8
```

**Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: { reporter: ['text', 'html'], include: ['src/**'] },
  },
});
```

**Step 3: Add test script to `package.json`**

In `"scripts"`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 4: Sanity check — run empty test suite**

Run: `npm test`
Expected: exits 0 with "No test files found" (Vitest 1.x) or 0 files.

**Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add Vitest + jsdom for unit tests"
```

---

## Stage 1 — Pin positions + layout worker

**Goal of this stage:** kill runtime force simulation. Layout runs once in a
worker on Resurvey; otherwise positions come pre-baked from the static JSON.
ForceGraph2D still renders. After this stage, initial load + filter toggles
should already be noticeably smoother.

### Task 1.1: Add a seeded, deterministic layout function

**Files:**
- Create: `src/services/layout.ts`
- Create: `src/services/layout.test.ts`

**Step 1: Write the failing test**

```ts
// src/services/layout.test.ts
import { describe, it, expect } from 'vitest';
import { computeLayout } from './layout';
import type { Movie, MovieEdge } from '../types';

const fakeMovie = (id: number): Movie => ({
  id, title: `M${id}`, year: 2000, poster: '', rating: 7,
  genres: ['Drama'], directors: [], leadActors: [], plotKeywords: [],
  overview: '',
});

describe('computeLayout', () => {
  it('returns same positions for same seed', () => {
    const nodes = [fakeMovie(1), fakeMovie(2), fakeMovie(3)];
    const edges: MovieEdge[] = [
      { source: 1, target: 2, types: ['same_genre'], strength: 1 },
    ];
    const a = computeLayout(nodes, edges, { seed: 42, iterations: 50 });
    const b = computeLayout(nodes, edges, { seed: 42, iterations: 50 });
    expect(a).toEqual(b);
  });

  it('produces a position for every node', () => {
    const nodes = [fakeMovie(1), fakeMovie(2)];
    const result = computeLayout(nodes, [], { seed: 1, iterations: 10 });
    expect(result.size).toBe(2);
    expect(result.get(1)).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- layout`
Expected: FAIL — `computeLayout` not found.

**Step 3: Write the minimal implementation**

```ts
// src/services/layout.ts
import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force';
import type { Movie, MovieEdge } from '../types';

export interface LayoutOptions {
  seed: number;
  iterations: number;
}

export type LayoutPositions = Map<number, { x: number; y: number }>;

// Deterministic PRNG so a given seed always returns the same layout.
// Mulberry32 — tiny, good enough for seeded jitter on initial positions.
const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

export const computeLayout = (
  movies: Movie[],
  edges: MovieEdge[],
  { seed, iterations }: LayoutOptions,
): LayoutPositions => {
  const rng = mulberry32(seed);
  const nodes = movies.map(m => ({ id: m.id, x: (rng() - 0.5) * 800, y: (rng() - 0.5) * 800 }));
  const links = edges.map(e => ({ source: e.source, target: e.target, strength: e.strength }));

  const sim = forceSimulation(nodes as any)
    .force('link', forceLink(links).id((d: any) => d.id).distance(40).strength(0.4))
    .force('charge', forceManyBody().strength(-60))
    .force('center', forceCenter(0, 0))
    .stop();

  for (let i = 0; i < iterations; i++) sim.tick();

  const positions: LayoutPositions = new Map();
  for (const n of nodes as any[]) positions.set(n.id, { x: n.x, y: n.y });
  return positions;
};
```

**Step 4: Run test to verify it passes**

Run: `npm test -- layout`
Expected: both tests PASS.

**Step 5: Install d3-force**

```bash
npm install d3-force
npm install --save-dev @types/d3-force
```

**Step 6: Commit**

```bash
git add src/services/layout.ts src/services/layout.test.ts package.json package-lock.json
git commit -m "feat: add seeded, deterministic layout function"
```

---

### Task 1.2: Move layout into a Web Worker

**Files:**
- Create: `src/workers/layoutWorker.ts`
- Create: `src/services/layoutClient.ts`
- Create: `src/services/layoutClient.test.ts`

**Step 1: Write the failing test**

```ts
// src/services/layoutClient.test.ts
import { describe, it, expect, vi } from 'vitest';
import { runLayoutInWorker } from './layoutClient';
import type { Movie, MovieEdge } from '../types';

// jsdom doesn't ship a Worker global. We stub it so the test verifies
// runLayoutInWorker's messaging contract, not real parallelism.
describe('runLayoutInWorker', () => {
  it('posts movies+edges+options and resolves with positions', async () => {
    const onmessage = vi.fn();
    const postMessage = vi.fn();
    class FakeWorker {
      onmessage: ((e: any) => void) | null = null;
      constructor() { onmessage(this); }
      postMessage = (msg: any) => {
        postMessage(msg);
        queueMicrotask(() => this.onmessage?.({ data: { positions: [[1, { x: 0, y: 0 }]] } }));
      };
      terminate() {}
    }
    (globalThis as any).Worker = FakeWorker;

    const result = await runLayoutInWorker(
      [{ id: 1 } as Movie], [] as MovieEdge[], { seed: 1, iterations: 5 },
    );
    expect(result.get(1)).toEqual({ x: 0, y: 0 });
    expect(postMessage).toHaveBeenCalledWith({
      movies: [{ id: 1 }], edges: [], options: { seed: 1, iterations: 5 },
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- layoutClient`
Expected: FAIL — module not found.

**Step 3: Write worker**

```ts
// src/workers/layoutWorker.ts
import { computeLayout } from '../services/layout';
import type { Movie, MovieEdge } from '../types';
import type { LayoutOptions } from '../services/layout';

self.onmessage = (e: MessageEvent<{
  movies: Movie[]; edges: MovieEdge[]; options: LayoutOptions;
}>) => {
  const { movies, edges, options } = e.data;
  const positions = computeLayout(movies, edges, options);
  // Map isn't structured-cloneable through some shims — send as entries.
  self.postMessage({ positions: Array.from(positions.entries()) });
};
```

**Step 4: Write client**

```ts
// src/services/layoutClient.ts
import type { Movie, MovieEdge } from '../types';
import type { LayoutOptions, LayoutPositions } from './layout';

export const runLayoutInWorker = (
  movies: Movie[],
  edges: MovieEdge[],
  options: LayoutOptions,
): Promise<LayoutPositions> => {
  const worker = new Worker(
    new URL('../workers/layoutWorker.ts', import.meta.url),
    { type: 'module' },
  );
  return new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<{ positions: [number, { x: number; y: number }][] }>) => {
      resolve(new Map(e.data.positions));
      worker.terminate();
    };
    worker.onerror = (err) => { reject(err); worker.terminate(); };
    worker.postMessage({ movies, edges, options });
  });
};
```

**Step 5: Run test to verify it passes**

Run: `npm test -- layoutClient`
Expected: PASS.

**Step 6: Commit**

```bash
git add src/workers/layoutWorker.ts src/services/layoutClient.ts src/services/layoutClient.test.ts
git commit -m "feat: add Web Worker wrapper for layout computation"
```

---

### Task 1.3: Wire Resurvey to use the worker

**Files:**
- Modify: `src/hooks/useMovieData.ts`

**Step 1: Read current `useMovieData.ts`**

Open `src/hooks/useMovieData.ts` and locate the branch that handles refresh
from TMDB (calls `fetchTopMovies` / `buildGraphData`).

**Step 2: After `buildGraphData(...)`, run worker layout and merge positions**

Pseudo-diff (adapt to actual function names):

```ts
// after: const graph = buildGraphData(movies);
const positions = await runLayoutInWorker(movies, graph.links, { seed: 1, iterations: 220 });
const placedNodes = graph.nodes.map(n => {
  const p = positions.get(n.id);
  return p ? { ...n, x: p.x, y: p.y } : n;
});
setGraph({ nodes: placedNodes, links: graph.links });
```

**Step 3: Manual verification**

Run: `npm run dev`
Click the "Resurvey" button in the UI. Expected: graph re-layouts without
freezing the main thread; the button/tooltip remains interactive during layout.

**Step 4: Commit**

```bash
git add src/hooks/useMovieData.ts
git commit -m "feat: run layout in worker on Resurvey"
```

---

### Task 1.4: Freeze runtime simulation in ForceGraph2D

**Files:**
- Modify: `src/components/MovieGraph.tsx`

**Step 1: Locate the simulation-tuning props**

In `MovieGraph.tsx` find `warmupTicks`, `cooldownTicks`, `cooldownTime`,
`d3AlphaDecay`, `d3VelocityDecay` on the `<ForceGraph2D>` element.

**Step 2: Set all to zero / max decay so simulation is effectively disabled**

```tsx
warmupTicks={0}
cooldownTicks={0}
cooldownTime={0}
d3AlphaDecay={1}
d3VelocityDecay={1}
```

Also pass `d3Force={null}` if the component supports it, to reduce allocation
of force objects the sim will never tick. Check react-force-graph docs; if the
prop doesn't exist, leaving the decay params at 1 is sufficient.

**Step 3: Manual verification**

Run: `npm run dev`
Expected: nodes load with pinned positions (no drift after first paint).
Confirm in DevTools Performance tab: no recurring `tick` samples after
the first frame.

**Step 4: Commit**

```bash
git add src/components/MovieGraph.tsx
git commit -m "perf: freeze force simulation at runtime; positions come pinned"
```

---

### Task 1.5: Measure Stage 1 perf baseline

**Files:**
- Create: `docs/plans/2026-04-17-webgl-graph-renderer-perf.md`

**Step 1: Record baselines**

Run `npm run dev`, open Chrome DevTools → Performance → start recording,
perform:
1. Reload page.
2. Pan graph with mouse drag for 3 seconds.
3. Click a movie to focus.
4. Toggle each filter chip.

Stop recording. For each scenario, record FPS and main-thread busy time.

**Step 2: Document in a perf tracker file**

Create `docs/plans/2026-04-17-webgl-graph-renderer-perf.md` with a table:

```markdown
# Perf tracker

| Stage | Scenario | FPS | Main-thread busy | Notes |
|---|---|---|---|---|
| Stage 1 | Initial load | … | … | pinned positions, no runtime tick |
| Stage 1 | Pan/zoom | … | … | |
| Stage 1 | Movie select | … | … | |
| Stage 1 | Filter toggle | … | … | |
```

**Step 3: Commit**

```bash
git add docs/plans/2026-04-17-webgl-graph-renderer-perf.md
git commit -m "docs: record Stage 1 perf baseline"
```

---

## Stage 2 — StarfieldCanvas behind a feature flag

**Goal of this stage:** build the Pixi renderer, mount it behind a flag so we
can A/B against ForceGraph2D. By end of stage the Pixi scene should visually
match the current graph on all canonical states.

### Task 2.1: Install Pixi, d3-zoom, Flatbush

```bash
npm install pixi.js d3-zoom flatbush
npm install --save-dev @types/d3-zoom
```

Verify versions installed, then commit:

```bash
git add package.json package-lock.json
git commit -m "chore: add pixi.js, d3-zoom, flatbush deps"
```

---

### Task 2.2: Add feature flag plumbing

**Files:**
- Modify: `src/components/GraphScene.tsx`
- Modify: `.env.example` (create if missing)

**Step 1: Read current `GraphScene.tsx` MovieGraph import**

**Step 2: Add conditional render gated by `import.meta.env.VITE_USE_PIXI`**

```tsx
// near the top of GraphScene.tsx return
{import.meta.env.VITE_USE_PIXI === 'true'
  ? <StarfieldCanvas />
  : <MovieGraph />}
```

Add `import { StarfieldCanvas } from './StarfieldCanvas';` — file doesn't
exist yet; TypeScript will error. That's fine; next task creates it as a
stub.

**Step 3: Add to `.env.example`**

```
VITE_TMDB_API_KEY=your_key_here
VITE_USE_PIXI=false
```

**Step 4: Commit after Task 2.3 makes the import resolve.**

---

### Task 2.3: Stub `<StarfieldCanvas>`

**Files:**
- Create: `src/components/StarfieldCanvas.tsx`

**Step 1: Write minimal stub**

```tsx
// src/components/StarfieldCanvas.tsx
import { useEffect, useRef } from 'react';
import { Application } from 'pixi.js';

export const StarfieldCanvas = () => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const app = new Application();
    let cancelled = false;
    app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    }).then(() => {
      if (cancelled) { app.destroy(true, { children: true, texture: true }); return; }
      host.appendChild(app.canvas);
    });
    return () => {
      cancelled = true;
      app.destroy(true, { children: true, texture: true });
    };
  }, []);

  return (
    <div
      ref={hostRef}
      style={{ position: 'absolute', inset: 0 }}
    />
  );
};
```

**Step 2: Build to confirm no TypeScript errors**

Run: `npm run build`
Expected: succeeds.

**Step 3: Manual check**

Run with the flag on: `VITE_USE_PIXI=true npm run dev`
Expected: transparent Pixi canvas mounts; no stars yet. No console errors.

**Step 4: Commit (Task 2.2 + Task 2.3 together)**

```bash
git add src/components/GraphScene.tsx src/components/StarfieldCanvas.tsx .env.example
git commit -m "feat: stub StarfieldCanvas behind VITE_USE_PIXI flag"
```

---

### Task 2.4: Halo texture service

**Files:**
- Create: `src/services/textures.ts`
- Create: `src/services/textures.test.ts`

**Step 1: Write the failing test**

```ts
// src/services/textures.test.ts
import { describe, it, expect } from 'vitest';
import { buildHaloBitmap } from './textures';

describe('buildHaloBitmap', () => {
  it('returns a canvas of the requested size', () => {
    const canvas = buildHaloBitmap(128);
    expect(canvas.width).toBe(128);
    expect(canvas.height).toBe(128);
  });

  it('center pixel alpha is max, corner alpha is ~0', () => {
    const canvas = buildHaloBitmap(64);
    const ctx = canvas.getContext('2d')!;
    const center = ctx.getImageData(32, 32, 1, 1).data[3];
    const corner = ctx.getImageData(0, 0, 1, 1).data[3];
    expect(center).toBeGreaterThan(240);
    expect(corner).toBeLessThan(20);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- textures`
Expected: FAIL.

**Step 3: Write implementation**

```ts
// src/services/textures.ts

// True Gaussian falloff: alpha = exp(-k * r^2). Smoother than a multi-stop
// radial gradient and avoids the banded shoulder the old sprite had.
export const buildHaloBitmap = (size: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const half = size / 2;
  const sigma = half / 2.2;
  const inv2Sig2 = 1 / (2 * sigma * sigma);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - half;
      const dy = y - half;
      const a = Math.exp(-(dx * dx + dy * dy) * inv2Sig2);
      const i = (y * size + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.min(255, Math.round(a * 255));
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
};
```

**Step 4: Run test to verify it passes**

Run: `npm test -- textures`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/services/textures.ts src/services/textures.test.ts
git commit -m "feat: Gaussian halo texture builder"
```

---

### Task 2.5: Render stars in StarfieldCanvas

**Files:**
- Modify: `src/components/StarfieldCanvas.tsx`

**Step 1: Wire up store + build star ParticleContainer**

Expand `StarfieldCanvas.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { Application, Container, ParticleContainer, Sprite, Texture, BLEND_MODES } from 'pixi.js';
import { useGraphStore } from '../stores/graphStore';
import { buildHaloBitmap } from '../services/textures';
import { getNodeColor, getNodeSize } from '../services/graphBuilder';

const HALO_SIZE = 256;

export const StarfieldCanvas = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const nodes = useGraphStore(s => s.nodes);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const app = new Application();
    let cancelled = false;
    let stars: ParticleContainer | null = null;

    app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    }).then(() => {
      if (cancelled) { app.destroy(true, { children: true, texture: true }); return; }
      host.appendChild(app.canvas);

      // Shared Gaussian halo texture.
      const haloTex = Texture.from(buildHaloBitmap(HALO_SIZE));

      const world = new Container();
      world.x = app.screen.width / 2;
      world.y = app.screen.height / 2;
      app.stage.addChild(world);

      stars = new ParticleContainer({
        dynamicProperties: { position: true, scale: false, tint: false, rotation: false },
      });
      world.addChild(stars);

      for (const node of nodes) {
        if (node.x == null || node.y == null) continue;
        const s = new Sprite(haloTex);
        s.anchor.set(0.5);
        const r = getNodeSize(node.rating);
        s.scale.set((r * 6) / HALO_SIZE);
        s.tint = getNodeColor(node.genres);
        s.blendMode = 'add';
        s.x = node.x;
        s.y = node.y;
        stars.addChild(s);
      }
    });

    return () => {
      cancelled = true;
      app.destroy(true, { children: true, texture: true });
    };
    // Deliberate: rebuild on nodes change (data load is rare).
  }, [nodes]);

  return <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />;
};
```

**Step 2: Convert hex genre colors to Pixi tints**

Pixi tints are 24-bit integers. Add a helper in `textures.ts`:

```ts
export const hexToTintInt = (hex: string): number => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return parseInt(full, 16);
};
```

Update `StarfieldCanvas.tsx` to use `s.tint = hexToTintInt(getNodeColor(node.genres));`.

**Step 3: Manual verification**

Run: `VITE_USE_PIXI=true npm run dev`
Expected: 2000 warm-tinted halos appear centered on the canvas. No edges yet.

**Step 4: Commit**

```bash
git add src/components/StarfieldCanvas.tsx src/services/textures.ts
git commit -m "feat: render stars in StarfieldCanvas via ParticleContainer"
```

---

### Task 2.6: Viewport service (zoom transform + cull math)

**Files:**
- Create: `src/services/viewport.ts`
- Create: `src/services/viewport.test.ts`

**Step 1: Write the failing test**

```ts
// src/services/viewport.test.ts
import { describe, it, expect } from 'vitest';
import { isEdgeVisible, lodRatingCutoff, lodStrengthCutoff } from './viewport';

describe('isEdgeVisible', () => {
  const view = { minX: 0, minY: 0, maxX: 100, maxY: 100 };

  it('returns true if either endpoint is inside the viewport', () => {
    expect(isEdgeVisible({ x: 50, y: 50 }, { x: 200, y: 200 }, view)).toBe(true);
  });

  it('returns false if segment bbox misses viewport entirely', () => {
    expect(isEdgeVisible({ x: -50, y: -50 }, { x: -10, y: -10 }, view)).toBe(false);
  });
});

describe('lodRatingCutoff', () => {
  it('hides low-rated stars at extreme zoom out', () => {
    expect(lodRatingCutoff(0.3)).toBeGreaterThanOrEqual(8.0);
  });
  it('shows everything at zoom >= 1', () => {
    expect(lodRatingCutoff(1.0)).toBe(0);
  });
});

describe('lodStrengthCutoff', () => {
  it('hides weak edges at low zoom', () => {
    expect(lodStrengthCutoff(0.3)).toBeGreaterThanOrEqual(3);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- viewport`
Expected: FAIL.

**Step 3: Write implementation**

```ts
// src/services/viewport.ts
export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }
export interface Point { x: number; y: number }

export const isEdgeVisible = (a: Point, b: Point, view: Bounds): boolean => {
  const segMinX = Math.min(a.x, b.x);
  const segMaxX = Math.max(a.x, b.x);
  const segMinY = Math.min(a.y, b.y);
  const segMaxY = Math.max(a.y, b.y);
  return !(segMaxX < view.minX || segMinX > view.maxX || segMaxY < view.minY || segMinY > view.maxY);
};

// LOD: at zoom < 0.4 only rating >= 8 drawn bright; 0.4–1.0 show all; >=1.0 full.
export const lodRatingCutoff = (zoom: number): number => {
  if (zoom < 0.4) return 8.0;
  if (zoom < 1.0) return 0;
  return 0;
};

export const lodStrengthCutoff = (zoom: number): number => {
  if (zoom < 0.4) return 3;
  if (zoom < 1.0) return 2;
  return 1;
};
```

**Step 4: Run test to verify it passes**

Run: `npm test -- viewport`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/services/viewport.ts src/services/viewport.test.ts
git commit -m "feat: viewport culling + LOD threshold helpers"
```

---

### Task 2.7: Hit-test service

**Files:**
- Create: `src/services/hitTest.ts`
- Create: `src/services/hitTest.test.ts`

**Step 1: Write the failing test**

```ts
// src/services/hitTest.test.ts
import { describe, it, expect } from 'vitest';
import { buildHitIndex } from './hitTest';

describe('buildHitIndex', () => {
  const nodes = [
    { id: 1, x: 0, y: 0, radius: 5 },
    { id: 2, x: 50, y: 50, radius: 5 },
    { id: 3, x: -30, y: 40, radius: 5 },
  ];

  it('returns the nearest node within tolerance', () => {
    const idx = buildHitIndex(nodes);
    expect(idx.pick(1, 1)?.id).toBe(1);
    expect(idx.pick(51, 50)?.id).toBe(2);
  });

  it('returns null if click is outside all radii', () => {
    const idx = buildHitIndex(nodes);
    expect(idx.pick(200, 200)).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- hitTest`
Expected: FAIL.

**Step 3: Write implementation**

```ts
// src/services/hitTest.ts
import Flatbush from 'flatbush';

export interface HitNode { id: number; x: number; y: number; radius: number }

export interface HitIndex {
  pick: (x: number, y: number) => HitNode | null;
}

export const buildHitIndex = (nodes: HitNode[]): HitIndex => {
  if (nodes.length === 0) {
    return { pick: () => null };
  }
  const index = new Flatbush(nodes.length);
  for (const n of nodes) {
    index.add(n.x - n.radius, n.y - n.radius, n.x + n.radius, n.y + n.radius);
  }
  index.finish();

  return {
    pick: (x, y) => {
      const ids = index.search(x, y, x, y);
      if (ids.length === 0) return null;
      let best: HitNode | null = null;
      let bestDist = Infinity;
      for (const i of ids) {
        const n = nodes[i];
        const dx = n.x - x;
        const dy = n.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= n.radius * n.radius && d2 < bestDist) {
          best = n;
          bestDist = d2;
        }
      }
      return best;
    },
  };
};
```

**Step 4: Run test to verify it passes**

Run: `npm test -- hitTest`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/services/hitTest.ts src/services/hitTest.test.ts
git commit -m "feat: Flatbush-backed hit-test index"
```

---

### Task 2.8: Render edges in StarfieldCanvas

**Files:**
- Modify: `src/components/StarfieldCanvas.tsx`

**Step 1: Add edge Graphics layer**

Inside the `app.init().then(...)` block, after adding the star container:

```tsx
import { Graphics } from 'pixi.js';
import { getEdgeColor } from '../services/graphBuilder';
import { hexToTintInt } from '../services/textures';

const edgeLayer = new Graphics();
edgeLayer.blendMode = 'add';
world.addChildAt(edgeLayer, 0); // behind the stars

const rebuildEdges = (edges: MovieEdge[]) => {
  edgeLayer.clear();
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  for (const e of edges) {
    const s = nodeById.get(e.source as number);
    const t = nodeById.get(e.target as number);
    if (!s || !t || s.x == null || t.x == null) continue;
    const alpha = 0.10 + Math.min(e.strength - 1, 3) * 0.04;
    edgeLayer.moveTo(s.x, s.y)
      .lineTo(t.x, t.y)
      .stroke({ color: hexToTintInt(getEdgeColor(e.types)), alpha, width: 0.6 + (e.strength - 1) * 0.3 });
  }
};
```

**Step 2: Subscribe to visibleEdges from Zustand**

Replace the static-at-mount edge build with a store subscription. Use
`useGraphStore.subscribe` inside the effect to call `rebuildEdges` when edges
change.

```tsx
const unsub = useGraphStore.subscribe(
  state => state.edges,
  edges => rebuildEdges(edges),
  { fireImmediately: true },
);
```

(Adapt to the store's actual selector contract; if the store uses the
`useGraphFilters` hook for visible edges, expose `visibleEdges` as a store
slice or memo-compute it here.)

**Step 3: Manual verification**

Run: `VITE_USE_PIXI=true npm run dev`
Expected: thin additive-blended edges appear between connected stars.

**Step 4: Commit**

```bash
git add src/components/StarfieldCanvas.tsx
git commit -m "feat: batched edge rendering in StarfieldCanvas"
```

---

### Task 2.9: Pan and zoom with d3-zoom

**Files:**
- Modify: `src/components/StarfieldCanvas.tsx`
- Modify: `src/stores/graphStore.ts`

**Step 1: Add `zoom` to the store**

```ts
// in graphStore.ts
zoom: 1,
setZoom: (z: number) => set({ zoom: z }),
```

**Step 2: Wire d3-zoom to the Pixi canvas**

```tsx
import { select } from 'd3-selection';
import { zoom as d3Zoom, zoomIdentity } from 'd3-zoom';

// inside app.init().then(...)
const d3zoom = d3Zoom<HTMLCanvasElement, unknown>()
  .scaleExtent([0.15, 6])
  .on('zoom', (event) => {
    world.position.set(event.transform.x, event.transform.y);
    world.scale.set(event.transform.k);
    useGraphStore.getState().setZoom(event.transform.k);
  });
select(app.canvas as any).call(d3zoom);
// Start centered.
select(app.canvas as any).call(
  d3zoom.transform,
  zoomIdentity.translate(app.screen.width / 2, app.screen.height / 2).scale(1),
);
```

Install `d3-selection` if not already present:

```bash
npm install d3-selection
npm install --save-dev @types/d3-selection
```

**Step 3: Manual verification**

Run: `VITE_USE_PIXI=true npm run dev`
Expected: mouse drag pans the graph; scroll zooms. Scene stays centered on
load.

**Step 4: Commit**

```bash
git add src/components/StarfieldCanvas.tsx src/stores/graphStore.ts package.json package-lock.json
git commit -m "feat: d3-zoom pan/zoom on Pixi canvas"
```

---

### Task 2.10: Hover and selection via hit-test

**Files:**
- Modify: `src/components/StarfieldCanvas.tsx`

**Step 1: Build hit index when nodes change**

```tsx
import { buildHitIndex } from '../services/hitTest';
import { getNodeSize } from '../services/graphBuilder';

const hitIndex = buildHitIndex(nodes.map(n => ({
  id: n.id, x: n.x!, y: n.y!, radius: getNodeSize(n.rating) * 1.5,
})));
```

**Step 2: Attach pointer handlers to canvas**

```tsx
let lastHoverId: number | null = null;

const toWorld = (clientX: number, clientY: number) => {
  const rect = app.canvas.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  return {
    x: (sx - world.x) / world.scale.x,
    y: (sy - world.y) / world.scale.y,
  };
};

app.canvas.addEventListener('pointermove', (e) => {
  const { x, y } = toWorld(e.clientX, e.clientY);
  const hit = hitIndex.pick(x, y);
  const id = hit?.id ?? null;
  if (id !== lastHoverId) {
    lastHoverId = id;
    const node = id == null ? null : nodes.find(n => n.id === id) || null;
    useGraphStore.getState().setHoveredNode?.(node);
  }
});

app.canvas.addEventListener('click', (e) => {
  const { x, y } = toWorld(e.clientX, e.clientY);
  const hit = hitIndex.pick(x, y);
  if (hit) useGraphStore.getState().selectMovie(nodes.find(n => n.id === hit.id)!);
});
```

If the store doesn't yet have `hoveredNode` / `setHoveredNode`, add them:

```ts
hoveredNode: null as MovieNode | null,
setHoveredNode: (node: MovieNode | null) => set({ hoveredNode: node }),
```

**Step 3: Manual verification**

Run: `VITE_USE_PIXI=true npm run dev`
Hover a star → tooltip shows (via existing `<NodeTooltip>` wired to
`hoveredNode`). Click → details panel opens.

**Step 4: Commit**

```bash
git add src/components/StarfieldCanvas.tsx src/stores/graphStore.ts
git commit -m "feat: pointer hit-test wired to store for hover/select"
```

---

### Task 2.11: Visual parity check

**Files:**
- Modify: `docs/plans/2026-04-17-webgl-graph-renderer-perf.md`

**Step 1: Capture screenshots of four canonical states in both renderers**

With `VITE_USE_PIXI=false` and `=true`, capture:
1. Unfocused full graph.
2. "Inception" selected.
3. Only "Actor" filter active.
4. Extreme zoom-out.

Save to `docs/plans/screenshots/` (create directory).

**Step 2: Record Stage 2 perf numbers**

Same Chrome Performance recording protocol as Task 1.5, add a Stage 2 row.

**Step 3: Commit**

```bash
git add docs/plans/screenshots/ docs/plans/2026-04-17-webgl-graph-renderer-perf.md
git commit -m "docs: Stage 2 visual parity + perf numbers"
```

---

## Stage 3 — Cut over

### Task 3.1: Make StarfieldCanvas default

**Files:**
- Modify: `src/components/GraphScene.tsx`
- Modify: `.env.example`

**Step 1: Remove the feature flag branch**

```tsx
// GraphScene.tsx
<StarfieldCanvas />
```

Delete the `MovieGraph` import.

**Step 2: Remove `VITE_USE_PIXI` from `.env.example`**

**Step 3: Manual verification**

Run: `npm run dev` (without env flag). StarfieldCanvas renders.

**Step 4: Commit**

```bash
git add src/components/GraphScene.tsx .env.example
git commit -m "feat: make StarfieldCanvas the default renderer"
```

---

### Task 3.2: Remove `react-force-graph` deps and MovieGraph

**Files:**
- Delete: `src/components/MovieGraph.tsx`
- Modify: `package.json`
- Modify: `src/hooks/useGraphMode.ts` (keep for now, simplify in Stage 5)

**Step 1: Delete MovieGraph.tsx**

```bash
git rm src/components/MovieGraph.tsx
```

**Step 2: Uninstall packages**

```bash
npm uninstall react-force-graph-2d react-force-graph-3d
```

**Step 3: Run build to catch dead imports**

Run: `npm run build`
Expected: succeeds. Fix any compile errors from leftover imports.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: drop react-force-graph deps and MovieGraph component"
```

---

## Stage 4 — Aesthetics

### Task 4.1: Nebula texture

**Files:**
- Create: `src/services/nebulaTexture.ts`
- Modify: `src/components/StarfieldCanvas.tsx`
- Modify: `src/components/GraphScene.tsx`

**Step 1: Write Perlin/FBM noise texture generator**

```ts
// src/services/nebulaTexture.ts
// Simple FBM value-noise — cheap, runs in ~50ms for 2048×1024 on a laptop.
// Tints output toward violet/rose/teal for the nebula look.
export const buildNebulaBitmap = (width: number, height: number, seed = 7): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  const rand = (x: number, y: number) => {
    const n = Math.sin((x * 127.1 + y * 311.7 + seed) * 43758.5453);
    return n - Math.floor(n);
  };
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = smooth(xf), v = smooth(yf);
    return lerp(
      lerp(rand(xi, yi), rand(xi + 1, yi), u),
      lerp(rand(xi, yi + 1), rand(xi + 1, yi + 1), u),
      v,
    );
  };
  const fbm = (x: number, y: number) => {
    let sum = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < 5; i++) { sum += amp * noise(x * freq, y * freq); amp *= 0.5; freq *= 2; }
    return sum;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const n = fbm(x / 200, y / 200);
      const violet = n;
      const rose = fbm(x / 300 + 100, y / 300);
      const teal = fbm(x / 250 + 200, y / 250);
      const i = (y * width + x) * 4;
      img.data[i] = Math.round(violet * 140 + rose * 80);
      img.data[i + 1] = Math.round(rose * 30 + teal * 40);
      img.data[i + 2] = Math.round(violet * 180 + teal * 120);
      img.data[i + 3] = Math.round(50 + n * 70);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
};
```

**Step 2: Add nebula as a Pixi sprite behind the star layer**

In `StarfieldCanvas.tsx`:

```tsx
import { buildNebulaBitmap } from '../services/nebulaTexture';

const nebulaTex = Texture.from(buildNebulaBitmap(2048, 1024));
const nebula = new Sprite(nebulaTex);
nebula.anchor.set(0.5);
nebula.alpha = 0.5;
app.stage.addChildAt(nebula, 0);
nebula.x = app.screen.width / 2;
nebula.y = app.screen.height / 2;

// Slow UV scroll via sprite position modulation.
app.ticker.add((t) => {
  nebula.x = app.screen.width / 2 + Math.sin(t.lastTime * 0.00003) * 20;
  nebula.y = app.screen.height / 2 + Math.cos(t.lastTime * 0.00004) * 14;
});
```

**Step 3: Remove the CSS nebula from GraphScene.tsx**

Delete the `radial-gradient` nebula div and the film grain SVG overlay.
Keep the vignette.

**Step 4: Manual verification**

Expected: nebula fills behind the stars, drifts gently.

**Step 5: Commit**

```bash
git add src/services/nebulaTexture.ts src/components/StarfieldCanvas.tsx src/components/GraphScene.tsx
git commit -m "feat: Pixi-native nebula backdrop"
```

---

### Task 4.2: Focused-only photon layer

**Files:**
- Modify: `src/components/StarfieldCanvas.tsx`

**Step 1: Build a tiny photon texture (12×12 Gaussian)**

Reuse `buildHaloBitmap(12)` via `Texture.from(...)`.

**Step 2: Track the "top 3 focused edges" and animate photon sprites**

```tsx
const photonLayer = new ParticleContainer();
world.addChild(photonLayer);

interface Photon { sprite: Sprite; edge: MovieEdge; t: number }
let photons: Photon[] = [];

const updateFocusedPhotons = (focusedId: number | null, edges: MovieEdge[]) => {
  photons.forEach(p => p.sprite.destroy());
  photons = [];
  if (focusedId == null) return;
  const touching = edges
    .filter(e => e.source === focusedId || e.target === focusedId)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3);
  for (const e of touching) {
    const sprite = new Sprite(photonTex);
    sprite.anchor.set(0.5);
    sprite.blendMode = 'add';
    sprite.scale.set(0.25);
    photonLayer.addChild(sprite);
    photons.push({ sprite, edge: e, t: Math.random() });
  }
};

app.ticker.add((ticker) => {
  const dt = ticker.deltaMS;
  for (const p of photons) {
    p.t = (p.t + dt * 0.0005) % 1;
    const s = nodeById.get(p.edge.source as number)!;
    const t = nodeById.get(p.edge.target as number)!;
    p.sprite.x = s.x! + (t.x! - s.x!) * p.t;
    p.sprite.y = s.y! + (t.y! - s.y!) * p.t;
  }
});
```

**Step 3: Subscribe to `selectedMovie` changes**

Call `updateFocusedPhotons(selectedMovie?.id ?? null, edges)` when either
changes.

**Step 4: Manual verification**

Click a movie → 3 photons flow along its strongest connections. Deselect →
photons gone.

**Step 5: Commit**

```bash
git add src/components/StarfieldCanvas.tsx
git commit -m "feat: focused-only photon layer"
```

---

### Task 4.3: Focus animation (dim, bloom edges, camera pan)

**Files:**
- Modify: `src/components/StarfieldCanvas.tsx`

**Step 1: On selection change, tween non-connected star alpha to 0.3**

Use a simple rAF-driven tween (no library needed — avoid dependency bloat):

```tsx
const tween = (from: number, to: number, ms: number, on: (v: number) => void) => {
  const t0 = performance.now();
  const step = () => {
    const p = Math.min(1, (performance.now() - t0) / ms);
    on(from + (to - from) * p);
    if (p < 1) requestAnimationFrame(step);
  };
  step();
};
```

When `selectedMovie` changes, identify connected node IDs (already in
`useGraphFilters.connectedMovieIds`), then tween each star sprite's alpha.

**Step 2: Apply BlurFilter to focused-edge Graphics**

Maintain a second `Graphics` (`focusedEdgeLayer`) that draws only edges
touching the selected movie, with alpha 0.7, width ×2, and `BlurFilter`
radius 2 applied.

```tsx
import { BlurFilter } from 'pixi.js';
focusedEdgeLayer.filters = [new BlurFilter({ strength: 2 })];
```

**Step 3: Camera zoom-pan on selection**

Compute the bounding box of focused node + connected nodes, compute target
transform, tween `world.position` and `world.scale` toward it over 800ms.
Respect `prefers-reduced-motion` — if set, jump instantly.

**Step 4: Manual verification**

Click a movie → non-connected stars fade, connected edges glow, camera
gently pans. Deselect → reverse.

**Step 5: Commit**

```bash
git add src/components/StarfieldCanvas.tsx
git commit -m "feat: focus animation — dim, edge bloom, camera tween"
```

---

### Task 4.4: LOD behavior on zoom

**Files:**
- Modify: `src/components/StarfieldCanvas.tsx`

**Step 1: Subscribe to `zoom` from store**

When `zoom` changes:
- Apply `lodRatingCutoff(zoom)`: stars with rating < cutoff get alpha 0.1.
- Apply `lodStrengthCutoff(zoom)`: edges with strength < cutoff are skipped
  on the next `rebuildEdges` call.
- At `zoom >= 1`, enable a `BlurFilter` on the star ParticleContainer;
  disable below.

**Step 2: Rebuild edges on zoom-cutoff change (debounce 100ms)**

Don't rebuild on every scroll tick; debounce. Track previous cutoff; rebuild
only when it crosses a threshold boundary.

**Step 3: Manual verification**

Zoom all the way out → dim stars fade, only bright ones remain; edge web
thins. Zoom in → everything returns; bloom filter visibly softens halos.

**Step 4: Commit**

```bash
git add src/components/StarfieldCanvas.tsx
git commit -m "feat: LOD — rating/strength cutoffs + bloom filter by zoom"
```

---

### Task 4.5: Entrance animation

**Files:**
- Modify: `src/components/StarfieldCanvas.tsx`

**Step 1: On initial mount, start each star at `alpha = 0` then tween in**

```tsx
for (let i = 0; i < stars.children.length; i++) {
  const sprite = stars.children[i] as Sprite;
  sprite.alpha = 0;
  const delay = Math.random() * 800;
  setTimeout(() => tween(0, 1, 800, v => { sprite.alpha = v; }), delay);
}
```

Skip entirely under `prefers-reduced-motion`.

**Step 2: Manual verification**

Reload → stars fade in over ~1.2s with staggered delay.

**Step 3: Commit**

```bash
git add src/components/StarfieldCanvas.tsx
git commit -m "feat: star entrance animation on initial load"
```

---

### Task 4.6: Twinkle

**Files:**
- Modify: `src/components/StarfieldCanvas.tsx`

**Step 1: Per-star twinkle phase (precomputed once)**

```tsx
const phases = new Float32Array(stars.children.length);
for (let i = 0; i < phases.length; i++) phases[i] = Math.random() * Math.PI * 2;

app.ticker.add((ticker) => {
  const t = ticker.lastTime * 0.001;
  for (let i = 0; i < stars.children.length; i++) {
    const s = stars.children[i] as Sprite;
    s.alpha = 0.95 + Math.sin(t * 0.8 + phases[i]) * 0.05;
  }
});
```

Skip under `prefers-reduced-motion`.

**Step 2: Manual verification**

Stars breathe subtly.

**Step 3: Commit**

```bash
git add src/components/StarfieldCanvas.tsx
git commit -m "feat: gentle per-star twinkle"
```

---

### Task 4.7: Diffraction spike sprites on high-rating + focused stars

**Files:**
- Create: `src/services/diffractionTexture.ts`
- Modify: `src/components/StarfieldCanvas.tsx`

**Step 1: Build 128×128 spike sprite (4-point cross + 45° secondaries)**

Mirror the code already in `MovieGraph.tsx:92-113`, extracted into a function
`buildDiffractionBitmap(size: number)`.

**Step 2: Add a second ParticleContainer with a spike sprite per rating ≥ 7.5 star**

Tinted by genre color, blend mode additive, scaled relative to rating.

**Step 3: Commit**

```bash
git add src/services/diffractionTexture.ts src/components/StarfieldCanvas.tsx
git commit -m "feat: diffraction spikes for high-rating stars"
```

---

### Task 4.8: Mouse parallax on nebula

**Files:**
- Modify: `src/components/StarfieldCanvas.tsx`

**Step 1: Track pointer position, lerp nebula offset toward `(dx*5, dy*5)`**

```tsx
let targetOffsetX = 0, targetOffsetY = 0;
let currentOffsetX = 0, currentOffsetY = 0;

app.canvas.addEventListener('pointermove', (e) => {
  const rect = app.canvas.getBoundingClientRect();
  targetOffsetX = (e.clientX - rect.left - rect.width / 2) / rect.width * 5;
  targetOffsetY = (e.clientY - rect.top - rect.height / 2) / rect.height * 5;
});

app.ticker.add(() => {
  currentOffsetX += (targetOffsetX - currentOffsetX) * 0.05;
  currentOffsetY += (targetOffsetY - currentOffsetY) * 0.05;
  nebula.x = app.screen.width / 2 + currentOffsetX;
  nebula.y = app.screen.height / 2 + currentOffsetY;
});
```

Skip under `prefers-reduced-motion`.

**Step 2: Commit**

```bash
git add src/components/StarfieldCanvas.tsx
git commit -m "feat: subtle mouse parallax on nebula"
```

---

## Stage 5 — Polish + cleanup

### Task 5.1: `useReducedMotion` hook + gate animations

**Files:**
- Create: `src/hooks/useReducedMotion.ts`
- Create: `src/hooks/useReducedMotion.test.ts`
- Modify: `src/components/StarfieldCanvas.tsx`

**Step 1: Write the failing test**

```ts
// src/hooks/useReducedMotion.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReducedMotion } from './useReducedMotion';

describe('useReducedMotion', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((q) => ({
        matches: q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      })),
    });
  });
  it('returns true when prefers-reduced-motion is set', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });
});
```

Add dev dep:
```bash
npm install --save-dev @testing-library/react @testing-library/dom
```

**Step 2: Run test to verify it fails**

Run: `npm test -- useReducedMotion`
Expected: FAIL.

**Step 3: Write implementation**

```ts
// src/hooks/useReducedMotion.ts
import { useEffect, useState } from 'react';
export const useReducedMotion = (): boolean => {
  const [prefers, setPrefers] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefers(mq.matches);
    const onChange = () => setPrefers(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return prefers;
};
```

**Step 4: Gate animations in StarfieldCanvas**

Pass `reducedMotion` flag into animation helpers; skip twinkle, parallax,
entrance, and camera tweens when true.

**Step 5: Commit**

```bash
git add src/hooks/useReducedMotion.ts src/hooks/useReducedMotion.test.ts src/components/StarfieldCanvas.tsx package.json package-lock.json
git commit -m "feat: respect prefers-reduced-motion"
```

---

### Task 5.2: Ticker pause on idle

**Files:**
- Modify: `src/components/StarfieldCanvas.tsx`

**Step 1: Start `app.ticker.autoStart = false` and only run on interaction**

```tsx
let idleTimer: number | null = null;
const wake = () => {
  if (!app.ticker.started) app.ticker.start();
  if (idleTimer != null) clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => app.ticker.stop(), 1000);
};
app.canvas.addEventListener('pointermove', wake);
app.canvas.addEventListener('wheel', wake);
app.canvas.addEventListener('click', wake);
// Also wake when photons are active (focus changes).
```

**Step 2: Manual verification**

After 1s of no interaction, GPU usage in DevTools Performance tab should
drop to near-zero.

**Step 3: Commit**

```bash
git add src/components/StarfieldCanvas.tsx
git commit -m "perf: pause Pixi ticker after 1s idle"
```

---

### Task 5.3: Fold StardustField into Pixi (or remove redundantly)

**Files:**
- Delete: `src/components/StardustField.tsx`
- Modify: `src/components/GraphScene.tsx`
- Modify: `src/components/StarfieldCanvas.tsx`

**Step 1: Remove `<StardustField />` from GraphScene**

**Step 2: Add a Pixi stardust layer**

In StarfieldCanvas, after nebula but before edges:

```tsx
const stardust = new ParticleContainer();
app.stage.addChildAt(stardust, 1);
const dustTex = Texture.from(buildHaloBitmap(32));
for (let i = 0; i < 400; i++) {
  const s = new Sprite(dustTex);
  s.anchor.set(0.5);
  s.blendMode = 'add';
  s.scale.set(0.1 + Math.random() * 0.2);
  s.alpha = 0.3 + Math.random() * 0.5;
  s.x = Math.random() * app.screen.width;
  s.y = Math.random() * app.screen.height;
  stardust.addChild(s);
}
```

**Step 3: Delete `StardustField.tsx`**

**Step 4: Manual verification**

Backdrop still shows distant twinkle/dust.

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: fold StardustField into Pixi scene"
```

---

### Task 5.4: Remove 3D code path

**Files:**
- Modify: `src/hooks/useGraphMode.ts`
- Modify: `package.json`

**Step 1: Simplify `useGraphMode`**

Replace with a thin re-export of `useReducedMotion`, or delete entirely and
update all call sites in `GraphScene.tsx` to use `useReducedMotion`
directly.

**Step 2: Remove three + three-spritetext**

```bash
npm uninstall three three-spritetext
npm uninstall --save-dev @types/three
```

**Step 3: Remove 3D UI hints from GraphScene bottom bar** (the
"projection · volumetric" string and the `is3DMode` variable).

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove 3D code path and three deps"
```

---

### Task 5.5: Mobile DPR cap + perf check on real devices

**Files:**
- Modify: `src/components/StarfieldCanvas.tsx` (already caps at 2, verify)
- Modify: `docs/plans/2026-04-17-webgl-graph-renderer-perf.md`

**Step 1: Confirm `resolution: Math.min(devicePixelRatio, 2)` is in place**

**Step 2: Manual perf testing on target devices**

Record FPS on:
- Desktop Chrome (reference)
- iOS Safari (recent iPhone)
- Android Chrome (mid-range, e.g., Pixel 6a class)

Fill in the perf tracker rows for Stage 5.

**Step 3: If mobile fps < 45:**
- Reduce `HALO_SIZE` from 256 to 128.
- Increase nebula drift period to 60s+.
- Lower photon `t` step.

Re-measure, iterate.

**Step 4: Commit**

```bash
git add docs/plans/2026-04-17-webgl-graph-renderer-perf.md
git commit -m "docs: Stage 5 perf numbers + mobile tuning notes"
```

---

### Task 5.6: Final cleanup

**Files:**
- Audit all of `src/` for unused imports, unused files, dead flags.

**Step 1: Run TypeScript + ESLint**

```bash
npm run build && npm run lint
```

Fix any warnings about unused variables.

**Step 2: Remove commented-out code** (especially the disabled plot-similarity
block in `graphBuilder.ts:169-206` — either keep it intentionally with a
clear flag or delete it).

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: final cleanup after WebGL renderer migration"
```

---

## Post-plan verification checklist

Before marking the plan complete:

- [ ] All unit tests pass: `npm test`.
- [ ] TypeScript build succeeds: `npm run build`.
- [ ] ESLint clean: `npm run lint`.
- [ ] Perf tracker shows: desktop idle 60fps, desktop pan ≥ 60fps, iOS
      Safari pan ≥ 45fps, Android mid-range pan ≥ 30fps.
- [ ] Visual parity: screenshots at four canonical states look equal or
      better than the pre-migration renderer.
- [ ] `react-force-graph-*`, `three`, `three-spritetext` removed from
      `package.json`.
- [ ] `MovieGraph.tsx` and `StardustField.tsx` deleted.
- [ ] `prefers-reduced-motion` disables twinkle, parallax, entrance, camera
      tween.
- [ ] Design doc at
      `docs/plans/2026-04-17-webgl-graph-renderer-design.md` still matches
      the final implementation (update if we deviated).

---

## References

- Design doc: [docs/plans/2026-04-17-webgl-graph-renderer-design.md](2026-04-17-webgl-graph-renderer-design.md)
- Perf tracker (created in Task 1.5): [docs/plans/2026-04-17-webgl-graph-renderer-perf.md](2026-04-17-webgl-graph-renderer-perf.md)
- Existing inverted-index graph builder: `src/services/graphBuilder.ts`
- Zustand store: `src/stores/graphStore.ts`
- Current canvas 2D renderer (to be deleted in Stage 3): `src/components/MovieGraph.tsx`
