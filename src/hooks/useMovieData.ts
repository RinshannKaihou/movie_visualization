import { useEffect, useCallback, useState } from 'react';
import { useGraphStore } from '../stores/graphStore';
import { fetchMoviesWithDetails } from '../services/tmdb';
import { loadStaticData } from '../services/staticData';
import { buildGraphData } from '../services/graphBuilder';
import { runLayoutInWorker } from '../services/layoutClient';
import { saveGraphData, loadGraphData, clearCache } from '../utils/cache';
import type { Movie, GraphData } from '../types';

// Positions are required at render time: the runtime force simulation is
// frozen (see MovieGraph warmupTicks=0 / d3AlphaDecay=1), so nodes without
// x/y would render piled at the origin. Every load path must flow through
// this guard before calling setGraphData.
const ensurePositions = async (
  movies: Movie[],
  graphData: GraphData,
): Promise<GraphData> => {
  const allPlaced = graphData.nodes.length > 0
    && graphData.nodes.every(n => n.x != null && n.y != null);
  if (allPlaced) return graphData;

  const layoutStart = performance.now();
  const positions = await runLayoutInWorker(
    movies,
    graphData.links,
    { seed: 1, iterations: 300 },
  );
  console.log(`Layout done in ${(performance.now() - layoutStart).toFixed(0)}ms`);

  return {
    nodes: graphData.nodes.map(n => {
      const p = positions.get(n.id);
      return p ? { ...n, x: p.x, y: p.y } : n;
    }),
    links: graphData.links,
  };
};

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
    setLoading(true);
    setError(null);
    setProgress(undefined);
    setUsingStaticData(false);

    try {
      // Priority 1: Try static JSON file (for deployed version without API key)
      if (!forceRefresh) {
        const staticData = await loadStaticData();
        if (staticData) {
          const placed = await ensurePositions(staticData.movies, staticData.graphData);
          setMovies(staticData.movies);
          setGraphData(placed);
          setUsingStaticData(true);
          setLoading(false);
          return;
        }
      }

      // Priority 2: Try to load from IndexedDB cache
      if (!forceRefresh) {
        const cached = await loadGraphData();
        if (cached) {
          const placed = await ensurePositions(cached.movies, cached.graphData);
          setMovies(cached.movies);
          setGraphData(placed);
          setLoading(false);
          return;
        }
      }

      // Priority 3: Fetch from TMDB API (requires API key)
      setProgress({ loaded: 0, total: 2000 });

      const fetchedMovies = await fetchMoviesWithDetails(2000, (loaded, total) => {
        setProgress({ loaded, total });
      });

      // Build graph data (no positions yet — ensurePositions will run the worker)
      const graphData = buildGraphData(fetchedMovies);

      const placedGraph = await ensurePositions(fetchedMovies, graphData);

      // Save to cache (positions included so next load is pre-placed)
      await saveGraphData(fetchedMovies, placedGraph);

      // Update state
      setMovies(fetchedMovies);
      setGraphData(placedGraph);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load movie data';
      console.error('useMovieData: Error:', err);
      setError(message);
    } finally {
      setLoading(false);
      setProgress(undefined);
    }
  }, [setMovies, setGraphData, setLoading, setError]);

  // Refresh data (clear cache and fetch)
  const refreshData = useCallback(async () => {
    if (isLoading) return; // Guard against concurrent Resurveys (UI also disables)
    await clearCache();
    await loadData(true);
  }, [loadData, isLoading]);

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
    progress,
    usingStaticData,
    loadData,
    refreshData,
  };
};
