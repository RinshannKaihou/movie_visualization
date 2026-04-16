/**
 * Main-thread client for the layout Web Worker.
 *
 * Spawns a dedicated worker, posts the layout request, and resolves
 * with positions. The worker is single-use: it terminates on success
 * or failure so we do not hold idle threads.
 */

import type { Movie, MovieEdge } from '../types';
import type { LayoutOptions, LayoutPositions } from './layout';

interface LayoutResponse {
  positions: [number, { x: number; y: number }][];
}

export const runLayoutInWorker = (
  movies: Movie[],
  edges: MovieEdge[],
  options: LayoutOptions,
): Promise<LayoutPositions> => {
  const worker = new Worker(
    new URL('../workers/layoutWorker.ts', import.meta.url),
    { type: 'module' },
  );

  return new Promise<LayoutPositions>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<LayoutResponse>) => {
      resolve(new Map(e.data.positions));
      worker.terminate();
    };
    worker.onerror = (err) => {
      reject(err);
      worker.terminate();
    };
    worker.postMessage({ movies, edges, options });
  });
};
