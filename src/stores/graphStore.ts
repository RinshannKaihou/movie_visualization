import { create } from 'zustand';
import type { Movie, MovieNode, MovieEdge, ConnectionType, GraphData } from '../types';

interface GraphState {
  // Data
  movies: Movie[];
  nodes: MovieNode[];
  edges: MovieEdge[];
  edgeAdjacency: Map<number, MovieEdge[]>;

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
  getConnectedEdges: (movieId: number) => MovieEdge[];
  getConnectedMovieIds: (movieId: number) => number[];
}

export const useGraphStore = create<GraphState>((set, get) => ({
  // Initial state
  movies: [],
  nodes: [],
  edges: [],
  edgeAdjacency: new Map<number, MovieEdge[]>(),
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

  setGraphData: (data) => {
    const edgeAdjacency = new Map<number, MovieEdge[]>();

    data.links.forEach(edge => {
      const sourceId = edge.source as number;
      const targetId = edge.target as number;

      if (!edgeAdjacency.has(sourceId)) {
        edgeAdjacency.set(sourceId, []);
      }
      if (!edgeAdjacency.has(targetId)) {
        edgeAdjacency.set(targetId, []);
      }

      edgeAdjacency.get(sourceId)!.push(edge);
      edgeAdjacency.get(targetId)!.push(edge);
    });

    set({ nodes: data.nodes, edges: data.links, edgeAdjacency });
  },

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
    if (activeFilters.size === 0) return [];
    if (activeFilters.size === 4) return edges; // All filters active

    return edges.filter(edge =>
      edge.types.some(type => activeFilters.has(type))
    );
  },

  getConnectedEdges: (movieId) => {
    const { edgeAdjacency, activeFilters } = get();
    const connectedEdges = edgeAdjacency.get(movieId) ?? [];

    if (activeFilters.size === 4) {
      return connectedEdges;
    }

    return connectedEdges.filter(edge =>
      edge.types.some(type => activeFilters.has(type))
    );
  },

  getConnectedMovieIds: (movieId) => {
    const connectedEdges = get().getConnectedEdges(movieId);
    const connectedIds = new Set<number>();

    connectedEdges.forEach(edge => {
      // Handle both raw IDs (number) and D3-processed references (object with id)
      const sourceId = typeof edge.source === 'number' ? edge.source : (edge.source as MovieNode).id;
      const targetId = typeof edge.target === 'number' ? edge.target : (edge.target as MovieNode).id;
      
      if (sourceId === movieId) {
        connectedIds.add(targetId);
      } else if (targetId === movieId) {
        connectedIds.add(sourceId);
      }
    });

    return Array.from(connectedIds);
  },
}));
