import { useEffect, useCallback, useState } from 'react';
import { useGraphStore } from '../stores/graphStore';
import { fetchMoviesWithDetails } from '../services/tmdb';
import { loadStaticData } from '../services/staticData';
import { buildGraphData } from '../services/graphBuilder';
import { runLayoutInWorker } from '../services/layoutClient';
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
  
  // Track loading progress for 2000 movies
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
      setProgress({ loaded: 0, total: 2000 });

      const fetchedMovies = await fetchMoviesWithDetails(2000, (loaded, total) => {
        console.log(`useMovieData: Progress: ${loaded}/${total}`);
        setProgress({ loaded, total });
      });

      console.log('useMovieData: Fetched movies:', fetchedMovies.length);

      // Build graph data
      const graphData = buildGraphData(fetchedMovies);
      console.log('useMovieData: Built graph data, nodes:', graphData.nodes.length, 'links:', graphData.links.length);

      // Run one-shot layout in a worker so the main thread stays responsive
      // during the 2000-node force settle. Positions are then pinned; there
      // is no runtime tick (see MovieGraph cooldown/alphaDecay settings).
      console.log('useMovieData: Running layout in worker...');
      const layoutStart = performance.now();
      const positions = await runLayoutInWorker(
        fetchedMovies,
        graphData.links,
        { seed: 1, iterations: 300 },
      );
      console.log(`useMovieData: Layout done in ${(performance.now() - layoutStart).toFixed(0)}ms`);

      const placedNodes = graphData.nodes.map(n => {
        const p = positions.get(n.id);
        return p ? { ...n, x: p.x, y: p.y } : n;
      });
      const placedGraph = { nodes: placedNodes, links: graphData.links };

      // Save to cache (positions included so next load is pre-placed)
      await saveGraphData(fetchedMovies, placedGraph);

      // Update state
      setMovies(fetchedMovies);
      setGraphData(placedGraph);
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
