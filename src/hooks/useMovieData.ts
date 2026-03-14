import { useEffect, useCallback, useState } from 'react';
import { useGraphStore } from '../stores/graphStore';
import { fetchMoviesWithDetails } from '../services/tmdb';
import { loadStaticData } from '../services/staticData';
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
  
  // Track if we're using static data
  const [usingStaticData, setUsingStaticData] = useState(false);

  // Load data from static file, cache, or fetch from API
  const loadData = useCallback(async (forceRefresh: boolean = false) => {
    console.log('useMovieData: loadData called, forceRefresh:', forceRefresh);
    setLoading(true);
    setError(null);
    setProgress(undefined);
    setUsingStaticData(false);

    try {
      // Priority 1: Try static JSON file (for deployed version without API key)
      if (!forceRefresh) {
        console.log('useMovieData: Checking for static data...');
        const staticData = await loadStaticData();
        if (staticData) {
          console.log('useMovieData: Using static data');
          setMovies(staticData.movies);
          setGraphData(staticData.graphData);
          setUsingStaticData(true);
          setLoading(false);
          return;
        }
      }

      // Priority 2: Try to load from IndexedDB cache
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

      // Priority 3: Fetch from TMDB API (requires API key)
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
    usingStaticData,
    loadData,
    refreshData,
  };
};
