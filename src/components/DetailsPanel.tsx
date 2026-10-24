import { useEffect, useMemo, type CSSProperties } from 'react';
import { useGraphStore } from '../stores/graphStore';
import { loadOverviews } from '../stores/loadDataset';
import type { ConnectionType, Dataset } from '../core/types';
import { CONNECTION_BIT, CONNECTION_META, primaryType } from '../core/connections';
import { otherEnd, posterUrl, tmdbMovieUrl } from '../core/dataset';
import { FAMILY_BY_ID, genreLabel } from '../core/genres';
import { sharedAttributes, type SharedAttributes } from '../core/graph';
import { CloseIcon, ExternalIcon } from './icons';
import { DETAILS_TITLE_ID, DETAILS_WIDTH } from './layout';

interface Reason {
  type: ConnectionType;
  text: string;
}

const reasonsFor = (mask: number, shared: SharedAttributes): Reason[] => {
  const out: Reason[] = [];
  if (mask & CONNECTION_BIT.director && shared.directors.length) {
    out.push({ type: 'director', text: `Dir. ${shared.directors.join(', ')}` });
  }
  if (mask & CONNECTION_BIT.cast && shared.cast.length) {
    const extra = shared.cast.length - 2;
    out.push({ type: 'cast', text: shared.cast.slice(0, 2).join(', ') + (extra > 0 ? ` +${extra}` : '') });
  }
  if (mask & CONNECTION_BIT.theme && shared.keywords.length) {
    out.push({ type: 'theme', text: shared.keywords.slice(0, 3).join(' · ') });
  }
  if (out.length === 0 && shared.genres.length) {
    out.push({ type: 'genre', text: shared.genres.map(genreLabel).join(' / ') });
  }
  return out;
};

const connectionsOf = (dataset: Dataset, index: number, activeMask: number) => {
  const self = dataset.nodes[index];
  return dataset.adjacency[index]
    .map(ei => dataset.edges[ei])
    .filter(e => e.mask & activeMask)
    .sort((a, b) => b.weight - a.weight)
    .map(e => {
      const other = dataset.nodes[otherEnd(e, index)];
      const mask = e.mask & activeMask;
      return { node: other, weight: e.weight, mask, reasons: reasonsFor(mask, sharedAttributes(self, other)) };
    });
};

export const DetailsPanel = () => {
  const dataset = useGraphStore(s => s.dataset);
  const selected = useGraphStore(s => s.selected);
  const activeMask = useGraphStore(s => s.activeMask);
  const select = useGraphStore(s => s.select);
  const overviews = useGraphStore(s => s.overviews);

  // Usually prefetched after the first frame; this covers a film opened
  // before that. (Not on mount: the panel mounts with the scene, and an early
  // fetch would compete with the critical-path downloads.)
  useEffect(() => {
    if (selected != null && overviews == null) void loadOverviews();
  }, [selected, overviews]);

  const connections = useMemo(
    () => (dataset && selected != null ? connectionsOf(dataset, selected, activeMask) : []),
    [dataset, selected, activeMask],
  );

  useEffect(() => {
    if (selected == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, select]);

  if (!dataset || selected == null) return null;
  const movie = dataset.nodes[selected];
  const family = FAMILY_BY_ID.get(movie.family)!;
  const overview = overviews?.get(movie.id);

  return (
    // Keyed by film: each selection mounts fresh, scrolled to the top.
    <aside
      key={selected}
      aria-labelledby={DETAILS_TITLE_ID}
      style={{ '--details-width': `${DETAILS_WIDTH}px` } as CSSProperties}
      className="panel fixed inset-x-0 bottom-0 z-20 flex max-h-[58vh] animate-rise-in flex-col rounded-t-xl md:inset-x-auto md:bottom-14 md:right-4 md:top-[84px] md:max-h-none md:w-[var(--details-width)] md:animate-slide-in md:rounded-md"
    >
      <button
        type="button"
        onClick={() => select(null)}
        aria-label="Close details"
        className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full border border-line bg-void-0/60 text-ink-dim transition-colors hover:text-starlight"
      >
        <CloseIcon />
      </button>

      <div className="overflow-y-auto overscroll-contain p-5">
        <header className="flex gap-4 pr-8">
          <div className="h-[150px] w-[100px] shrink-0 overflow-hidden rounded-[3px] border border-line bg-void-2 max-md:h-[105px] max-md:w-[70px]">
            {movie.posterPath && <img src={posterUrl(movie.posterPath, 'w342')} alt={`${movie.title} poster`} className="size-full object-cover" />}
          </div>
          <div className="min-w-0 self-end">
            <p className="flex items-center gap-2 text-[10px] tracking-[0.14em] uppercase" style={{ color: family.color }}>
              <span className="size-1.5 rounded-full" style={{ background: family.color, boxShadow: `0 0 8px ${family.color}` }} />
              {family.label}
            </p>
            <h2 id={DETAILS_TITLE_ID} tabIndex={-1} className="display mt-2 text-[26px] leading-[1.08] text-starlight outline-none max-md:text-[22px]">
              {movie.title}
            </h2>
            <p className="mt-2.5 text-[11px] tracking-wider text-ink-dim">
              {movie.year || '—'} · <span className="text-ember">★ {movie.rating.toFixed(1)}</span>
            </p>
            {movie.directors.length > 0 && (
              <p className="mt-1 truncate text-[11px] text-ink-dim">Dir. {movie.directors.join(', ')}</p>
            )}
          </div>
        </header>

        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Genres">
          {movie.genres.map(g => (
            <li key={g} className="rounded-sm border border-line px-2 py-0.5 text-[10px] tracking-wider text-ink-dim">
              {genreLabel(g)}
            </li>
          ))}
        </ul>

        {overviews == null ? (
          <div aria-hidden data-testid="overview-loading" className="mt-4 space-y-2.5 py-1">
            <div className="h-2.5 w-full animate-pulse rounded-full bg-white/[0.07]" />
            <div className="h-2.5 w-11/12 animate-pulse rounded-full bg-white/[0.07]" />
            <div className="h-2.5 w-3/5 animate-pulse rounded-full bg-white/[0.07]" />
          </div>
        ) : (
          overview && <p className="mt-4 font-display text-[14.5px] leading-relaxed text-ink-dim">{overview}</p>
        )}

        {movie.cast.length > 0 && (
          <section className="mt-5">
            <h3 className="eyebrow">Cast</h3>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink">{movie.cast.slice(0, 6).join(' · ')}</p>
          </section>
        )}

        <section className="mt-6">
          <h3 className="eyebrow flex items-baseline justify-between">
            Connected films <span className="tabular-nums">{connections.length}</span>
          </h3>
          {connections.length === 0 ? (
            <p className="mt-2 text-[11px] text-ink-ghost">No links with the current filters.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {connections.map(({ node, weight, mask, reasons }) => (
                <li key={node.index}>
                  <button
                    type="button"
                    onClick={() => select(node.index)}
                    className="group flex w-full gap-3 rounded border-l-2 py-2 pl-2.5 pr-2 text-left transition-colors hover:bg-white/[0.045]"
                    style={{ borderLeftColor: `color-mix(in srgb, ${CONNECTION_META[primaryType(mask)].color} ${Math.round(30 + 70 * weight)}%, transparent)` }}
                  >
                    <div className="h-[54px] w-9 shrink-0 overflow-hidden rounded-[2px] bg-void-2">
                      {node.posterPath && <img src={posterUrl(node.posterPath, 'w92')} alt="" loading="lazy" className="size-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="display truncate text-[15px] text-starlight group-hover:text-aurora">{node.title}</p>
                      <p className="text-[10px] text-ink-ghost">{node.year || '—'} · ★ {node.rating.toFixed(1)}</p>
                      {reasons.map(r => (
                        <p key={r.type} className="mt-0.5 flex items-center gap-1.5 text-[10px] text-ink-dim">
                          <span className="size-1 shrink-0 rounded-full" style={{ background: CONNECTION_META[r.type].color }} />
                          <span className="truncate">{r.text}</span>
                        </p>
                      ))}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <a
          href={tmdbMovieUrl(movie.id)}
          target="_blank"
          rel="noreferrer"
          className="eyebrow mt-6 inline-flex items-center gap-1.5 text-ink-dim! transition-colors hover:text-aurora!"
        >
          View on TMDB <ExternalIcon width={11} height={11} />
        </a>
      </div>
    </aside>
  );
};
