import { create } from 'zustand';
import type { ConnectionType, Dataset } from '../core/types';
import { ALL_CONNECTIONS_MASK, CONNECTION_BIT } from '../core/connections';
import { buildSearchIndex, type SearchIndex } from '../core/search';

/**
 * App state. Movies are referenced by node index (position in
 * dataset.nodes) everywhere; TMDB ids only matter for outbound links.
 *
 * Components subscribe with narrow selectors (`useGraphStore(s => s.selected)`)
 * so a hover never re-renders the details panel, and the canvas reads the
 * store through `subscribe` without re-rendering React at all.
 */

export type LoadStatus =
  | { phase: 'loading' }
  | { phase: 'ready' }
  | { phase: 'error'; message: string };

interface GraphState {
  dataset: Dataset | null;
  /** Built lazily on the first query. */
  searchIndex: SearchIndex | null;
  status: LoadStatus;
  /** True once the WebGL scene has drawn its first frame. */
  sceneReady: boolean;
  /** TMDB id → overview; null until the deferred file arrives. */
  overviews: Map<number, string> | null;

  selected: number | null;
  hovered: number | null;
  activeMask: number;
  query: string;
  /** Ranked search results for `query`; null when there is no query. */
  matches: number[] | null;

  setDataset: (dataset: Dataset) => void;
  fail: (message: string) => void;
  setSceneReady: (ready: boolean) => void;
  setOverviews: (overviews: Map<number, string>) => void;
  select: (index: number | null) => void;
  hover: (index: number | null) => void;
  toggleConnection: (type: ConnectionType) => void;
  showAllConnections: () => void;
  setQuery: (query: string) => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  dataset: null,
  searchIndex: null,
  status: { phase: 'loading' },
  sceneReady: false,
  overviews: null,
  selected: null,
  hovered: null,
  activeMask: ALL_CONNECTIONS_MASK,
  query: '',
  matches: null,

  setDataset: dataset => set({ dataset, searchIndex: null, status: { phase: 'ready' } }),

  fail: message => set({ status: { phase: 'error', message } }),

  setSceneReady: sceneReady => set({ sceneReady }),

  setOverviews: overviews => set({ overviews }),

  select: selected => set({ selected }),

  hover: hovered => {
    if (get().hovered !== hovered) set({ hovered });
  },

  toggleConnection: type => set(s => ({ activeMask: s.activeMask ^ CONNECTION_BIT[type] })),

  showAllConnections: () => set({ activeMask: ALL_CONNECTIONS_MASK }),

  // The index (~20 ms to build) is created on the first query, keeping it
  // off the path to first paint.
  setQuery: query => {
    const { dataset } = get();
    if (!dataset || query === get().query) return;
    const searchIndex = get().searchIndex ?? buildSearchIndex(dataset.nodes);
    set({ query, searchIndex, matches: searchIndex.search(query) });
  },
}));
