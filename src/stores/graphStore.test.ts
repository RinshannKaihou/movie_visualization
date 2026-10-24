import { beforeEach, describe, expect, it } from 'vitest';
import { useGraphStore } from './graphStore';
import { ALL_CONNECTIONS_MASK, CONNECTION_BIT } from '../core/connections';
import { smallDataset } from '../test/fixtures';

const initial = useGraphStore.getState();

describe('graphStore', () => {
  beforeEach(() => {
    useGraphStore.setState(initial, true);
    useGraphStore.getState().setDataset(smallDataset());
  });

  it('marks the app ready once a dataset arrives', () => {
    expect(useGraphStore.getState().status).toEqual({ phase: 'ready' });
  });

  it('derives ranked matches from the query', () => {
    const { setQuery } = useGraphStore.getState();
    setQuery('kurosawa');
    expect(useGraphStore.getState().matches).toHaveLength(3);
    setQuery('amelie');
    expect(useGraphStore.getState().matches).toEqual([3]);
    setQuery('');
    expect(useGraphStore.getState().matches).toBeNull();
  });

  it('toggles connection types as bits', () => {
    const { toggleConnection, showAllConnections } = useGraphStore.getState();
    toggleConnection('cast');
    expect(useGraphStore.getState().activeMask).toBe(ALL_CONNECTIONS_MASK & ~CONNECTION_BIT.cast);
    toggleConnection('cast');
    toggleConnection('genre');
    showAllConnections();
    expect(useGraphStore.getState().activeMask).toBe(ALL_CONNECTIONS_MASK);
  });

  it('does not notify subscribers when hover does not change', () => {
    let calls = 0;
    const unsubscribe = useGraphStore.subscribe(() => calls++);
    useGraphStore.getState().hover(1);
    useGraphStore.getState().hover(1);
    unsubscribe();
    expect(calls).toBe(1);
  });
});
