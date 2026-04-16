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
