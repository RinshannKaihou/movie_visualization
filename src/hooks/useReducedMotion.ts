import { useEffect, useState } from 'react';

/**
 * React hook mirroring the OS-level `prefers-reduced-motion` media query.
 * Returns `true` when the user has asked for reduced motion, and updates
 * live if the preference changes mid-session.
 *
 * Gate all non-essential motion (twinkle, parallax, entrance fade-in,
 * camera tween) behind this flag. Pixi ticker callbacks that would run
 * animations should check and skip immediately so we pay no per-frame cost
 * for reduced-motion users.
 */
export const useReducedMotion = (): boolean => {
  const [prefers, setPrefers] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setPrefers(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return prefers;
};
