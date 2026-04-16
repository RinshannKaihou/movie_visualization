# Perf tracker — WebGL Graph Renderer Migration

Companion to [2026-04-17-webgl-graph-renderer.md](2026-04-17-webgl-graph-renderer.md)
and [the design doc](2026-04-17-webgl-graph-renderer-design.md).

Each stage is measured via Chrome DevTools → Performance. Protocol per
scenario:

1. Reload the page (for "Initial load" rows) OR start from a settled view.
2. Click **Record**.
3. Perform the action described in the scenario column.
4. Stop recording.
5. Record:
   - **FPS** — from the frame rate strip. Use average over the action, not peak.
   - **Main-thread busy** — total scripting + rendering time during the action,
     in milliseconds (the coloured bar width under "Main").
   - **Notes** — any long tasks, layout thrashing, GC pauses, or surprises.

Dataset in all measurements: 2000 movies from the cached static JSON unless
a row explicitly says "API fetch."

---

## Stage 1 — Layout worker + pinned positions

Reached at commit `7e10898`. Key changes:
- d3-force runs in `src/workers/layoutWorker.ts` off the main thread.
- Positions are baked into graph data and persisted in IndexedDB.
- Runtime simulation is fully frozen (`warmupTicks=0, cooldownTicks=0,
  d3AlphaDecay=1, d3VelocityDecay=1`).

Expected effect: the main thread no longer executes a force tick loop on
load or after filter toggles. Initial-load stutter and movie-select lag
should both drop sharply.

| Scenario | FPS | Main-thread busy (ms) | Notes |
|---|---:|---:|---|
| Initial load (static JSON) | _TBD_ | _TBD_ | First paint; measure from reload to steady canvas |
| Pan / zoom (drag 3s, scroll zoom ×3) | _TBD_ | _TBD_ | Canvas 2D render path still in use |
| Movie select (click one star) | _TBD_ | _TBD_ | Focus + details panel + connected-edge highlight |
| Filter toggle (flip each chip) | _TBD_ | _TBD_ | Edge-set recomputation |
| Resurvey (worker layout from fetch) | _TBD_ | _TBD_ | Main thread should remain interactive throughout |

---

## Stage 2 — StarfieldCanvas behind flag

_Not measured yet. Reserve this section for post-stage-2 numbers._

## Stage 3 — Cut over to Pixi

_Not measured yet._

## Stage 4 — Aesthetics (Pixi nebula, photons, focus animation, LOD)

_Not measured yet._

## Stage 5 — Polish + cleanup

_Not measured yet. Include final device-matrix row here:_

| Device | Scenario | FPS target | Measured |
|---|---|---:|---:|
| Desktop Chrome | Idle | 60 | _TBD_ |
| Desktop Chrome | Pan / zoom | 60 | _TBD_ |
| iOS Safari (recent iPhone) | Pan / zoom | 45+ | _TBD_ |
| Android Chrome (mid-range) | Pan / zoom | 30+ | _TBD_ |

---

## Notes on methodology

- Use an incognito window with extensions disabled so the baseline isn't
  polluted by ad blockers, translation extensions, etc.
- Pin the Chrome Performance tab to 6× CPU slowdown when measuring
  "Android mid-range" equivalents if you don't have the physical device.
- For mobile numbers, use real devices when possible; the Chrome emulator
  isn't GPU-accurate.
- Take FPS **after** simulation settle for any pre-Stage-1 measurements —
  the pre-freeze code's first 800ms are dominated by the tick loop and
  would make Stage 1's improvement look artificially large otherwise.
