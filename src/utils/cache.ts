import { openDB, type IDBPDatabase } from 'idb';
import type { Movie, GraphData } from '../types';

const DB_NAME = 'movie-network-viz';
// v4: positions are baked into cached graph data (Stage 1 of WebGL migration).
// Older v3 entries lack x/y and would render piled at the origin now that the
// runtime force simulation is frozen.
//
// Exported so the export button and the build script can write the same value
// — keep `scripts/build-static-data.mjs` in sync if this changes (the .mjs
// script can't import TS directly).
export const DB_VERSION = 4;

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
      return null;
    }

    // Check if cache is from the same version
    if (cached.version !== DB_VERSION) {
      return null;
    }

    // Check if cache is less than 7 days old (longer cache for large datasets)
    const cacheAge = Date.now() - cached.timestamp;
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    if (cacheAge > maxAge) {
      return null;
    }

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
