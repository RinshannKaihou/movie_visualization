import { useImperativeHandle, useRef, type Ref } from 'react';
import { useGraphStore } from '../stores/graphStore';
import { posterUrl } from '../core/dataset';
import { FAMILY_BY_ID } from '../core/genres';

export interface HoverCardHandle {
  /** Follow the pointer without re-rendering React. */
  moveTo: (clientX: number, clientY: number) => void;
}

const OFFSET = 16;

export const HoverCard = ({ ref }: { ref: Ref<HoverCardHandle> }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const dataset = useGraphStore(s => s.dataset);
  const hovered = useGraphStore(s => s.hovered);
  const selected = useGraphStore(s => s.selected);

  const place = () => {
    const card = cardRef.current;
    if (!card) return;
    const { x, y } = pointer.current;
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const left = x + OFFSET + w > window.innerWidth ? x - OFFSET - w : x + OFFSET;
    const top = y + OFFSET + h > window.innerHeight ? y - OFFSET - h : y + OFFSET;
    card.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
  };

  useImperativeHandle(ref, () => ({
    moveTo: (x, y) => {
      pointer.current = { x, y };
      place();
    },
  }));

  // The selected film already has the details panel.
  const node = hovered != null && hovered !== selected ? dataset?.nodes[hovered] : undefined;
  if (!node) return null;
  const family = FAMILY_BY_ID.get(node.family)!;

  return (
    <div
      ref={el => {
        cardRef.current = el;
        if (el) place();
      }}
      className="panel rounded-md pointer-events-none fixed left-0 top-0 z-40 flex w-64 animate-fade-in gap-3 p-2.5"
      aria-hidden
    >
      <div className="h-[72px] w-12 shrink-0 overflow-hidden rounded-sm bg-void-2">
        {node.posterPath && <img src={posterUrl(node.posterPath, 'w92')} alt="" className="size-full object-cover" />}
      </div>
      <div className="min-w-0 self-center">
        <p className="display text-[15px] leading-tight text-starlight">{node.title}</p>
        <p className="mt-1.5 text-[10px] tracking-wider text-ink-dim">
          {node.year || '—'} · <span className="text-ember">★ {node.rating.toFixed(1)}</span>
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[10px] tracking-wider text-ink-ghost">
          <span className="size-1.5 rounded-full" style={{ background: family.color }} />
          {family.label}
        </p>
      </div>
    </div>
  );
};
