/**
 * Deterministic force layout (seeded Mulberry32 + d3-force), computed once by
 * scripts/build-dataset.ts and baked into the dataset. The browser never runs
 * physics.
 *
 * Each genre family gets an anchor on a ring, its sector sized by member
 * count; a weak pull toward the anchor turns the graph into readable
 * "continents" while links still decide who sits next to whom.
 */

import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import type { Edge, GenreFamilyId } from './types.ts';
import { GENRE_FAMILIES } from './genres.ts';

export interface LayoutNode {
  family: GenreFamilyId;
  radius: number;
}

export interface LayoutParams {
  seed: number;
  iterations: number;
  /** Link rest length for the weakest edge; strong edges sit closer. */
  linkDistance: number;
  /** Many-body repulsion magnitude. */
  charge: number;
  /** Repulsion cutoff in world units. Short-range repulsion lets links, not
   *  global pressure, decide spacing, so clusters stay tight. */
  chargeRange: number;
  /** Gap kept between star edges. */
  collidePadding: number;
  /** forceX/forceY strength toward the family anchor. */
  familyPull: number;
  /** Spring stiffness of the weakest link (the strongest gets 1). */
  linkStrength: number;
  /** Rest length of a weight-1 link relative to linkDistance: franchises and
   *  auteur filmographies sit much tighter than incidental links. */
  strongLinkRatio: number;
  /** Links weaker than this are drawn but do not pull on the layout, so
   *  incidental cross-genre links cannot glue every cluster into one disc. */
  layoutMinWeight: number;
  /** Share of iterations run before collision turns on. Letting stars pass
   *  through each other early lets clusters form instead of jamming. */
  collideAfter: number;
  /** Anchor ring radius, as a multiple of sqrt(node count). */
  ringScale: number;
  /** Initial scatter around each anchor, as a fraction of the ring radius. */
  initialSpread: number;
}

// Tuned on the ~2000-movie catalog with `npm run data:build -- --preview`:
// strong links (weight ≥ 0.5) end up a median of 2 stars apart, while the
// continents stay readable (≈60% of a star's 8 nearest share its family).
export const DEFAULT_LAYOUT_PARAMS: LayoutParams = {
  seed: 1,
  iterations: 600,
  linkDistance: 30,
  charge: 20,
  chargeRange: 180,
  collidePadding: 3,
  familyPull: 0.02,
  linkStrength: 0.25,
  strongLinkRatio: 0.25,
  layoutMinWeight: 0.3,
  collideAfter: 0.6,
  ringScale: 8,
  initialSpread: 0.1,
};

/** Star radius in world units. Ratings in a top-rated catalog span a narrow
 *  band (≈7.3–8.7), so normalize to the dataset's own range. */
export const nodeRadius = (rating: number, minRating: number, maxRating: number): number => {
  const span = maxRating - minRating;
  const t = span > 0 ? Math.min(1, Math.max(0, (rating - minRating) / span)) : 0.5;
  return 2.4 + 5.6 * Math.pow(t, 1.6);
};

// Mulberry32 — tiny seedable PRNG. Same seed + input ⇒ same layout.
export const mulberry32 = (seed: number): (() => number) => {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

export const familyAnchors = (
  nodes: readonly LayoutNode[],
  ringRadius: number,
): Map<GenreFamilyId, { x: number; y: number }> => {
  const counts = new Map<GenreFamilyId, number>();
  for (const n of nodes) counts.set(n.family, (counts.get(n.family) ?? 0) + 1);

  const anchors = new Map<GenreFamilyId, { x: number; y: number }>();
  const total = nodes.length || 1;
  let cursor = -Math.PI / 2;
  for (const { id } of GENRE_FAMILIES) {
    const share = (counts.get(id) ?? 0) / total;
    if (share === 0) continue;
    const mid = cursor + share * Math.PI;
    cursor += share * 2 * Math.PI;
    // Small families sit nearer the core so they do not float off as islands.
    const r = ringRadius * (0.55 + 0.45 * Math.min(1, share * 6));
    anchors.set(id, { x: Math.cos(mid) * r, y: Math.sin(mid) * r });
  }
  return anchors;
};

interface SimNode extends SimulationNodeDatum {
  ax: number;
  ay: number;
  r: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  weight: number;
}

/** Returns interleaved [x0, y0, x1, y1, …], rounded to 0.1 world units. */
export const computeLayout = (
  nodes: readonly LayoutNode[],
  edges: readonly Edge[],
  params: LayoutParams = DEFAULT_LAYOUT_PARAMS,
): Float64Array => {
  const rng = mulberry32(params.seed);
  const ring = params.ringScale * Math.sqrt(nodes.length);
  const anchors = familyAnchors(nodes, ring);

  const simNodes: SimNode[] = nodes.map(n => {
    const a = anchors.get(n.family) ?? { x: 0, y: 0 };
    const angle = rng() * 2 * Math.PI;
    const dist = Math.sqrt(rng()) * ring * params.initialSpread;
    return { ax: a.x, ay: a.y, r: n.radius, x: a.x + Math.cos(angle) * dist, y: a.y + Math.sin(angle) * dist };
  });

  const links: SimLink[] = edges
    .filter(e => e.weight >= params.layoutMinWeight)
    .map(e => ({ source: e.source, target: e.target, weight: e.weight }));
  const collide = forceCollide<SimNode>(n => n.r + params.collidePadding).strength(0.85).iterations(2);

  const sim = forceSimulation<SimNode>(simNodes)
    .randomSource(rng)
    .alphaDecay(1 - Math.pow(0.001, 1 / params.iterations))
    .force(
      'link',
      forceLink<SimNode, SimLink>(links)
        .distance(l => params.linkDistance * (params.strongLinkRatio + (1 - params.strongLinkRatio) * (1 - l.weight)))
        .strength(l => params.linkStrength + (1 - params.linkStrength) * l.weight),
    )
    .force('charge', forceManyBody<SimNode>().strength(-params.charge).distanceMax(params.chargeRange).theta(0.9))
    .force('x', forceX<SimNode>(n => n.ax).strength(params.familyPull))
    .force('y', forceY<SimNode>(n => n.ay).strength(params.familyPull))
    .stop();

  const collideFrom = Math.floor(params.iterations * params.collideAfter);
  for (let i = 0; i < params.iterations; i++) {
    if (i === collideFrom) sim.force('collide', collide);
    sim.tick();
  }

  const out = new Float64Array(nodes.length * 2);
  simNodes.forEach((n, i) => {
    out[i * 2] = Math.round(n.x! * 10) / 10;
    out[i * 2 + 1] = Math.round(n.y! * 10) / 10;
  });
  return out;
};
