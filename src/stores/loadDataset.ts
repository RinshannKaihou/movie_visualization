import datasetUrl from '../generated/dataset.json?url';
import overviewsUrl from '../generated/overviews.json?url';
import { decodeDataset, decodeOverviews } from '../core/dataset';
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

let overviewsPending: Promise<void> | null = null;

/**
 * Fetches film overviews, which are kept out of the dataset so the first
 * screen downloads a third less. Called once the map has rendered, and again
 * (a no-op by then) when a film is opened.
 */
export const loadOverviews = (): Promise<void> => {
  overviewsPending ??= (async () => {
    try {
      const res = await fetch(overviewsUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      useGraphStore.getState().setOverviews(decodeOverviews(await res.json()));
    } catch (err) {
      // Overviews are optional: the details panel simply goes without.
      console.error('Could not load film overviews:', err);
      useGraphStore.getState().setOverviews(new Map());
    }
  })();
  return overviewsPending;
};
