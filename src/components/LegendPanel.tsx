import { useMemo, useState } from 'react';
import { useGraphStore } from '../stores/graphStore';
import { ALL_CONNECTIONS_MASK, CONNECTION_BIT, CONNECTION_META, CONNECTION_TYPES } from '../core/connections';
import { GENRE_FAMILIES } from '../core/genres';
import { isCompactViewport } from './layout';
import { ChevronIcon } from './icons';

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

export const LegendPanel = () => {
  const dataset = useGraphStore(s => s.dataset);
  const activeMask = useGraphStore(s => s.activeMask);
  const toggleConnection = useGraphStore(s => s.toggleConnection);
  const showAllConnections = useGraphStore(s => s.showAllConnections);
  // Open by default only where it does not crowd the map.
  const [open, setOpen] = useState(() => !isCompactViewport(window.innerWidth) && window.innerWidth >= 1100 && window.innerHeight >= 720);

  const counts = useMemo(() => {
    const edges = Object.fromEntries(CONNECTION_TYPES.map(t => [t, 0]));
    for (const e of dataset?.edges ?? []) {
      for (const t of CONNECTION_TYPES) if (e.mask & CONNECTION_BIT[t]) edges[t]++;
    }
    const families = new Map<string, number>();
    for (const n of dataset?.nodes ?? []) families.set(n.family, (families.get(n.family) ?? 0) + 1);
    return { edges, families };
  }, [dataset]);

  return (
    <section className="panel rounded-md w-60 overflow-hidden" aria-label="Legend and connection filters">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="eyebrow text-ink!">Legend</span>
        <ChevronIcon className={`text-ink-ghost transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="max-h-[calc(100dvh-260px)] animate-fade-in overflow-y-auto overscroll-contain border-t border-line px-2 pb-3 pt-2">
          <div className="flex items-baseline justify-between px-2 pb-1.5 pt-1">
            <h2 className="eyebrow">Connections</h2>
            {activeMask !== ALL_CONNECTIONS_MASK && (
              <button type="button" onClick={showAllConnections} className="text-[10px] tracking-wider text-aurora hover:underline">
                show all
              </button>
            )}
          </div>
          <ul>
            {CONNECTION_TYPES.map(type => {
              const meta = CONNECTION_META[type];
              const on = (activeMask & CONNECTION_BIT[type]) !== 0;
              return (
                <li key={type}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleConnection(type)}
                    className={`flex w-full items-center gap-3 rounded px-2 py-1.5 text-left transition-[opacity,background-color] hover:bg-white/[0.04] ${on ? '' : 'opacity-40'}`}
                  >
                    <span className="h-px w-4 shrink-0" style={{ background: meta.color, boxShadow: on ? `0 0 6px ${meta.color}` : 'none' }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] tracking-wider text-ink">{meta.label}</span>
                      <span className="block text-[10px] text-ink-ghost">{meta.description}</span>
                    </span>
                    <span className="text-[10px] tabular-nums text-ink-ghost">{compact.format(counts.edges[type])}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <h2 className="eyebrow px-2 pb-1.5 pt-4">Genres</h2>
          <ul className="px-2">
            {GENRE_FAMILIES.filter(f => counts.families.get(f.id)).map(f => (
              <li key={f.id} className="flex items-center gap-3 py-[3px]">
                <span className="size-2 shrink-0 rounded-full" style={{ background: f.color, boxShadow: `0 0 8px ${f.color}88` }} />
                <span className="flex-1 text-[11px] text-ink-dim">{f.label}</span>
                <span className="text-[10px] tabular-nums text-ink-ghost">{counts.families.get(f.id)}</span>
              </li>
            ))}
          </ul>
          <p className="mx-2 mt-3 border-t border-dashed border-line pt-2.5 text-[10px] leading-relaxed text-ink-ghost">
            Star size ∝ rating · links show each film’s closest relatives
          </p>
        </div>
      )}
    </section>
  );
};
