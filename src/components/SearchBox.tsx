import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { useGraphStore } from '../stores/graphStore';
import { posterUrl } from '../core/dataset';
import { FAMILY_BY_ID } from '../core/genres';
import { CloseIcon, SearchIcon } from './icons';
import { DETAILS_TITLE_ID } from './layout';

const VISIBLE_RESULTS = 8;
const DEBOUNCE_MS = 120;

const isTyping = (el: Element | null) =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable);

export const SearchBox = () => {
  const dataset = useGraphStore(s => s.dataset);
  const matches = useGraphStore(s => s.matches);
  const setQuery = useGraphStore(s => s.setQuery);
  const select = useGraphStore(s => s.select);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(text), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [text, setQuery]);

  // "/" or ⌘K / Ctrl+K focuses search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === '/' && !isTyping(document.activeElement)) || (e.key === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = (matches ?? []).slice(0, VISIBLE_RESULTS);
  const showPanel = open && matches != null;
  const showList = showPanel && results.length > 0;

  const choose = (index: number | undefined) => {
    if (index == null) return;
    // Commit the details panel now so keyboard focus can move to the film
    // that just opened (not deferred to a frame, which background tabs pause).
    flushSync(() => {
      select(index);
      setOpen(false);
    });
    const title = document.getElementById(DETAILS_TITLE_ID);
    if (title) title.focus();
    else inputRef.current?.blur();
  };

  const clear = () => {
    setText('');
    setQuery('');
    setActive(0);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive(a => (results.length ? (a + step + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (useGraphStore.getState().query !== text) {
        // Enter beat the debounce: search now instead of opening a stale hit.
        setQuery(text);
        choose(useGraphStore.getState().matches?.[0]);
      } else {
        choose(results[active] ?? results[0]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // do not also close the details panel
      if (text) clear();
      else inputRef.current?.blur();
    }
  };

  return (
    <div className="relative w-full">
      <div className="panel rounded-md flex items-center gap-2.5 px-3.5 transition-colors focus-within:border-aurora/40">
        <SearchIcon className="shrink-0 text-ink-ghost" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[active] != null ? `${listId}-${results[active]}` : undefined}
          aria-label="Search films, people, and themes"
          placeholder="Search films, people, themes…"
          spellCheck={false}
          autoComplete="off"
          value={text}
          onChange={e => {
            setText(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="h-11 min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-ghost"
        />
        {text ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="grid size-6 shrink-0 place-items-center rounded-full text-ink-ghost transition-colors hover:bg-white/10 hover:text-ink"
          >
            <CloseIcon width={12} height={12} />
          </button>
        ) : (
          <kbd className="hidden shrink-0 rounded-sm border border-line px-1.5 py-0.5 text-[10px] text-ink-ghost sm:block">/</kbd>
        )}
      </div>

      {showPanel && (
        <div className="panel rounded-md absolute inset-x-0 top-full mt-2 animate-rise-in overflow-hidden">
          {results.length === 0 ? (
            <p role="status" className="px-4 py-3.5 text-[11px] text-ink-dim">No films match “{text.trim()}”.</p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Search results" className="py-1.5">
              {results.map((index, i) => {
                const n = dataset!.nodes[index];
                return (
                  <li
                    key={index}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={e => e.preventDefault()} // keep focus until click
                    onClick={() => choose(index)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex cursor-pointer items-center gap-3 px-3 py-1.5 ${i === active ? 'bg-white/[0.06]' : ''}`}
                  >
                    <div className="h-10 w-7 shrink-0 overflow-hidden rounded-[2px] bg-void-2">
                      {n.posterPath && <img src={posterUrl(n.posterPath, 'w92')} alt="" loading="lazy" className="size-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="display truncate text-[15px] text-starlight">{n.title}</p>
                      <p className="truncate text-[10px] tracking-wide text-ink-dim">
                        {n.year || '—'} · {n.directors.slice(0, 2).join(', ') || 'Unknown director'}
                      </p>
                    </div>
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: FAMILY_BY_ID.get(n.family)!.color }} />
                  </li>
                );
              })}
            </ul>
          )}
          {matches.length > 0 && (
            <p className="eyebrow border-t border-line px-4 py-2 text-[9px]!">
              {matches.length > results.length ? `${results.length} of ${matches.length} · highlighted on the map` : 'Highlighted on the map'}
              <span className="hidden sm:inline"> · ↑↓ ↵</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
