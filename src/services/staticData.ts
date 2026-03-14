import type { Movie, MovieNode, GraphData } from '../types';

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
      console.log(`Trying to load static data from: ${path}`);
      try {
        const response = await fetch(path);
        
        if (response.ok) {
          const data: ExportedData = await response.json();
          
          // Clean up nodes: remove any stale position/velocity data to ensure fresh simulation
          const cleanNodes = data.graphData.nodes.map(node => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { x, y, z, vx, vy, vz, ...cleanNode } = node;
            return cleanNode as MovieNode;
          });
          
          // Ensure edges use numeric IDs (in case they were mutated to objects)
          const cleanEdges = data.graphData.links.map(edge => ({
            source: typeof edge.source === 'number' ? edge.source : (edge.source as { id: number }).id,
            target: typeof edge.target === 'number' ? edge.target : (edge.target as { id: number }).id,
            types: edge.types,
            strength: edge.strength,
          }));
          
          const graphData: GraphData = {
            nodes: cleanNodes,
            links: cleanEdges,
          };
          
          console.log('Loaded static data:', {
            movies: data.movies.length,
            nodes: graphData.nodes.length,
            links: graphData.links.length,
            exportedAt: new Date(data.timestamp).toLocaleString(),
          });
          
          return {
            movies: data.movies,
            graphData,
          };
        }
      } catch (e) {
        console.log(`Failed to load from ${path}:`, e);
      }
    }
    
    console.log('Static data not found in any location, will use API');
    return null;
  } catch (error) {
    console.log('Failed to load static data:', error);
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
