/**
 * TMDB client helpers for scripts/fetch-movies.ts. Node-only: the browser
 * never talks to TMDB, so the API credential never reaches a client bundle.
 */

import type { Movie } from '../src/core/types.ts';

export interface RawMoviesFile {
  source: string;
  fetchedAt: string;
  movies: Movie[];
}

export interface TmdbMovieDetails {
  id: number;
  title: string;
  release_date?: string;
  poster_path: string | null;
  vote_average: number;
  overview?: string;
  genres: { id: number; name: string }[];
  credits?: {
    cast: { name: string; order: number }[];
    crew: { name: string; job: string }[];
  };
  keywords?: { keywords: { name: string }[] };
}

export const CAST_LIMIT = 10;
export const KEYWORD_LIMIT = 20;

export const normalizeMovie = (d: TmdbMovieDetails): Movie => ({
  id: d.id,
  title: d.title,
  year: Number.parseInt(d.release_date?.slice(0, 4) ?? '', 10) || 0,
  posterPath: d.poster_path ?? '',
  rating: Math.round(d.vote_average * 100) / 100,
  genres: d.genres.map(g => g.name),
  directors: [...new Set((d.credits?.crew ?? []).filter(p => p.job === 'Director').map(p => p.name))],
  cast: [...(d.credits?.cast ?? [])]
    .sort((a, b) => a.order - b.order)
    .slice(0, CAST_LIMIT)
    .map(a => a.name),
  keywords: (d.keywords?.keywords ?? []).slice(0, KEYWORD_LIMIT).map(k => k.name),
  overview: d.overview ?? '',
});

/** One movie per line: compact, yet diffs stay readable after a refetch. */
export const formatRawMovies = (file: RawMoviesFile): string =>
  '{\n' +
  `  "source": ${JSON.stringify(file.source)},\n` +
  `  "fetchedAt": ${JSON.stringify(file.fetchedAt)},\n` +
  '  "movies": [\n' +
  file.movies.map(m => `    ${JSON.stringify(m)}`).join(',\n') +
  '\n  ]\n}\n';

export interface TmdbClientOptions {
  /** v3 API key, or a v4 "API Read Access Token" (sent as a Bearer header). */
  credential: string;
  retries?: number;
  timeoutMs?: number;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const createTmdbClient = ({ credential, retries = 4, timeoutMs = 15_000 }: TmdbClientOptions) => {
  const isBearer = credential.startsWith('eyJ'); // v4 tokens are JWTs

  const get = async <T>(path: string, params: Record<string, string> = {}): Promise<T> => {
    const url = new URL(`https://api.themoviedb.org/3${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    if (!isBearer) url.searchParams.set('api_key', credential);
    const headers: Record<string, string> = { accept: 'application/json' };
    if (isBearer) headers.authorization = `Bearer ${credential}`;

    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
        if (res.ok) return (await res.json()) as T;
        if (res.status === 401) throw new Error('TMDB rejected the credential (401). Check TMDB_API_KEY.');
        const retryable = res.status === 429 || res.status >= 500;
        if (!retryable || attempt >= retries) throw new Error(`TMDB ${res.status} ${res.statusText} for ${path}`);
        const retryAfter = Number(res.headers.get('retry-after'));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('(401)') || message.startsWith('TMDB 4') || attempt >= retries) throw err;
        await sleep(500 * 2 ** attempt);
      }
    }
  };

  return { get };
};

/** Run `task` over `items` with at most `limit` in flight; preserves order. */
export const mapPool = async <T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await task(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};
