import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTmdbClient, formatRawMovies, mapPool, normalizeMovie, type TmdbMovieDetails } from './tmdb.ts';

const details = (over: Partial<TmdbMovieDetails> = {}): TmdbMovieDetails => ({
  id: 1,
  title: 'Seven Samurai',
  release_date: '1954-04-26',
  poster_path: '/abc.jpg',
  vote_average: 8.456,
  overview: 'Farmers hire samurai.',
  genres: [{ id: 28, name: 'Action' }, { id: 18, name: 'Drama' }],
  credits: {
    cast: Array.from({ length: 14 }, (_, i) => ({ name: `Actor ${i}`, order: 13 - i })),
    crew: [
      { name: 'Akira Kurosawa', job: 'Director' },
      { name: 'Akira Kurosawa', job: 'Director' },
      { name: 'Someone', job: 'Producer' },
    ],
  },
  keywords: { keywords: Array.from({ length: 25 }, (_, i) => ({ name: `k${i}` })) },
  ...over,
});

describe('normalizeMovie', () => {
  it('maps TMDB details to the Movie shape', () => {
    const m = normalizeMovie(details());
    expect(m).toMatchObject({
      id: 1,
      title: 'Seven Samurai',
      year: 1954,
      posterPath: '/abc.jpg',
      rating: 8.46,
      genres: ['Action', 'Drama'],
      directors: ['Akira Kurosawa'],
      overview: 'Farmers hire samurai.',
    });
  });

  it('keeps the top-billed cast in billing order and caps lists', () => {
    const m = normalizeMovie(details());
    expect(m.cast).toHaveLength(10);
    expect(m.cast[0]).toBe('Actor 13'); // order 0
    expect(m.keywords).toHaveLength(20);
  });

  it('tolerates missing dates, posters, credits, and keywords', () => {
    const m = normalizeMovie(details({ release_date: '', poster_path: null, credits: undefined, keywords: undefined }));
    expect(m).toMatchObject({ year: 0, posterPath: '', directors: [], cast: [], keywords: [] });
  });
});

describe('formatRawMovies', () => {
  it('writes valid JSON with one movie per line', () => {
    const text = formatRawMovies({ source: 's', fetchedAt: 't', movies: [normalizeMovie(details()), normalizeMovie(details({ id: 2 }))] });
    expect(JSON.parse(text).movies).toHaveLength(2);
    expect(text.split('\n').filter(line => line.trimStart().startsWith('{"id"'))).toHaveLength(2);
  });
});

describe('mapPool', () => {
  it('preserves order and never exceeds the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapPool([5, 1, 4, 2, 3], 2, async n => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise(r => setTimeout(r, n));
      inFlight--;
      return n * 10;
    });
    expect(out).toEqual([50, 10, 40, 20, 30]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});

describe('createTmdbClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  const respond = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers });

  it('sends v3 keys as a query param and v4 tokens as a Bearer header', async () => {
    const fetchMock = vi.fn(async () => respond(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await createTmdbClient({ credential: 'v3key' }).get('/movie/1');
    const [url1, init1] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url1.searchParams.get('api_key')).toBe('v3key');
    expect((init1.headers as Record<string, string>).authorization).toBeUndefined();

    await createTmdbClient({ credential: 'eyJ.token' }).get('/movie/1');
    const [url2, init2] = fetchMock.mock.calls[1] as unknown as [URL, RequestInit];
    expect(url2.searchParams.get('api_key')).toBeNull();
    expect((init2.headers as Record<string, string>).authorization).toBe('Bearer eyJ.token');
  });

  it('retries rate limits, honoring Retry-After', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(429, {}, { 'retry-after': '0.01' }))
      .mockResolvedValueOnce(respond(200, { page: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(createTmdbClient({ credential: 'k' }).get('/movie/top_rated')).resolves.toEqual({ page: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails fast on a rejected credential', async () => {
    const fetchMock = vi.fn(async () => respond(401));
    vi.stubGlobal('fetch', fetchMock);
    await expect(createTmdbClient({ credential: 'bad' }).get('/movie/1')).rejects.toThrow(/401/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
