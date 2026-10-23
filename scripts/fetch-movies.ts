/**
 * Fetch TMDB's top-rated movies into data/movies.json (network, needs a key).
 *
 *   npm run data:fetch                  # 2000 movies
 *   npm run data:fetch -- --limit 500
 *
 * Then run `npm run data:build` to rebuild the graph and layout. The
 * credential is read from TMDB_API_KEY (a v3 key or a v4 read access token)
 * and only ever used here, in Node.
 */

import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTmdbClient, formatRawMovies, mapPool, normalizeMovie, type TmdbMovieDetails } from './tmdb.ts';
import type { Movie } from '../src/core/types.ts';

const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data/movies.json');
const CONCURRENCY = 8;
const PAGE_SIZE = 20;

const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : 2000;
if (!Number.isInteger(limit) || limit < 1) throw new Error('--limit must be a positive integer');

let credential = process.env.TMDB_API_KEY;
if (!credential && process.env.VITE_TMDB_API_KEY) {
  console.warn('Using VITE_TMDB_API_KEY — rename it to TMDB_API_KEY so no tooling treats it as client-safe.');
  credential = process.env.VITE_TMDB_API_KEY;
}
if (!credential) {
  console.error('TMDB_API_KEY is not set. Add it to .env (see .env.example).');
  process.exit(1);
}

const tmdb = createTmdbClient({ credential });
const isTTY = process.stdout.isTTY;
const status = (msg: string) => (isTTY ? process.stdout.write(`\r\x1b[2K${msg}`) : console.log(msg));

// Rankings shift while paging, so one movie can appear on two pages. Keep
// paging until we have `limit` unique ids.
const ids: number[] = [];
const seen = new Set<number>();
for (let page = 1; ids.length < limit && page <= 500; page++) {
  const res = await tmdb.get<{ results: { id: number }[]; total_pages: number }>('/movie/top_rated', {
    page: String(page),
  });
  for (const { id } of res.results) {
    if (!seen.has(id) && ids.length < limit) {
      seen.add(id);
      ids.push(id);
    }
  }
  status(`  list: page ${page} · ${ids.length}/${limit} unique`);
  if (page >= res.total_pages) break;
}
console.log(`\n  list: ${ids.length} movies (~${Math.ceil(ids.length / PAGE_SIZE)} pages)`);

const started = Date.now();
let done = 0;
let failed = 0;
const details = await mapPool(ids, CONCURRENCY, async id => {
  try {
    return normalizeMovie(
      await tmdb.get<TmdbMovieDetails>(`/movie/${id}`, { append_to_response: 'credits,keywords' }),
    );
  } catch (err) {
    failed++;
    console.error(`\n  movie ${id}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  } finally {
    done++;
    if (done % 25 === 0 || done === ids.length) {
      const rate = done / ((Date.now() - started) / 1000);
      status(`  details: ${done}/${ids.length} · ${rate.toFixed(1)}/s · ${failed} failed`);
    }
  }
});

const movies = details.filter((m): m is Movie => m != null);
if (movies.length === 0) {
  console.error('\nNo movies fetched; leaving data/movies.json untouched.');
  process.exit(1);
}

await writeFile(
  OUTPUT,
  formatRawMovies({
    source: 'TMDB /3/movie/top_rated + /3/movie/{id}?append_to_response=credits,keywords',
    fetchedAt: new Date().toISOString(),
    movies,
  }),
  'utf8',
);
console.log(`\nWrote ${movies.length} movies to ${OUTPUT}. Next: npm run data:build`);
