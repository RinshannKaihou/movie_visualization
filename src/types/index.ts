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

// Genre colors for visualization
export const GENRE_COLORS: Record<string, string> = {
  'Drama': '#f59e0b',
  'Action': '#ef4444',
  'Sci-Fi': '#06b6d4',
  'Comedy': '#eab308',
  'Thriller': '#a855f7',
  'Horror': '#dc2626',
  'Romance': '#ec4899',
  'Animation': '#10b981',
  'Documentary': '#6366f1',
  'Adventure': '#f97316',
  'Crime': '#78716c',
  'Fantasy': '#8b5cf6',
  'Mystery': '#6366f1',
  'War': '#854d0e',
  'default': '#64748b',
};

// Connection type colors
export const CONNECTION_COLORS: Record<ConnectionType, string> = {
  same_actor: '#f97316',
  same_director: '#3b82f6',
  same_genre: '#22c55e',
  similar_plot: '#a855f7',
};
