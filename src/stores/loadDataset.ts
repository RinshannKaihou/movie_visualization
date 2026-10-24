import datasetUrl from '../generated/dataset.json?url';
import { decodeDataset } from '../core/dataset';
import { useGraphStore } from './graphStore';

/**
 * Fetches and decodes the baked dataset into the store. `?url` gives the file
 * a content-hashed name in production builds, so a new deploy can never pair
 * fresh code with a stale cached dataset.
 */
let pending: Promise<void> | null = null;

export const loadDataset = (): Promise<void> => {
  pending ??= (async () => {
    useGraphStore.setState({ status: { phase: 'loading' } });
    try {
      const res = await fetch(datasetUrl);
      if (!res.ok) throw new Error(`The film catalog could not be downloaded (HTTP ${res.status}).`);
      useGraphStore.getState().setDataset(decodeDataset(await res.json()));
    } catch (err) {
      useGraphStore.getState().fail(err instanceof Error ? err.message : String(err));
    }
  })();
  return pending;
};
