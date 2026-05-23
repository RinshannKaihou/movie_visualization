import type { Movie, GraphData } from '../types';

interface ExportedData {
  movies: Movie[];
  graphData: GraphData;
  timestamp: number;
  version: number;
}

/**
 * Load pre-built movie data from static JSON file
 * This allows deploying without requiring TMDB API key for users
 */
export const loadStaticData = async (): Promise<{
  movies: Movie[];
  graphData: GraphData;
} | null> => {
  try {
    // Try multiple possible paths for the static data
    const possiblePaths = [
      '/movie_visualization/data/movies.json',
      './data/movies.json',
      'data/movies.json',
    ];
    
    for (const path of possiblePaths) {
      try {
        const response = await fetch(path);

        if (response.ok) {
          const data: ExportedData = await response.json();

          // Positions are baked in at build time (see scripts/build-static-data.mjs
          // and CLAUDE.md's "Load priority" invariant). We pass nodes through
          // verbatim so ensurePositions doesn't waste a worker run on first paint.
          // Edges defensively unwrap legacy d3-mutated shapes — kept for backward
          // compat with older exports; safe to drop once all deployed JSON is v4.
          const cleanEdges = data.graphData.links.map(edge => ({
            source: typeof edge.source === 'number' ? edge.source : (edge.source as { id: number }).id,
            target: typeof edge.target === 'number' ? edge.target : (edge.target as { id: number }).id,
            types: edge.types,
            strength: edge.strength,
          }));

          const graphData: GraphData = {
            nodes: data.graphData.nodes,
            links: cleanEdges,
          };

          return {
            movies: data.movies,
            graphData,
          };
        }
      } catch {
        // Expected: most paths will 404.
      }
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Check if static data is available
 */
export const hasStaticData = async (): Promise<boolean> => {
  try {
    const response = await fetch('/movie_visualization/data/movies.json', { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
};
