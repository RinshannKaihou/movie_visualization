import { useState } from 'react';
import { useGraphStore } from '../stores/graphStore';

const Mark = () => (
  <div className="relative mb-7 size-16" aria-hidden>
    <div className="absolute inset-0 rounded-full border border-line" />
    <div className="absolute inset-0 animate-orbit">
      <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-aurora shadow-[0_0_14px_var(--color-aurora)]" />
    </div>
    <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-starlight shadow-[0_0_18px_var(--color-starlight)]" />
  </div>
);

/** Covers the app until the first WebGL frame, then fades away. */
export const LoadingVeil = () => {
  const ready = useGraphStore(s => s.sceneReady);
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      onTransitionEnd={() => ready && setGone(true)}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-void-0 transition-opacity duration-700 ${
        ready ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <Mark />
      <p className="display text-2xl text-starlight">CineVerse</p>
      <p className="eyebrow mt-3">Charting the catalog…</p>
    </div>
  );
};

export const ErrorScreen = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div role="alert" className="fixed inset-0 flex flex-col items-center justify-center bg-void-0 p-6 text-center">
    <Mark />
    <p className="display text-2xl text-starlight">The sky went dark</p>
    <p className="mt-3 max-w-md text-xs leading-relaxed text-ink-dim">{message}</p>
    <button
      type="button"
      onClick={onRetry}
      className="eyebrow mt-7 rounded border border-line px-4 py-2.5 text-ink transition-colors hover:border-aurora/50 hover:text-aurora"
    >
      Try again
    </button>
  </div>
);
