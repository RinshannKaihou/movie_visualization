import { describe, it, expect, vi, afterEach } from 'vitest';
import { runLayoutInWorker } from './layoutClient';
import type { Movie, MovieEdge } from '../types';

// jsdom does not ship a Worker global. We stub it so the test verifies
// runLayoutInWorker's messaging contract, not real parallelism.
const originalWorker = (globalThis as { Worker?: unknown }).Worker;

afterEach(() => {
  (globalThis as { Worker?: unknown }).Worker = originalWorker;
});

describe('runLayoutInWorker', () => {
  it('posts movies+edges+options and resolves with positions', async () => {
    const postMessageSpy = vi.fn();

    class FakeWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: ErrorEvent) => void) | null = null;
      postMessage = (msg: unknown) => {
        postMessageSpy(msg);
        queueMicrotask(() => {
          this.onmessage?.({
            data: { positions: [[1, { x: 0, y: 0 }]] },
          } as MessageEvent);
        });
      };
      terminate() {}
    }
    (globalThis as { Worker?: unknown }).Worker = FakeWorker;

    const result = await runLayoutInWorker(
      [{ id: 1 } as Movie],
      [] as MovieEdge[],
      { seed: 1, iterations: 5 },
    );

    expect(result.get(1)).toEqual({ x: 0, y: 0 });
    expect(postMessageSpy).toHaveBeenCalledWith({
      movies: [{ id: 1 }],
      edges: [],
      options: { seed: 1, iterations: 5 },
    });
  });

  it('rejects if the worker posts an error', async () => {
    class FakeWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: ErrorEvent) => void) | null = null;
      postMessage = () => {
        queueMicrotask(() => {
          this.onerror?.({ message: 'boom' } as ErrorEvent);
        });
      };
      terminate() {}
    }
    (globalThis as { Worker?: unknown }).Worker = FakeWorker;

    await expect(
      runLayoutInWorker([], [], { seed: 1, iterations: 1 }),
    ).rejects.toBeDefined();
  });
});
