import { describe, expect, it } from 'vitest';
import { buildGraph, DEFAULT_GRAPH_PARAMS, sharedAttributes } from './graph.ts';
import { CONNECTION_BIT } from './connections.ts';
import type { Movie } from './types.ts';

let nextId = 1;
const movie = (over: Partial<Movie> = {}): Movie => ({
  id: nextId++,
  title: `M${nextId}`,
  year: 2000,
  posterPath: '',
  rating: 8,
  genres: ['Drama'],
  directors: [],
  cast: [],
  keywords: [],
  overview: '',
  ...over,
});

const pairOf = (edges: ReturnType<typeof buildGraph>, a: number, b: number) =>
  edges.find(e => e.source === Math.min(a, b) && e.target === Math.max(a, b));

describe('buildGraph', () => {
  it('connects films by the same director and tags the edge', () => {
    const movies = [
      movie({ directors: ['Akira Kurosawa'], genres: ['Action', 'Drama'] }),
      movie({ directors: ['Akira Kurosawa'], genres: ['Drama'] }),
      movie({ directors: ['Someone Else'], genres: ['Comedy'] }),
    ];
    const edge = pairOf(buildGraph(movies), 0, 1);
    expect(edge).toBeDefined();
    expect(edge!.mask & CONNECTION_BIT.director).toBeTruthy();
  });

  it('weights shared lead actors and shared story keywords', () => {
    const movies = [
      movie({ cast: ['A', 'B'], keywords: ['samurai', 'feudal japan'] }),
      movie({ cast: ['A', 'C'], keywords: ['samurai', 'feudal japan'] }),
      movie({ cast: ['D'], keywords: ['samurai'] }),
      movie({ cast: ['E'], keywords: ['feudal japan'] }),
    ];
    const edges = buildGraph(movies, { ...DEFAULT_GRAPH_PARAMS, keywordMaxDf: 1 });
    const strong = pairOf(edges, 0, 1)!;
    expect(strong.mask & CONNECTION_BIT.cast).toBeTruthy();
    expect(strong.mask & CONNECTION_BIT.theme).toBeTruthy();
    const weaker = pairOf(edges, 0, 2);
    expect(!weaker || weaker.weight < strong.weight).toBe(true);
  });

  it('ignores mood and production keywords', () => {
    const movies = [
      movie({ genres: ['Comedy'], keywords: ['duringcreditsstinger', 'excited'] }),
      movie({ genres: ['Horror'], keywords: ['duringcreditsstinger', 'excited'] }),
    ];
    const edges = buildGraph(movies, { ...DEFAULT_GRAPH_PARAMS, keywordMaxDf: 1 });
    expect(edges.some(e => e.mask & CONNECTION_BIT.theme)).toBe(false);
  });

  it('never leaves a movie isolated when it shares a genre with anyone', () => {
    const movies = [
      movie({ directors: ['X'], genres: ['Drama'] }),
      movie({ directors: ['X'], genres: ['Drama'] }),
      movie({ genres: ['Drama', 'Romance'] }), // nothing but genre in common
    ];
    const edges = buildGraph(movies);
    const lonely = edges.filter(e => e.source === 2 || e.target === 2);
    expect(lonely.length).toBeGreaterThan(0);
    expect(lonely.every(e => e.mask === CONNECTION_BIT.genre)).toBe(true);
  });

  it('emits sorted, unique, loop-free edges with weights in (0, 1]', () => {
    const movies = Array.from({ length: 30 }, (_, i) =>
      movie({ directors: [`D${i % 4}`], cast: [`A${i % 7}`, `B${i % 5}`], keywords: [`k${i % 6}`, `j${i % 3}`] }),
    );
    const edges = buildGraph(movies, { ...DEFAULT_GRAPH_PARAMS, keywordMaxDf: 1 });
    const keys = edges.map(e => `${e.source}-${e.target}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const e of edges) {
      expect(e.source).toBeLessThan(e.target);
      expect(e.weight).toBeGreaterThan(0);
      expect(e.weight).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic', () => {
    const movies = Array.from({ length: 25 }, (_, i) =>
      movie({ directors: [`D${i % 3}`], cast: [`A${i % 4}`], keywords: [`k${i % 5}`] }),
    );
    expect(buildGraph(movies)).toEqual(buildGraph(movies));
  });
});

describe('sharedAttributes', () => {
  it('lists what two movies have in common, minus stop keywords', () => {
    const a = movie({ directors: ['X'], cast: ['A', 'B'], keywords: ['Samurai', 'excited'], genres: ['Drama', 'Action'] });
    const b = movie({ directors: ['X'], cast: ['B'], keywords: ['samurai', 'excited'], genres: ['Action'] });
    expect(sharedAttributes(a, b)).toEqual({
      directors: ['X'],
      cast: ['B'],
      keywords: ['Samurai'],
      genres: ['Action'],
    });
  });
});
