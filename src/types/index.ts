// Core movie data from TMDB
export interface Movie {
  id: number;                    // TMDB ID
  title: string;
  year: number;
  poster: string;                // Full URL to poster image
  rating: number;                // 0-10
  genres: string[];
  directors: string[];
  leadActors: string[];          // Top 3-5 billed
  plotKeywords: string[];
  overview: string;
}

// Node in the force graph (extends Movie with position data)
export interface MovieNode extends Movie {
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
}

// Types of connections between movies
export type ConnectionType =
  | 'same_actor'
  | 'same_director'
  | 'same_genre'
  | 'similar_plot';

// Edge connecting two movies
export interface MovieEdge {
  source: number;                // Movie ID
  target: number;                // Movie ID
  types: ConnectionType[];       // Can have multiple connection types
  strength: number;              // 1-4 (count of shared types)
}

// Graph data structure for react-force-graph
export interface GraphData {
  nodes: MovieNode[];
  links: MovieEdge[];
}

// TMDB API response types
export interface TMDBMovie {
  id: number;
  title: string;
  poster_path: string | null;
  vote_average: number;
  release_date: string;
  genre_ids: number[];
  overview: string;
}

export interface TMDBMovieDetails extends TMDBMovie {
  genres: { id: number; name: string }[];
  credits: {
    cast: TMDBCast[];
    crew: TMDBCrew[];
  };
  keywords: {
    keywords: TMDBKeyword[];
  };
}

export interface TMDBCast {
  id: number;
  name: string;
  character: string;
  order: number;
}

export interface TMDBCrew {
  id: number;
  name: string;
  job: string;
  department: string;
}

export interface TMDBKeyword {
  id: number;
  name: string;
}

export interface TMDBResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

// Genre mapping (TMDB ID to name)
export const GENRE_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

// Spectral classes (genre → star color) — see services/graphBuilder.ts
// for the astronomical analogies. Kept in sync with that module.
export const GENRE_COLORS: Record<string, string> = {
  'Drama':       '#ffd27a',
  'Action':      '#ff5a3d',
  'Sci-Fi':      '#6edcff',
  'Comedy':      '#ffe96b',
  'Thriller':    '#b68cff',
  'Horror':      '#d8344a',
  'Romance':     '#ff8fc4',
  'Animation':   '#8cf2c5',
  'Documentary': '#9aa8ff',
  'Adventure':   '#ffb066',
  'Crime':       '#8891a6',
  'Fantasy':     '#a57bff',
  'Mystery':     '#7ba2ff',
  'War':         '#b37a4a',
  'default':     '#bcbfd0',
};

// Gravitational (edge) colors — threads of light between stars
export const CONNECTION_COLORS: Record<ConnectionType, string> = {
  same_actor:    '#ffb066',
  same_director: '#7ba2ff',
  same_genre:    '#7cffd4',
  similar_plot:  '#b68cff',
};
