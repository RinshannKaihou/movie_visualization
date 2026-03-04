import { MovieGraph } from './MovieGraph';
import { FilterPanel } from './FilterPanel';
import { MovieDetailsPanel } from './MovieDetailsPanel';
import { SearchBar } from './SearchBar';
import { LoadingScreen, ErrorScreen } from './LoadingScreen';
import { useMovieData } from '../hooks/useMovieData';
import { useGraphMode } from '../hooks/useGraphMode';

export const GraphScene = () => {
  const { isLoading, error, refreshData } = useMovieData();
  const { is3DMode, isMobile } = useGraphMode();

  // Show loading screen
  if (isLoading) {
    return <LoadingScreen message="Building movie network..." />;
  }

  // Show error screen
  if (error) {
    return <ErrorScreen message={error} onRetry={refreshData} />;
  }

  return (
    <div className="relative w-full h-full graph-container">
      {/* Main graph */}
      <MovieGraph />

      {/* UI overlays */}
      <FilterPanel />
      <SearchBar />
      <MovieDetailsPanel />

      {/* Mode indicator */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="flex items-center gap-2 text-xs text-white/30">
          <span
            className={`w-2 h-2 rounded-full ${
              is3DMode ? 'bg-[#00d4ff]' : 'bg-yellow-500'
            }`}
          />
          <span>{is3DMode ? '3D Mode' : '2D Mode'}</span>
          {isMobile && <span className="text-white/20">• Mobile</span>}
        </div>
      </div>

      {/* Refresh button */}
      <button
        onClick={refreshData}
        className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 bg-[#12121a]/80 backdrop-blur-sm rounded-lg border border-white/10 text-xs text-white/50 hover:text-white/80 hover:border-white/20 transition-all"
        title="Refresh data from API"
      >
        <svg className="w-3.5 h-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        Refresh
      </button>

      {/* Help tooltip */}
      <div className="absolute bottom-4 right-4 z-10 text-xs text-white/20 hidden md:block">
        Drag to pan • Scroll to zoom • Click node for details
      </div>
    </div>
  );
};
