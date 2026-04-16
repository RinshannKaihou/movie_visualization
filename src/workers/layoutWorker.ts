/**
 * Web Worker entry for force-directed layout.
 *
 * Receives `{ movies, edges, options }` via `postMessage`, runs d3-force
 * off the main thread, and replies with positions as entries array
 * (more broadly structured-cloneable than a Map).
 */

import { computeLayout } from '../services/layout';
import type { LayoutOptions } from '../services/layout';
import type { Movie, MovieEdge } from '../types';

interface LayoutRequest {
  movies: Movie[];
  edges: MovieEdge[];
  options: LayoutOptions;
}

self.onmessage = (e: MessageEvent<LayoutRequest>) => {
  const { movies, edges, options } = e.data;
  const positions = computeLayout(movies, edges, options);
  self.postMessage({ positions: Array.from(positions.entries()) });
};
