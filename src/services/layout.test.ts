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
