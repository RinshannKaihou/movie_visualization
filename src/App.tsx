import { useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Scene } from './components/Scene';
import { ErrorScreen, LoadingVeil } from './components/StatusScreens';
import { useGraphStore } from './stores/graphStore';
import { loadOverviews } from './stores/loadDataset';

export default function App() {
  const status = useGraphStore(s => s.status);
  const sceneReady = useGraphStore(s => s.sceneReady);

  // Overviews are only needed once a film is opened: fetch them after the
  // first frame instead of competing with the dataset for bandwidth.
  useEffect(() => {
    if (sceneReady) void loadOverviews();
  }, [sceneReady]);

  if (status.phase === 'error') {
    return <ErrorScreen message={status.message} onRetry={() => window.location.reload()} />;
  }
  return (
    <ErrorBoundary>
      {status.phase === 'ready' && <Scene />}
      <LoadingVeil />
    </ErrorBoundary>
  );
}
