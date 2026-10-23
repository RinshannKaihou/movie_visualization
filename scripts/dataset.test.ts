import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodeDataset } from '../src/core/dataset.ts';
import { KNOWN_GENRES } from '../src/core/genres.ts';
import type { RawMoviesFile } from './tmdb.ts';

// Guards the shipped data: a stale, unbaked dataset once reached production
// unnoticed because the app silently recomputed the layout on every visit.
// If this fails, run `npm run data:build`.
describe('committed dataset', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const raw = JSON.parse(readFileSync(resolve(root, 'data/movies.json'), 'utf8')) as RawMoviesFile;
  const ds = decodeDataset(JSON.parse(readFileSync(resolve(root, 'src/generated/dataset.json'), 'utf8')));

  it('is built from the current data/movies.json', () => {
    expect(ds.nodes.map(n => n.id)).toEqual(raw.movies.map(m => m.id));
  });

  it('has unique ids, baked positions, and at least one edge per movie', () => {
    expect(new Set(ds.nodes.map(n => n.id)).size).toBe(ds.nodes.length);
    expect(ds.nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    expect(ds.nodes.every(n => n.degree > 0)).toBe(true);
  });

  it('only uses genres the palette knows', () => {
    const genres = new Set(ds.nodes.flatMap(n => n.genres));
    for (const g of genres) expect(KNOWN_GENRES).toContain(g);
  });
});
