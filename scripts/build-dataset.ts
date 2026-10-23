/**
 * Offline dataset build: data/movies.json → src/generated/dataset.json.
 *
 *   npm run data:build                       # graph + layout + encode
 *   npm run data:build -- --preview out.png  # also render a PNG of the layout
 *
 * Deterministic and network-free: re-running on the same input produces the
 * same file, so tuning graph or layout parameters never needs a TMDB refetch.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { buildGraph, DEFAULT_GRAPH_PARAMS } from '../src/core/graph.ts';
import { computeLayout, DEFAULT_LAYOUT_PARAMS, nodeRadius } from '../src/core/layout.ts';
import { decodeDataset, encodeDataset } from '../src/core/dataset.ts';
import { familyOf } from '../src/core/genres.ts';
import { CONNECTION_TYPES, typesFromMask } from '../src/core/connections.ts';
import type { Movie } from '../src/core/types.ts';
import type { RawMoviesFile } from './tmdb.ts';
import { hashPipelineInputs } from './inputHash.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INPUT = resolve(root, 'data/movies.json');
const OUTPUT = resolve(root, 'src/generated/dataset.json');

const previewArg = process.argv.indexOf('--preview');
const previewPath = previewArg > 0 ? resolve(process.cwd(), process.argv[previewArg + 1] ?? 'preview.png') : null;

const time = <T>(label: string, fn: () => T): T => {
  const start = performance.now();
  const result = fn();
  console.log(`  ${label.padEnd(8)} ${(performance.now() - start).toFixed(0).padStart(6)} ms`);
  return result;
};

const raw = JSON.parse(await readFile(INPUT, 'utf8')) as RawMoviesFile;
const seen = new Set<number>();
const movies: Movie[] = raw.movies.filter(m => !seen.has(m.id) && seen.add(m.id));
if (movies.length !== raw.movies.length) {
  console.warn(`  dropped ${raw.movies.length - movies.length} duplicate movie ids`);
}
console.log(`Building dataset from ${movies.length} movies (${INPUT})`);

const edges = time('graph', () => buildGraph(movies, DEFAULT_GRAPH_PARAMS));

const ratings = movies.map(m => m.rating);
const [minRating, maxRating] = [Math.min(...ratings), Math.max(...ratings)];
const layoutNodes = movies.map(m => ({ family: familyOf(m.genres), radius: nodeRadius(m.rating, minRating, maxRating) }));
const positions = time('layout', () => computeLayout(layoutNodes, edges, DEFAULT_LAYOUT_PARAMS));

const file = encodeDataset({
  movies,
  positions,
  edges,
  fetchedAt: raw.fetchedAt,
  source: raw.source,
  inputHash: await hashPipelineInputs(root),
});
const json = JSON.stringify(file);
decodeDataset(JSON.parse(json)); // fail the build, not the browser, on a bad file

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, json + '\n', 'utf8');

// --- report ---------------------------------------------------------------
const degree = new Int32Array(movies.length);
const typeCounts = Object.fromEntries(CONNECTION_TYPES.map(t => [t, 0]));
for (const e of edges) {
  degree[e.source]++;
  degree[e.target]++;
  for (const t of typesFromMask(e.mask)) typeCounts[t]++;
}
const sortedDegree = [...degree].sort((a, b) => a - b);
console.log(`  edges    ${edges.length} (${JSON.stringify(typeCounts)})`);
console.log(
  `  degree   min ${sortedDegree[0]} · median ${sortedDegree[sortedDegree.length >> 1]} · max ${sortedDegree.at(-1)}`,
);
console.log(
  `  size     ${(json.length / 1024).toFixed(0)} KB raw · ${(gzipSync(json).length / 1024).toFixed(0)} KB gzip`,
);
console.log(`Wrote ${OUTPUT}`);

if (previewPath) {
  const { renderPreview } = await import('./preview.ts');
  await renderPreview(decodeDataset(file), previewPath);
  console.log(`Wrote preview ${previewPath}`);
}
