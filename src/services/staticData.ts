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
    const response = await fetch('/movie_visualization/data/movies.json');
    
    if (!response.ok) {
      console.log('Static data not found, will use API');
      return null;
    }
    
    const data: ExportedData = await response.json();
    
    console.log('Loaded static data:', {
      movies: data.movies.length,
      nodes: data.graphData.nodes.length,
      links: data.graphData.links.length,
      exportedAt: new Date(data.timestamp).toLocaleString(),
    });
    
    return {
      movies: data.movies,
      graphData: data.graphData,
    };
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
