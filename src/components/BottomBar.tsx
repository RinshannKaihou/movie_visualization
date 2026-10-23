import { useEffect, type ReactNode, type RefObject } from 'react';
import { useGraphStore } from '../stores/graphStore';
import type { CanvasControls } from './StarfieldCanvas';
import { FitIcon, MinusIcon, PlusIcon } from './icons';

const ZOOM_STEP = 1.6;
const monthYear = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' });

const Hint = ({ keys, label }: { keys: string; label: string }) => (
  <span className="flex items-center gap-1.5">
    <kbd className="rounded-sm border border-line bg-white/[0.03] px-1.5 py-px text-[9px] text-ink">{keys}</kbd>
    {label}
  </span>
);

const ToolButton = ({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className="grid size-9 place-items-center text-ink-dim transition-colors hover:bg-white/[0.05] hover:text-aurora"
  >
    {children}
  </button>
);

export const BottomBar = ({ controlsRef }: { controlsRef: RefObject<CanvasControls | null> }) => {
  const fetchedAt = useGraphStore(s => s.dataset?.fetchedAt);
  const date = fetchedAt ? monthYear.format(new Date(fetchedAt)) : null;

  // +/− and 0 work anywhere except while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (e.key === '+' || e.key === '=') controlsRef.current?.zoomBy(ZOOM_STEP);
      else if (e.key === '-' || e.key === '_') controlsRef.current?.zoomBy(1 / ZOOM_STEP);
      else if (e.key === '0') controlsRef.current?.resetView();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controlsRef]);

  return (
    <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-4 bg-gradient-to-t from-void-0/90 via-void-0/40 to-transparent px-4 pb-3 pt-10 md:px-7 md:pb-4">
      <div className="eyebrow pointer-events-auto hidden items-center gap-5 text-[9px]! lg:flex">
        <Hint keys="drag" label="pan" />
        <Hint keys="scroll" label="zoom" />
        <Hint keys="click" label="open" />
        <Hint keys="/" label="search" />
        <Hint keys="esc" label="close" />
      </div>
      <a
        href="https://www.themoviedb.org/"
        target="_blank"
        rel="noreferrer"
        className="eyebrow pointer-events-auto text-[9px]! transition-colors hover:text-ink-dim!"
        title="This product uses the TMDB API but is not endorsed or certified by TMDB."
      >
        Data · TMDB{date ? ` · ${date}` : ''}
      </a>
      <div className="panel pointer-events-auto hidden overflow-hidden rounded-md md:flex">
        <ToolButton label="Zoom in (+)" onClick={() => controlsRef.current?.zoomBy(ZOOM_STEP)}>
          <PlusIcon />
        </ToolButton>
        <ToolButton label="Zoom out (−)" onClick={() => controlsRef.current?.zoomBy(1 / ZOOM_STEP)}>
          <MinusIcon />
        </ToolButton>
        <ToolButton label="Fit all films (0)" onClick={() => controlsRef.current?.resetView()}>
          <FitIcon />
        </ToolButton>
      </div>
    </footer>
  );
};
