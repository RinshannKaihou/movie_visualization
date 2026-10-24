import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGraphStore } from '../stores/graphStore';
import { smallDataset, smallOverviews } from '../test/fixtures';
import { loadOverviews } from '../stores/loadDataset';
import { DATASET_VERSION } from '../core/dataset';
import { DetailsPanel } from './DetailsPanel';
import { SearchBox } from './SearchBox';
import { LegendPanel } from './LegendPanel';
import { DETAILS_TITLE_ID } from './layout';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const initial = useGraphStore.getState();
let container: HTMLDivElement;
let root: Root;

const render = async (element: React.ReactElement) => {
  await act(async () => root.render(element));
};

const typeInto = async (input: HTMLInputElement, text: string) => {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setValue.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(() => new Promise(r => setTimeout(r, 160))); // search debounce
};

beforeEach(() => {
  useGraphStore.setState(initial, true);
  useGraphStore.getState().setDataset(smallDataset());
  useGraphStore.getState().setOverviews(smallOverviews());
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('DetailsPanel', () => {
  it('renders nothing until a film is selected', async () => {
    await render(<DetailsPanel />);
    expect(container.innerHTML).toBe('');
  });

  it('explains each connection and navigates to it', async () => {
    await render(<DetailsPanel />);
    await act(async () => useGraphStore.getState().select(0));
    expect(container.querySelector('h2')?.textContent).toBe('Seven Samurai');
    const rows = [...container.querySelectorAll('ul.mt-2 > li')].map(li => li.textContent);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Yojimbo');
    expect(rows[0]).toContain('Dir. Akira Kurosawa');
    expect(rows[0]).toContain('Toshiro Mifune');
    expect(rows[0]).toContain('samurai');

    await act(async () => container.querySelector<HTMLButtonElement>('ul.mt-2 button')!.click());
    expect(useGraphStore.getState().selected).toBe(1);
  });

  it('shows the overview, with a placeholder until the deferred file arrives', async () => {
    useGraphStore.setState({ overviews: null });
    let release = () => {};
    const gate = new Promise<void>(resolve => (release = resolve));
    vi.stubGlobal('fetch', vi.fn(async () => {
      await gate;
      return new Response(JSON.stringify({ version: DATASET_VERSION, overviews: { 1: 'A village hires samurai.' } }));
    }));
    try {
      await render(<DetailsPanel />);
      await act(async () => useGraphStore.getState().select(0));
      expect(container.querySelector('[data-testid=overview-loading]')).not.toBeNull();

      await act(async () => {
        release();
        await loadOverviews();
      });
      expect(container.querySelector('[data-testid=overview-loading]')).toBeNull();
      expect(container.textContent).toContain('A village hires samurai.');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('closes on Escape', async () => {
    await render(<DetailsPanel />);
    await act(async () => useGraphStore.getState().select(0));
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(useGraphStore.getState().selected).toBeNull();
  });

  it('hides links filtered out by the legend', async () => {
    await render(<DetailsPanel />);
    await act(async () => {
      useGraphStore.getState().select(0);
      useGraphStore.getState().toggleConnection('director');
      useGraphStore.getState().toggleConnection('cast');
    });
    // Only the theme-tagged link to Yojimbo survives.
    expect(container.querySelectorAll('ul.mt-2 > li')).toHaveLength(1);
  });
});

describe('SearchBox', () => {
  it('lists matches, opens the active one on Enter, and moves focus to it', async () => {
    await render(<><SearchBox /><DetailsPanel /></>);
    const input = container.querySelector<HTMLInputElement>('input[role=combobox]')!;
    await act(async () => input.focus());
    await typeInto(input, 'kurosawa');
    const options = container.querySelectorAll('[role=option]');
    expect(options).toHaveLength(3);
    expect(input.getAttribute('aria-expanded')).toBe('true');

    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(useGraphStore.getState().selected).toBe(useGraphStore.getState().matches![0]);
    expect(document.activeElement?.id).toBe(DETAILS_TITLE_ID);
  });

  it('searches immediately when Enter beats the debounce', async () => {
    await render(<SearchBox />);
    const input = container.querySelector<HTMLInputElement>('input[role=combobox]')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      input.focus();
      setValue.call(input, 'yojimbo');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(useGraphStore.getState().selected).toBe(1);
  });

  it('says so when nothing matches', async () => {
    await render(<SearchBox />);
    const input = container.querySelector<HTMLInputElement>('input[role=combobox]')!;
    await act(async () => input.focus());
    await typeInto(input, 'zzzz');
    expect(container.textContent).toContain('No films match');
  });
});

describe('LegendPanel', () => {
  it('toggles a connection type', async () => {
    await render(<LegendPanel />);
    const header = container.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
    if (header.getAttribute('aria-expanded') === 'false') await act(async () => header.click());
    const cast = [...container.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find(b => b.textContent?.includes('Cast'))!;
    await act(async () => cast.click());
    expect(cast.getAttribute('aria-pressed')).toBe('false');
  });
});
