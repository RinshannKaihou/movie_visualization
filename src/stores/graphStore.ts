import { create } from 'zustand';
import type { Movie, MovieNode, MovieEdge, ConnectionType, GraphData } from '../types';

interface GraphState {
  // Data
  movies: Movie[];
  nodes: MovieNode[];
  edges: MovieEdge[];

  // UI State
  selectedMovie: Movie | null;
  hoveredMovie: Movie | null;
  activeFilters: Set<ConnectionType>;
  searchQuery: string;

  // Loading states
  isLoading: boolean;
  isLoadingDetails: boolean;
  error: string | null;

  // Graph mode
  is3DMode: boolean;

  // Actions
  setMovies: (movies: Movie[]) => void;
  setGraphData: (data: GraphData) => void;
  selectMovie: (movie: Movie | null) => void;
  hoverMovie: (movie: Movie | null) => void;
  toggleFilter: (filter: ConnectionType) => void;
  setActiveFilters: (filters: Set<ConnectionType>) => void;
  setSearchQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setLoadingDetails: (loading: boolean) => void;
  setError: (error: string | null) => void;
  set3DMode: (is3D: boolean) => void;

  // Computed getters
  getFilteredEdges: () => MovieEdge[];
  getConnectedMovieIds: (movieId: number) => number[];
}

export const useGraphStore = create<GraphState>((set, get) => ({
  // Initial state
  movies: [],
  nodes: [],
  edges: [],
  selectedMovie: null,
  hoveredMovie: null,
  activeFilters: new Set<ConnectionType>(['same_actor', 'same_director', 'same_genre', 'similar_plot']),
  searchQuery: '',
  isLoading: true,
  isLoadingDetails: false,
  error: null,
  is3DMode: true,

  // Actions
  setMovies: (movies) => set({ movies }),

  setGraphData: (data) => set({ nodes: data.nodes, edges: data.links }),

  selectMovie: (movie) => set({ selectedMovie: movie }),

  hoverMovie: (movie) => set({ hoveredMovie: movie }),

  toggleFilter: (filter) => {
    const { activeFilters } = get();
    const newFilters = new Set(activeFilters);
    if (newFilters.has(filter)) {
      newFilters.delete(filter);
    } else {
      newFilters.add(filter);
    }
    set({ activeFilters: newFilters });
  },

  setActiveFilters: (filters) => set({ activeFilters: filters }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setLoading: (loading) => set({ isLoading: loading }),

  setLoadingDetails: (loading) => set({ isLoadingDetails: loading }),

  setError: (error) => set({ error }),

  set3DMode: (is3D) => set({ is3DMode: is3D }),

  // Computed getters
  getFilteredEdges: () => {
    const { edges, activeFilters } = get();
    if (activeFilters.size === 4) return edges; // All filters active

    return edges.filter(edge =>
      edge.types.some(type => activeFilters.has(type))
    );
  },

  getConnectedMovieIds: (movieId) => {
    const { edges, activeFilters } = get();
    const connectedIds = new Set<number>();

    edges.forEach(edge => {
      // Check if this edge has any active filter type
      const hasActiveType = edge.types.some(type => activeFilters.has(type));
      if (!hasActiveType) return;

      if (edge.source === movieId) {
        connectedIds.add(edge.target);
      } else if (edge.target === movieId) {
        connectedIds.add(edge.source);
      }
    });

    return Array.from(connectedIds);
  },
}));
