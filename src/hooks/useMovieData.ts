import { useEffect, useCallback } from 'react';
import { useGraphStore } from '../stores/graphStore';
import { fetchMoviesWithDetails } from '../services/tmdb';
import { buildGraphData } from '../services/graphBuilder';
import { saveGraphData, loadGraphData, clearCache } from '../utils/cache';

export const useMovieData = () => {
  const {
    movies,
    nodes,
    edges,
    isLoading,
    error,
    setMovies,
    setGraphData,
    setLoading,
    setError,
  } = useGraphStore();

  // Load data from cache or fetch from API
  const loadData = useCallback(async (forceRefresh: boolean = false) => {
    setLoading(true);
    setError(null);

    try {
      // Try to load from cache first
      if (!forceRefresh) {
        const cached = await loadGraphData();
        if (cached) {
          setMovies(cached.movies);
          setGraphData(cached.graphData);
          setLoading(false);
          return;
        }
      }

      // Fetch from TMDB API
      console.log('Fetching movies from TMDB...');
      const fetchedMovies = await fetchMoviesWithDetails(250, (loaded, total) => {
        console.log(`Loading progress: ${loaded}/${total}`);
      });

      // Build graph data
      const graphData = buildGraphData(fetchedMovies);

      // Save to cache
      await saveGraphData(fetchedMovies, graphData);

      // Update state
      setMovies(fetchedMovies);
      setGraphData(graphData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load movie data';
      console.error('Error loading data:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [setMovies, setGraphData, setLoading, setError]);

  // Refresh data (clear cache and fetch)
  const refreshData = useCallback(async () => {
    await clearCache();
    await loadData(true);
  }, [loadData]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    movies,
    nodes,
    edges,
    isLoading,
    error,
    loadData,
    refreshData,
  };
};
