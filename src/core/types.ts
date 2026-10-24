/**
 * Domain types shared by the browser app and the Node data scripts.
 *
 * Everything under src/core/ must stay DOM-free and import siblings with
 * explicit `.ts` extensions so `node scripts/*.ts` (native type stripping)
 * can load it without a bundler.
 */

/** A normalized TMDB movie as stored in data/movies.json. */
export interface Movie {
  id: number;            // TMDB id
  title: string;
  year: number;          // 0 when TMDB has no release date
  posterPath: string;    // TMDB image path ("/abc.jpg"), '' when missing
  rating: number;        // TMDB vote_average, 0–10
  genres: string[];      // TMDB genre names in TMDB order ("Science Fiction", …)
  directors: string[];
  cast: string[];        // billing order, top-billed first
  keywords: string[];
  overview: string;
}

export type ConnectionType = 'director' | 'cast' | 'theme' | 'genre';

export type GenreFamilyId =
  | 'drama'
  | 'romance'
  | 'animation'
  | 'scifi'
  | 'action'
  | 'horror'
  | 'crime'
  | 'other';

/** A movie placed in the graph. `index` is its position in Dataset.nodes. */
export interface MovieNode extends Movie {
  index: number;
  x: number;
  y: number;
  family: GenreFamilyId;
  radius: number;        // world units, derived from rating
  degree: number;
}

/** Undirected similarity edge. Endpoints are node indices, not TMDB ids. */
export interface Edge {
  source: number;
  target: number;
  mask: number;          // ConnectionType bits, see core/connections.ts
  weight: number;        // similarity, normalized to 0–1 across the dataset
}

/** Runtime form of the dataset, built by decodeDataset(). */
export interface Dataset {
  version: number;
  /** When the underlying TMDB data was fetched (ISO 8601). */
  fetchedAt: string;
  nodes: MovieNode[];
  edges: Edge[];
  /** node index → indices into `edges` */
  adjacency: number[][];
  indexById: Map<number, number>;
}
