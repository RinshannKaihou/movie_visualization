import { useMemo } from 'react';
import { useGraphStore } from '../stores/graphStore';
import type { ConnectionType } from '../types';

export const useGraphFilters = () => {
  const {
    nodes,
    edges,
    activeFilters,
    searchQuery,
    selectedMovie,
    toggleFilter,
    setActiveFilters,
    setSearchQuery,
    getConnectedEdges,
    getConnectedMovieIds,
  } = useGraphStore();

  // Get filtered edges based on active filters
  const filteredEdges = useMemo(() => {
    if (activeFilters.size === 0) return [];
    if (activeFilters.size === 4) return edges;

    return edges.filter(edge => {
      return edge.types.some(type => activeFilters.has(type));
    });
  }, [edges, activeFilters]);

  // Get nodes that match search query
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return new Set<number>();

    const query = searchQuery.trim().toLowerCase();
    const matches = new Set<number>();

    nodes.forEach(node => {
      if (
        node.title.toLowerCase().includes(query) ||
        node.directors.some(d => d.toLowerCase().includes(query)) ||
        node.leadActors.some(a => a.toLowerCase().includes(query)) ||
        node.genres.some(g => g.toLowerCase().includes(query))
      ) {
        matches.add(node.id);
      }
    });

    return matches;
  }, [nodes, searchQuery]);

  // Get connected movie IDs for the selected movie
  const connectedMovieIds = useMemo(() => {
    if (!selectedMovie) return new Set<number>();
    return new Set(getConnectedMovieIds(selectedMovie.id));
  }, [selectedMovie, getConnectedMovieIds]);

  const connectedEdges = useMemo(() => {
    if (!selectedMovie) return [];
    return getConnectedEdges(selectedMovie.id);
  }, [selectedMovie, getConnectedEdges]);

  const visibleNodeIds = useMemo(() => {
    if (selectedMovie) {
      const ids = new Set<number>(connectedMovieIds);
      ids.add(selectedMovie.id);
      return ids;
    }

    if (!searchQuery.trim()) {
      return null;
    }

    return new Set(searchMatches);
  }, [selectedMovie, connectedMovieIds, searchMatches, searchQuery]);

  const visibleEdges = useMemo(() => {
    if (selectedMovie) {
      return connectedEdges;
    }

    if (!visibleNodeIds) {
      return filteredEdges;
    }

    return filteredEdges.filter(edge =>
      visibleNodeIds.has(edge.source as number) && visibleNodeIds.has(edge.target as number)
    );
  }, [selectedMovie, connectedEdges, visibleNodeIds, filteredEdges]);

  // Check if a node should be highlighted
  const getNodeHighlight = (nodeId: number): {
    isSelected: boolean;
    isConnected: boolean;
    isSearchMatch: boolean;
    isDimmed: boolean;
  } => {
    const isSelected = selectedMovie?.id === nodeId;
    const isConnected = connectedMovieIds.has(nodeId);
    const isSearchMatch = searchQuery.trim() ? searchMatches.has(nodeId) : false;

    // Dim nodes that aren't relevant to current selection/search
    const isDimmed = Boolean(
      (selectedMovie && !isSelected && !isConnected) ||
      (searchQuery.trim() && !isSearchMatch)
    );

    return {
      isSelected,
      isConnected,
      isSearchMatch,
      isDimmed,
    };
  };

  // Filter control helpers
  const setAllFilters = () => {
    setActiveFilters(new Set(['same_actor', 'same_director', 'same_genre', 'similar_plot']));
  };

  const clearAllFilters = () => {
    setActiveFilters(new Set());
  };

  const toggleActorFilter = () => toggleFilter('same_actor');
  const toggleDirectorFilter = () => toggleFilter('same_director');
  const toggleGenreFilter = () => toggleFilter('same_genre');
  const togglePlotFilter = () => toggleFilter('similar_plot');

  const isFilterActive = (filter: ConnectionType): boolean => {
    return activeFilters.has(filter);
  };

  return {
    activeFilters,
    filteredEdges,
    visibleEdges,
    searchQuery,
    searchMatches,
    connectedEdges,
    connectedMovieIds,
    visibleNodeIds,
    setSearchQuery,
    toggleFilter,
    setActiveFilters,
    getNodeHighlight,
    setAllFilters,
    clearAllFilters,
    toggleActorFilter,
    toggleDirectorFilter,
    toggleGenreFilter,
    togglePlotFilter,
    isFilterActive,
  };
};
