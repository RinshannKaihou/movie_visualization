#!/usr/bin/env node
// Build public/data/movies.json from the TMDB API.
//
// Run with:
//   node --env-file=.env scripts/build-static-data.mjs
//   # or:
//   npm run build:data
//
// This script is intentionally self-contained (no src/ imports) so it
// can run without a TS transpiler. The fetch and graph-building logic
// is ported from src/services/tmdb.ts and src/services/graphBuilder.ts —
// keep it in sync when those files change in a meaningful way.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------
// Configuration (keep in sync with useMovieData.ts / graphBuilder.ts)
// ------------------------------------------------------------------
const MAX_MOVIES = 2000;
const CAST_LIMIT = 10;      // mirrors tmdb.ts transformToMovie
const KEYWORD_LIMIT = 20;   // mirrors tmdb.ts transformToMovie
const CACHE_VERSION = 3;    // mirrors src/utils/cache.ts DB_VERSION

// Graph tuning — mirrors graphBuilder.ts
const CONNECTION_LIMITS = {
  same_actor:    { cliqueThreshold: 6, maxPeersPerMovie: 4 },
  same_director: { cliqueThreshold: 8, maxPeersPerMovie: 6 },
  same_genre:    { cliqueThreshold: 4, maxPeersPerMovie: 3 },
};
const EDGE_TYPE_WEIGHT = {
  same_director: 5,
  same_actor:    4,
  similar_plot:  3,
  same_genre:    1,
};
const MAX_EDGES_PER_NODE = 10;

const TMDB_BASE_URL   = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// Output path
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const OUTPUT_PATH = resolve(__dirname, '..', 'public', 'data', 'movies.json');

// ------------------------------------------------------------------
// Tiny progress helper — single-line updates when the terminal is a TTY
// ------------------------------------------------------------------
const isTTY = process.stdout.isTTY;
const progress = (msg) => {
  if (isTTY) {
    process.stdout.write(`\r\x1b[2K${msg}`);
  } else {
    console.log(msg);
  }
};
const progressDone = (msg) => {
  if (isTTY) process.stdout.write(`\r\x1b[2K${msg}\n`);
  else console.log(msg);
};

// ------------------------------------------------------------------
// TMDB fetch helpers (ported from src/services/tmdb.ts)
// ------------------------------------------------------------------
const getApiKey = () => {
  const key = process.env.VITE_TMDB_API_KEY;
  if (!key) {
    console.error(
      'ERROR: VITE_TMDB_API_KEY is not set.\n' +
      'Make sure you run this script with --env-file=.env, e.g.\n' +
      '  node --env-file=.env scripts/build-static-data.mjs'
    );
    process.exit(1);
  }
  return key;
};

const fetchTMDB = async (endpoint, params = {}, attempt = 1) => {
  const apiKey = getApiKey();
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  try {
    const res = await fetch(url.toString());
    if (res.status === 429) {
      // Rate-limited — back off and retry once
      if (attempt <= 3) {
        const retryAfter = Number(res.headers.get('retry-after')) || 2;
        await sleep(retryAfter * 1000);
        return fetchTMDB(endpoint, params, attempt + 1);
      }
    }
    if (!res.ok) {
      throw new Error(`TMDB ${res.status} ${res.statusText} for ${endpoint}`);
    }
    return res.json();
  } catch (err) {
    if (attempt <= 3) {
      await sleep(500 * attempt);
      return fetchTMDB(endpoint, params, attempt + 1);
    }
    throw err;
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fetch top-rated movie list across multiple pages
const fetchAllTopRatedMovies = async (maxMovies) => {
  const all = [];
  const totalPages = Math.ceil(maxMovies / 20);

  for (let page = 1; page <= totalPages; page++) {
    const resp = await fetchTMDB('/movie/top_rated', { page: String(page) });
    all.push(...resp.results);
    progress(`  Fetching movie list: page ${page}/${totalPages} (${all.length} movies)`);
    if (all.length >= maxMovies) break;
    // Match the >1500 delay tier in tmdb.ts
    if (page < totalPages) await sleep(300);
  }
  progressDone(`  Fetched ${Math.min(all.length, maxMovies)} movies across ${totalPages} pages`);
  return all.slice(0, maxMovies);
};

// Fetch detail (credits + keywords) for a single movie
const fetchMovieDetails = (movieId) =>
  fetchTMDB(`/movie/${movieId}`, { append_to_response: 'credits,keywords' });

// Transform TMDB detail response to our Movie shape
const transformToMovie = (details) => {
  const directors = details.credits.crew
    .filter((p) => p.job === 'Director')
    .map((p) => p.name);

  const leadActors = details.credits.cast
    .slice(0, CAST_LIMIT)
    .map((a) => a.name);

  const plotKeywords = (details.keywords?.keywords ?? [])
    .slice(0, KEYWORD_LIMIT)
    .map((kw) => kw.name);

  const genres = details.genres.map((g) => g.name);

  return {
    id: details.id,
    title: details.title,
    year: parseInt(details.release_date?.substring(0, 4) || '0'),
    poster: details.poster_path ? `${TMDB_IMAGE_BASE}${details.poster_path}` : '',
    rating: details.vote_average,
    genres,
    directors,
    leadActors,
    plotKeywords,
    overview: details.overview,
  };
};

// ------------------------------------------------------------------
// Graph builder (ported from src/services/graphBuilder.ts)
// ------------------------------------------------------------------
const buildIndex = (movies, accessor) => {
  const index = new Map();
  for (const movie of movies) {
    for (const value of accessor(movie)) {
      if (!index.has(value)) index.set(value, []);
      index.get(value).push(movie.id);
    }
  }
  return index;
};

const buildGraphData = (movies) => {
  const start = performance.now();
  const nodes = movies.map((m) => ({ ...m }));
  const movieById = new Map(movies.map((m) => [m.id, m]));

  const actorIndex    = buildIndex(movies, (m) => m.leadActors);
  const directorIndex = buildIndex(movies, (m) => m.directors);
  const genreIndex    = buildIndex(movies, (m) => m.genres);

  const edgeMap = new Map();

  const addEdge = (sourceId, targetId, type) => {
    const key = sourceId < targetId
      ? `${sourceId}-${targetId}`
      : `${targetId}-${sourceId}`;
    let edge = edgeMap.get(key);
    if (edge) {
      if (!edge.types.includes(type)) {
        edge.types.push(type);
        edge.strength = edge.types.length;
      }
    } else {
      edgeMap.set(key, {
        source: sourceId,
        target: targetId,
        types: [type],
        strength: 1,
      });
    }
  };

  const rankMovieIds = (ids) =>
    [...new Set(ids)].sort((a, b) => {
      const left = movieById.get(a);
      const right = movieById.get(b);
      return right.rating - left.rating || right.year - left.year || a - b;
    });

  const connectIndex = (index, type) => {
    const { cliqueThreshold, maxPeersPerMovie } = CONNECTION_LIMITS[type];
    for (const movieIds of index.values()) {
      const ranked = rankMovieIds(movieIds);
      if (ranked.length < 2) continue;
      if (ranked.length <= cliqueThreshold) {
        for (let i = 0; i < ranked.length; i++) {
          for (let j = i + 1; j < ranked.length; j++) {
            addEdge(ranked[i], ranked[j], type);
          }
        }
        continue;
      }
      for (let i = 0; i < ranked.length; i++) {
        const upper = Math.min(ranked.length, i + maxPeersPerMovie + 1);
        for (let j = i + 1; j < upper; j++) {
          addEdge(ranked[i], ranked[j], type);
        }
      }
    }
  };

  connectIndex(actorIndex,    'same_actor');
  connectIndex(directorIndex, 'same_director');
  connectIndex(genreIndex,    'same_genre');

  const pruneEdges = (allEdges) => {
    const sorted = [...allEdges].sort((l, r) => {
      const lw = l.types.reduce((t, k) => t + EDGE_TYPE_WEIGHT[k], 0);
      const rw = r.types.reduce((t, k) => t + EDGE_TYPE_WEIGHT[k], 0);
      return (
        r.strength - l.strength ||
        rw - lw ||
        r.source - l.source ||
        r.target - l.target
      );
    });
    const degrees = new Map();
    const pruned = [];
    for (const edge of sorted) {
      const sd = degrees.get(edge.source) ?? 0;
      const td = degrees.get(edge.target) ?? 0;
      if (sd >= MAX_EDGES_PER_NODE || td >= MAX_EDGES_PER_NODE) continue;
      degrees.set(edge.source, sd + 1);
      degrees.set(edge.target, td + 1);
      pruned.push(edge);
    }
    return pruned;
  };

  const rawEdges = [...edgeMap.values()];
  const edges = pruneEdges(rawEdges);
  const ms = (performance.now() - start).toFixed(1);

  const typeCounts = { same_actor: 0, same_director: 0, same_genre: 0, similar_plot: 0 };
  for (const edge of edges) for (const t of edge.types) typeCounts[t]++;

  console.log(
    `  Graph built: ${nodes.length} nodes, ${edges.length}/${rawEdges.length} edges kept in ${ms}ms`
  );
  console.log('  Edge type distribution:', typeCounts);

  return { nodes, links: edges };
};

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
const main = async () => {
  console.log(`Building static movie data (target: ${MAX_MOVIES} movies)`);
  console.log(`Output: ${OUTPUT_PATH}\n`);

  // 1. Fetch the list of top-rated movies
  console.log('Step 1/3: fetching top-rated movie list');
  const basic = await fetchAllTopRatedMovies(MAX_MOVIES);

  // 2. Fetch details for each (credits + keywords)
  console.log(`\nStep 2/3: fetching detail + credits + keywords for ${basic.length} movies`);
  const movies = [];
  let failures = 0;
  const startTime = Date.now();

  for (let i = 0; i < basic.length; i++) {
    try {
      const details = await fetchMovieDetails(basic[i].id);
      movies.push(transformToMovie(details));
    } catch (err) {
      failures++;
      console.error(`\n  Failed to fetch movie ${basic[i].id} (${basic[i].title}):`, err.message);
    }

    // Progress + ETA
    if ((i + 1) % 10 === 0 || i === basic.length - 1) {
      const done = i + 1;
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = done / elapsed;
      const remaining = ((basic.length - done) / rate).toFixed(0);
      progress(
        `  Fetched ${done}/${basic.length} (${movies.length} ok, ${failures} failed) · ` +
        `${rate.toFixed(1)}/s · ~${remaining}s remaining`
      );
    }
    if (i < basic.length - 1) await sleep(200); // matches >1500 tier in tmdb.ts
  }
  progressDone(`  Fetched ${movies.length} movies (${failures} failures) in ${((Date.now() - startTime) / 1000).toFixed(0)}s`);

  if (movies.length === 0) {
    console.error('ERROR: no movies fetched. Aborting.');
    process.exit(1);
  }

  // 3. Build the graph
  console.log('\nStep 3/3: building graph');
  const graphData = buildGraphData(movies);

  // 4. Write to disk
  const payload = {
    movies,
    graphData,
    timestamp: Date.now(),
    version: CACHE_VERSION,
  };
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2), 'utf8');

  const sizeMB = (Buffer.byteLength(JSON.stringify(payload)) / 1024 / 1024).toFixed(2);
  console.log(`\nWrote ${OUTPUT_PATH}`);
  console.log(`  Movies: ${movies.length}`);
  console.log(`  Nodes:  ${graphData.nodes.length}`);
  console.log(`  Links:  ${graphData.links.length}`);
  console.log(`  Size:   ${sizeMB} MB`);
};

main().catch((err) => {
  console.error('\nBuild failed:', err);
  process.exit(1);
});
