import { ErrorBoundary } from './components/ErrorBoundary';
import { Scene } from './components/Scene';
import { ErrorScreen, LoadingVeil } from './components/StatusScreens';
import { useGraphStore } from './stores/graphStore';

export default function App() {
  const status = useGraphStore(s => s.status);

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
