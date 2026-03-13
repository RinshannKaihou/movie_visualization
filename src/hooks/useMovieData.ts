import { useEffect, useCallback, useState } from 'react';
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
  
  // Track loading progress for 1000 movies
  const [progress, setProgress] = useState<{ loaded: number; total: number } | undefined>();

  // Load data from cache or fetch from API
  const loadData = useCallback(async (forceRefresh: boolean = false) => {
    console.log('useMovieData: loadData called, forceRefresh:', forceRefresh);
    setLoading(true);
    setError(null);
    setProgress(undefined);

    try {
      // Try to load from cache first
      if (!forceRefresh) {
        console.log('useMovieData: Checking cache...');
        const cached = await loadGraphData();
        if (cached) {
          console.log('useMovieData: Found cached data, movies:', cached.movies.length);
          setMovies(cached.movies);
          setGraphData(cached.graphData);
          setLoading(false);
          return;
        }
      }

      // Fetch from TMDB API - 1000 movies with progress tracking
      console.log('useMovieData: Fetching from TMDB API...');
      setProgress({ loaded: 0, total: 1000 });
      
      const fetchedMovies = await fetchMoviesWithDetails(1000, (loaded, total) => {
        console.log(`useMovieData: Progress: ${loaded}/${total}`);
        setProgress({ loaded, total });
      });

      console.log('useMovieData: Fetched movies:', fetchedMovies.length);

      // Build graph data
      const graphData = buildGraphData(fetchedMovies);
      console.log('useMovieData: Built graph data, nodes:', graphData.nodes.length, 'links:', graphData.links.length);

      // Save to cache
      await saveGraphData(fetchedMovies, graphData);

      // Update state
      setMovies(fetchedMovies);
      setGraphData(graphData);
      console.log('useMovieData: State updated successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load movie data';
      console.error('useMovieData: Error:', err);
      setError(message);
    } finally {
      console.log('useMovieData: Setting loading to false');
      setLoading(false);
      setProgress(undefined);
    }
  }, [setMovies, setGraphData, setLoading, setError]);

  // Refresh data (clear cache and fetch)
  const refreshData = useCallback(async () => {
    await clearCache();
    await loadData(true);
  }, [loadData]);

  // Load data on mount
  useEffect(() => {
    console.log('useMovieData: useEffect running, calling loadData');
    loadData();
  }, [loadData]);

  return {
    movies,
    nodes,
    edges,
    isLoading,
    error,
    progress,
    loadData,
    refreshData,
  };
};
