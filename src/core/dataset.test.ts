import { describe, expect, it } from 'vitest';
import { DATASET_VERSION, DatasetError, decodeDataset, encodeDataset, otherEnd, posterUrl } from './dataset.ts';
import type { Movie } from './types.ts';

const movie = (id: number, over: Partial<Movie> = {}): Movie => ({
  id,
  title: `Movie ${id}`,
  year: 1990 + id,
  posterPath: `/p${id}.jpg`,
  rating: 7 + id / 10,
  genres: ['Drama'],
  directors: ['Dir'],
  cast: ['Lead', `Actor ${id}`],
  keywords: ['keyword'],
  overview: `Overview ${id}`,
  ...over,
});

const sample = () =>
  encodeDataset({
    movies: [movie(1), movie(2, { genres: ['Animation', 'Family'] }), movie(3)],
    positions: [0, 0, 10.5, -3, 4, 4],
    edges: [
      { source: 0, target: 1, mask: 3, weight: 0.5 },
      { source: 1, target: 2, mask: 8, weight: 0.1234 },
    ],
    fetchedAt: '2026-01-01T00:00:00.000Z',
    source: 'test',
  });

describe('encode/decode', () => {
  it('round-trips movies, positions, and edges', () => {
    const ds = decodeDataset(JSON.parse(JSON.stringify(sample())));
    expect(ds.nodes.map(n => n.title)).toEqual(['Movie 1', 'Movie 2', 'Movie 3']);
    expect(ds.nodes[1]).toMatchObject({ x: 10.5, y: -3, family: 'animation', genres: ['Animation', 'Family'] });
    expect(ds.nodes[0].cast).toEqual(['Lead', 'Actor 1']);
    expect(ds.edges[1]).toEqual({ source: 1, target: 2, mask: 8, weight: 0.123 });
    expect(ds.adjacency[1]).toEqual([0, 1]);
    expect(ds.nodes[1].degree).toBe(2);
    expect(ds.indexById.get(3)).toBe(2);
    expect(otherEnd(ds.edges[0], 0)).toBe(1);
  });

  it('interns repeated strings once', () => {
    const file = sample();
    expect(file.strings.filter(s => s === 'Lead')).toHaveLength(1);
  });

  it('rejects other versions with a regenerate hint', () => {
    const file = { ...sample(), version: DATASET_VERSION - 1 };
    expect(() => decodeDataset(file)).toThrow(DatasetError);
    expect(() => decodeDataset(file)).toThrow(/data:build/);
  });

  it('rejects empty catalogs, bad dates, and non-finite numbers', () => {
    expect(() => decodeDataset({ ...sample(), movies: [], edges: [] })).toThrow(/no movies/);
    expect(() => decodeDataset({ ...sample(), fetchedAt: 'yesterday' })).toThrow(/fetchedAt/);
    const badRating = sample();
    badRating.movies[1][4] = Number.NaN;
    expect(() => decodeDataset(badRating)).toThrow(/rating or year/);
  });

  it('rejects edges with an unknown mask or out-of-range weight', () => {
    const badMask = sample();
    badMask.edges[2] = 0;
    expect(() => decodeDataset(badMask)).toThrow(/mask or weight/);
    const badWeight = sample();
    badWeight.edges[3] = 1500;
    expect(() => decodeDataset(badWeight)).toThrow(/mask or weight/);
  });

  it('rejects movies without positions and edges with bad endpoints', () => {
    const noPos = sample();
    noPos.movies[0][10] = null as unknown as number;
    expect(() => decodeDataset(noPos)).toThrow(/position/);

    const badEdge = sample();
    badEdge.edges.push(0, 99, 1, 500);
    expect(() => decodeDataset(badEdge)).toThrow(/endpoints/);
  });
});

describe('posterUrl', () => {
  it('builds sized TMDB URLs and tolerates missing posters', () => {
    expect(posterUrl('/abc.jpg', 'w92')).toBe('https://image.tmdb.org/t/p/w92/abc.jpg');
    expect(posterUrl('', 'w342')).toBe('');
  });
});
