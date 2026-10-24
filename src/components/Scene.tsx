import { useRef } from 'react';
import { StarfieldCanvas, type CanvasControls } from './StarfieldCanvas';
import { TopBar } from './TopBar';
import { LegendPanel } from './LegendPanel';
import { DetailsPanel } from './DetailsPanel';
import { BottomBar } from './BottomBar';

export const Scene = () => {
  const controlsRef = useRef<CanvasControls | null>(null);
  return (
    <main className="relative h-full w-full overflow-hidden bg-[radial-gradient(ellipse_at_50%_55%,#0c0e1f_0%,var(--color-void-0)_62%,#020309_100%)]">
      <StarfieldCanvas controlsRef={controlsRef} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgb(5_6_13/0.6)_100%)]"
      />
      <TopBar />
      <div className="absolute bottom-12 left-4 z-20 md:bottom-auto md:left-7 md:top-[132px]">
        <LegendPanel />
      </div>
      <DetailsPanel />
      <BottomBar controlsRef={controlsRef} />
    </main>
  );
};
