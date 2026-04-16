/**
 * Deterministic layout via seeded Mulberry32 + d3-force.
 *
 * The output is bit-stable for a given seed + input (including array order)
 * on a given JS engine. Across V8 versions or engines (Node vs. Safari),
 * low-order float bits may differ — acceptable for our use case (positions
 * are produced once by the build script, serialized to JSON, and pinned at
 * runtime).
 */

import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force';
import type { Movie, MovieEdge } from '../types';

// Tuning constants — the visible clustering shape is sensitive to these.
// Picked for the 2000-movie dataset; revisit before any large dataset-size
// change rather than re-tuning at runtime.
const INITIAL_SCALE = 800;      // starting random positions are uniform in [-INITIAL_SCALE/2, INITIAL_SCALE/2]²
const LINK_DISTANCE = 40;       // target edge length in layout units
const LINK_STRENGTH = 0.4;      // base link spring strength (per-edge strength multiplies this)
const CHARGE_STRENGTH = -60;    // node-node repulsion (many-body force)

export interface LayoutOptions {
  seed: number;
  iterations: number;
}

export type LayoutPositions = ReadonlyMap<number, { x: number; y: number }>;

interface LayoutNode {
  id: number;
  x: number;
  y: number;
}

interface LayoutLink {
  source: number;
  target: number;
  strength: number;
}

// Mulberry32 — tiny, seedable PRNG suitable for non-cryptographic seeding.
// Reference: https://gist.github.com/tommyettinger/46a3b66afd7a99fe8b8f4b3fe2e3e2e8
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
  const nodes: LayoutNode[] = movies.map(m => ({
    id: m.id,
    x: (rng() - 0.5) * INITIAL_SCALE,
    y: (rng() - 0.5) * INITIAL_SCALE,
  }));
  const links: LayoutLink[] = edges.map(e => ({
    source: e.source,
    target: e.target,
    strength: e.strength,
  }));

  const sim = forceSimulation<LayoutNode>(nodes)
    .force('link', forceLink<LayoutNode, LayoutLink>(links)
      .id(d => d.id)
      .distance(LINK_DISTANCE)
      .strength(l => LINK_STRENGTH * (l.strength ?? 1)))
    .force('charge', forceManyBody<LayoutNode>().strength(CHARGE_STRENGTH))
    .force('center', forceCenter<LayoutNode>(0, 0))
    .stop();

  for (let i = 0; i < iterations; i++) sim.tick();

  const positions = new Map<number, { x: number; y: number }>();
  for (const n of nodes) positions.set(n.id, { x: n.x, y: n.y });
  return positions;
};
