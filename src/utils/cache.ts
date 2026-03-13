import { openDB, type IDBPDatabase } from 'idb';
import type { Movie, GraphData } from '../types';

const DB_NAME = 'movie-network-viz';
const DB_VERSION = 3; // Bumped to invalidate old cache with 100 movies

interface MovieCacheDB {
  movies: Movie[];
  graphData: GraphData;
  timestamp: number;
  version: number;
}

// Initialize the database
const initDB = async (): Promise<IDBPDatabase> => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create a store for cached data
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache');
      }
    },
  });
};

// Save graph data to IndexedDB
export const saveGraphData = async (
  movies: Movie[],
  graphData: GraphData
): Promise<void> => {
  try {
    const db = await initDB();
    const cacheData: MovieCacheDB = {
      movies,
      graphData,
      timestamp: Date.now(),
      version: DB_VERSION,
    };
    await db.put('cache', cacheData, 'graph-data');
    console.log('Graph data cached successfully');
  } catch (error) {
    console.error('Failed to cache graph data:', error);
  }
};

// Load graph data from IndexedDB
export const loadGraphData = async (): Promise<{
  movies: Movie[];
  graphData: GraphData;
} | null> => {
  try {
    const db = await initDB();
    const cached = await db.get('cache', 'graph-data') as MovieCacheDB | undefined;

    if (!cached) {
      console.log('No cached data found');
      return null;
    }

    // Check if cache is from the same version
    if (cached.version !== DB_VERSION) {
      console.log('Cache version mismatch, ignoring cached data');
      return null;
    }

    // Check if cache is less than 7 days old (longer cache for 1000 movies)
    const cacheAge = Date.now() - cached.timestamp;
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    if (cacheAge > maxAge) {
      console.log('Cache is too old, ignoring');
      return null;
    }

    console.log('Loaded cached graph data');
    return {
      movies: cached.movies,
      graphData: cached.graphData,
    };
  } catch (error) {
    console.error('Failed to load cached data:', error);
    return null;
  }
};

// Clear cached data
export const clearCache = async (): Promise<void> => {
  try {
    const db = await initDB();
    await db.delete('cache', 'graph-data');
    console.log('Cache cleared');
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
};

// Check if cache exists
export const hasCachedData = async (): Promise<boolean> => {
  try {
    const db = await initDB();
    const cached = await db.get('cache', 'graph-data');
    return !!cached;
  } catch {
    return false;
  }
};
