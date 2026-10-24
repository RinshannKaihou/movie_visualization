import type { Dataset, Edge, Movie, MovieNode } from './types.ts';
import { ALL_CONNECTIONS_MASK } from './connections.ts';
import { familyOf } from './genres.ts';
import { nodeRadius } from './layout.ts';

/**
 * On-disk dataset format (src/generated/dataset.json), produced by
 * scripts/build-dataset.ts. Compact on purpose: strings are interned into one
 * table, movies are tuples, edges are a flat number array. Positions are
 * always baked in; the browser does no layout work.
 *
 * Bump DATASET_VERSION on any shape change. The app refuses other versions
 * with a clear error instead of rendering garbage.
 */
export const DATASET_VERSION = 5;

export type MovieRecord = [
  id: number,
  title: string,
  year: number,
  posterPath: string,
  rating: number,
  genres: number[],
  directors: number[],
  cast: number[],
  keywords: number[],
  overview: string,
  x: number,
  y: number,
];

export interface DatasetFile {
  version: number;
  fetchedAt: string;
  source: string;
  /** Hash of the pipeline inputs this file was built from (see scripts/inputHash.ts). */
  inputHash?: string;
  strings: string[];
  movies: MovieRecord[];
  /** Flat quads: source index, target index, connection mask, weight × 1000. */
  edges: number[];
}

export class DatasetError extends Error {
  name = 'DatasetError';
}

export const encodeDataset = (input: {
  movies: readonly Movie[];
  positions: ArrayLike<number>;
  edges: readonly Edge[];
  fetchedAt: string;
  source: string;
  inputHash?: string;
}): DatasetFile => {
  const strings: string[] = [];
  const ids = new Map<string, number>();
  const intern = (s: string) => {
    let id = ids.get(s);
    if (id == null) {
      id = strings.length;
      strings.push(s);
      ids.set(s, id);
    }
    return id;
  };

  const movies = input.movies.map((m, i): MovieRecord => [
    m.id,
    m.title,
    m.year,
    m.posterPath,
    m.rating,
    m.genres.map(intern),
    m.directors.map(intern),
    m.cast.map(intern),
    m.keywords.map(intern),
    m.overview,
    input.positions[i * 2],
    input.positions[i * 2 + 1],
  ]);

  const edges: number[] = [];
  for (const e of input.edges) edges.push(e.source, e.target, e.mask, Math.round(e.weight * 1000));

  return {
    version: DATASET_VERSION,
    fetchedAt: input.fetchedAt,
    source: input.source,
    inputHash: input.inputHash,
    strings,
    movies,
    edges,
  };
};

export const decodeDataset = (raw: unknown): Dataset => {
  const file = raw as Partial<DatasetFile> | null;
  if (!file || typeof file !== 'object') throw new DatasetError('Dataset is not a JSON object.');
  if (file.version !== DATASET_VERSION) {
    throw new DatasetError(
      `Dataset version ${String(file.version)} does not match the app (expected ${DATASET_VERSION}). ` +
        'Regenerate it with `npm run data:build`.',
    );
  }
  const { strings, movies, edges: flatEdges } = file;
  if (!Array.isArray(strings) || !Array.isArray(movies) || !Array.isArray(flatEdges) || flatEdges.length % 4 !== 0) {
    throw new DatasetError('Dataset is missing strings, movies, or edges.');
  }
  if (movies.length === 0) throw new DatasetError('Dataset has no movies.');
  if (file.fetchedAt && Number.isNaN(Date.parse(file.fetchedAt))) {
    throw new DatasetError(`Dataset has an invalid fetchedAt date (${file.fetchedAt}).`);
  }

  const str = (i: number) => {
    const s = strings[i];
    if (typeof s !== 'string') throw new DatasetError(`Dataset references missing string #${i}.`);
    return s;
  };

  let minRating = Infinity;
  let maxRating = -Infinity;
  for (const r of movies) {
    minRating = Math.min(minRating, r[4]);
    maxRating = Math.max(maxRating, r[4]);
  }

  const nodes: MovieNode[] = movies.map((r, index) => {
    const [id, title, year, posterPath, rating, genres, directors, cast, keywords, overview, x, y] = r;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new DatasetError(`"${title}" has no layout position. Regenerate with \`npm run data:build\`.`);
    }
    if (!Number.isFinite(rating) || !Number.isFinite(year)) {
      throw new DatasetError(`"${title}" has an invalid rating or year.`);
    }
    const genreNames = genres.map(str);
    return {
      id, title, year, posterPath, rating, overview,
      genres: genreNames,
      directors: directors.map(str),
      cast: cast.map(str),
      keywords: keywords.map(str),
      index, x, y,
      family: familyOf(genreNames),
      radius: nodeRadius(rating, minRating, maxRating),
      degree: 0,
    };
  });

  const edges: Edge[] = [];
  const adjacency: number[][] = nodes.map(() => []);
  for (let i = 0; i < flatEdges.length; i += 4) {
    const source = flatEdges[i];
    const target = flatEdges[i + 1];
    const mask = flatEdges[i + 2];
    const weight = flatEdges[i + 3];
    if (!nodes[source] || !nodes[target] || source === target) {
      throw new DatasetError(`Edge ${i / 4} has invalid endpoints (${source}, ${target}).`);
    }
    if (!Number.isInteger(mask) || mask <= 0 || mask > ALL_CONNECTIONS_MASK || !(weight >= 0 && weight <= 1000)) {
      throw new DatasetError(`Edge ${i / 4} has an invalid mask or weight.`);
    }
    adjacency[source].push(edges.length);
    adjacency[target].push(edges.length);
    nodes[source].degree++;
    nodes[target].degree++;
    edges.push({ source, target, mask, weight: weight / 1000 });
  }

  return {
    version: file.version,
    fetchedAt: String(file.fetchedAt ?? ''),
    nodes,
    edges,
    adjacency,
    indexById: new Map(nodes.map(n => [n.id, n.index])),
  };
};

/** The other endpoint of an edge. */
export const otherEnd = (edge: Edge, index: number): number =>
  edge.source === index ? edge.target : edge.source;

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';

export type PosterSize = 'w92' | 'w154' | 'w185' | 'w342' | 'w500';

export const posterUrl = (posterPath: string, size: PosterSize): string =>
  posterPath ? `${TMDB_IMAGE_BASE}${size}${posterPath}` : '';

export const tmdbMovieUrl = (id: number): string => `https://www.themoviedb.org/movie/${id}`;
