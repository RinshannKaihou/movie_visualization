# Stage 2 Visual Parity Check

Stage 2 built `<StarfieldCanvas>` alongside the legacy `<MovieGraph>`,
gated by `VITE_USE_PIXI`. Before cutting over to Pixi in Stage 3, verify
both renderers show the same data correctly. Aesthetic differences are
**expected and welcome** — Pixi's additive-blended Gaussian halos will
look smoother and more luminous than canvas 2D's banded gradient. Parity
here is about *information*, not pixels.

## Running both renderers

Stage 1 static-data layout needs to run once before either renderer
shows useful results. Run the legacy path first to populate the cache
with baked positions:

```bash
cd /Users/ywang2397/vibe_coding/movie_visualization/.worktrees/webgl-renderer
VITE_USE_PIXI=false npm run dev
# Let the graph settle (loads static JSON, runs layout worker once).
# Close the tab when the starfield is visible and stable.

VITE_USE_PIXI=true  npm run dev
# Graph should render via Pixi with the same positions.
```

Alternatively run two dev servers on different ports
(`VITE_USE_PIXI=true vite --port 5174`) and keep both tabs open for
side-by-side inspection.

## Canonical scenarios to check

### 1. Unfocused view (initial load, no selection, all filters active)

| Expectation | MovieGraph (legacy) | StarfieldCanvas (Pixi) |
|---|---|---|
| 2000 stars distributed across the viewport | ✓ | ✓ |
| Halos tinted by genre (warm yellows, cool blues, ruby reds) | ✓ | ✓ |
| Edges visible between connected movies | ✓ | ✓ |
| No nodes piled at origin | ✓ | ✓ |
| Scene feels like a galaxy, not a random scatter | ✓ | ✓ |

### 2. Selecting a movie

1. Click a prominent star (e.g. *Inception*, *The Godfather*, or use
   the search bar to jump to one).
2. Verify:
   - Details panel opens with the selected movie's info.
   - In the legacy renderer, connected stars get brighter and edges
     highlight.
   - **In Pixi (Stage 2)** the selection event reaches the store but
     there is no highlight yet — Stage 4 adds focus animation.
   - The details panel's "Connected by: actor · director · genre"
     content matches between renderers.

### 3. Filter toggle

1. Start with all four filter chips active.
2. Click the "Actor" chip to disable it.
3. Verify:
   - Both renderers remove edges whose *only* connection type was "same
     actor."
   - Edges with actor + genre overlap remain.
   - Filter counts match.

### 4. Extreme zoom out

1. Scroll wheel far enough that the whole graph is small in the center.
2. Verify:
   - Stars remain visible and sized plausibly.
   - Edges draw correctly (no visual tearing, no missing lines).
   - **Pixi** may look crisper at this zoom due to GPU line tessellation;
     that's expected.

### 5. Pan and zoom gestures

- **Drag** to pan. Both renderers pan smoothly.
- **Wheel** to zoom. Both scale around the cursor (d3-zoom default).
- **Pinch** (touchpad) to zoom. Both respond to two-finger gesture.
- Pixi uses d3-zoom; the legacy uses react-force-graph's built-in. The
  gesture feel should be comparable — same zoom range (0.15× to 6×).

### 6. Hover

1. Hover over a star in each renderer.
2. Verify:
   - The `<NodeTooltip>` appears with poster, year, rating, genres,
     director.
   - Tooltip follows the cursor.
   - Moving the cursor to empty space dismisses the tooltip.

## Known aesthetic differences (intentional, not bugs)

- **Halo smoothness.** Pixi's Gaussian has no banded shoulders. The
  legacy's 6-stop radial has visible rings at intersection of dense
  clusters.
- **Edge blending.** Pixi uses additive GPU blend; legacy uses per-edge
  rgba strings composited on CPU. Pixi edges will look slightly more
  luminous in dark regions.
- **Selection feedback.** Legacy renders highlight rings and photons on
  strong connections. Pixi (Stage 2) does not yet — this lands in
  Stage 4 task 4.3 ("Focus animation").
- **Background.** Both use the same GraphScene-level vignette + nebula
  CSS. Stage 4 task 4.1 replaces the CSS nebula with a Pixi-native
  animated texture.
- **Diffraction spikes.** Legacy bakes 4-point + diagonal spikes into
  every star sprite. Pixi (Stage 2) has none; Stage 4 task 4.7 adds
  them for high-rating + focused stars only.

## Decision gate for Stage 3

Proceed to Stage 3 (cut over, delete `MovieGraph.tsx`, remove
`react-force-graph`) only if:

- [ ] Scenarios 1–6 above pass in Pixi at least as well as in legacy.
- [ ] No console errors from StarfieldCanvas.
- [ ] Initial load + pan/zoom feels no worse than legacy.
- [ ] Hover tooltip works without flicker.

If any of those fail, file the deviation in this doc before Stage 3.

## Deviations found (fill in during testing)

_Empty — record any observed regressions here._
