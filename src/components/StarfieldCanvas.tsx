import { useEffect, useRef, type RefObject } from 'react';
import { useGraphStore } from '../stores/graphStore';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { StarfieldRenderer } from '../render/StarfieldRenderer';
import { HoverCard, type HoverCardHandle } from './HoverCard';
import { sceneInsets } from './layout';

export interface CanvasControls {
  zoomBy: (factor: number) => void;
  resetView: () => void;
}

const describeFailure = (err: unknown) =>
  `Could not start WebGL, which the star map needs. ${err instanceof Error ? err.message : String(err)}`;

/**
 * Mounts the Pixi renderer (lazy chunk) and pipes store changes into it via
 * `subscribe`, so selection, search, filters, and hover update the scene
 * without React re-rendering this component.
 */
export const StarfieldCanvas = ({ controlsRef }: { controlsRef: RefObject<CanvasControls | null> }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HoverCardHandle>(null);
  const rendererRef = useRef<StarfieldRenderer | null>(null);
  const dataset = useGraphStore(s => s.dataset);
  const count = dataset?.nodes.length ?? 0;
  const reducedMotion = useReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !dataset) return;
    const store = useGraphStore;
    let disposed = false;
    let unsubscribe = () => {};

    import('../render/StarfieldRenderer')
      .then(({ StarfieldRenderer }) =>
        StarfieldRenderer.create(host, dataset, {
          reducedMotion: reducedMotionRef.current,
          getInsets: () => sceneInsets(window.innerWidth, window.innerHeight, store.getState().selected != null),
          onHover: (index, x, y) => {
            store.getState().hover(index);
            cardRef.current?.moveTo(x, y);
          },
          onSelect: index => store.getState().select(index),
        }),
      )
      .then(renderer => {
        if (disposed) {
          renderer.destroy();
          return;
        }
        rendererRef.current = renderer;
        controlsRef.current = renderer;
        const push = () => {
          const { selected, hovered, matches, activeMask } = store.getState();
          renderer.update({ selected, hovered, matches, activeMask });
        };
        push();
        unsubscribe = store.subscribe((s, prev) => {
          if (s.selected !== prev.selected || s.hovered !== prev.hovered || s.matches !== prev.matches || s.activeMask !== prev.activeMask) {
            push();
          }
        });
        store.getState().setSceneReady(true);
      })
      .catch((err: unknown) => {
        if (!disposed) store.getState().fail(describeFailure(err));
      });

    return () => {
      disposed = true;
      unsubscribe();
      rendererRef.current?.destroy();
      rendererRef.current = null;
      controlsRef.current = null;
    };
  }, [dataset, controlsRef]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    rendererRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  return (
    <>
      <div
        ref={hostRef}
        className="absolute inset-0 cursor-grab"
        role="img"
        aria-label={`Star map of ${count.toLocaleString('en')} films. Use the search box to find and open a film.`}
      />
      <HoverCard ref={cardRef} />
    </>
  );
};
