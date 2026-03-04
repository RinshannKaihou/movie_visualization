import { useGraphStore } from '../stores/graphStore';
import { useGraphFilters } from '../hooks/useGraphFilters';
import { GENRE_COLORS } from '../types';

export const MovieDetailsPanel = () => {
  const { selectedMovie, selectMovie } = useGraphStore();
  const { connectedMovieIds, filteredEdges } = useGraphFilters();

  if (!selectedMovie) {
    return (
      <div className="absolute bottom-4 right-4 z-10 bg-[#12121a]/90 backdrop-blur-sm rounded-lg p-4 border border-white/10 shadow-xl max-w-xs animate-fade-in">
        <div className="text-center text-white/50">
          <svg
            className="w-12 h-12 mx-auto mb-2 opacity-30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
            />
          </svg>
          <p className="text-sm">Click on a movie node to see details</p>
        </div>
      </div>
    );
  }

  // Count connections
  const connectionCount = connectedMovieIds.size;

  // Get connection breakdown
  const connectionBreakdown = {
    actor: 0,
    director: 0,
    genre: 0,
    plot: 0,
  };

  filteredEdges.forEach(edge => {
    if (edge.source === selectedMovie.id || edge.target === selectedMovie.id) {
      edge.types.forEach(type => {
        if (type === 'same_actor') connectionBreakdown.actor++;
        if (type === 'same_director') connectionBreakdown.director++;
        if (type === 'same_genre') connectionBreakdown.genre++;
        if (type === 'similar_plot') connectionBreakdown.plot++;
      });
    }
  });

  return (
    <div className="absolute bottom-4 right-4 z-10 bg-[#12121a]/95 backdrop-blur-sm rounded-lg border border-white/10 shadow-xl w-80 max-h-[calc(100vh-2rem)] overflow-hidden animate-fade-in">
      {/* Header with poster */}
      <div className="relative">
        {selectedMovie.poster && (
          <div className="h-32 overflow-hidden">
            <img
              src={selectedMovie.poster}
              alt={selectedMovie.title}
              className="w-full h-full object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#12121a]" />
          </div>
        )}

        {/* Close button */}
        <button
          onClick={() => selectMovie(null)}
          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white/70 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Title and year */}
        <div className="absolute bottom-2 left-4 right-4">
          <h2 className="text-lg font-bold text-white">{selectedMovie.title}</h2>
          <p className="text-sm text-white/60">{selectedMovie.year}</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 overflow-y-auto max-h-[400px]">
        {/* Rating */}
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="text-lg font-semibold text-white">{selectedMovie.rating.toFixed(1)}</span>
          <span className="text-sm text-white/50">/ 10</span>
        </div>

        {/* Genres */}
        <div>
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
            Genres
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {selectedMovie.genres.map(genre => (
              <span
                key={genre}
                className="px-2 py-0.5 text-xs font-medium rounded-full"
                style={{
                  backgroundColor: `${GENRE_COLORS[genre] || GENRE_COLORS.default}30`,
                  color: GENRE_COLORS[genre] || GENRE_COLORS.default,
                }}
              >
                {genre}
              </span>
            ))}
          </div>
        </div>

        {/* Directors */}
        {selectedMovie.directors.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">
              Director{selectedMovie.directors.length > 1 ? 's' : ''}
            </h3>
            <p className="text-sm text-white/80">{selectedMovie.directors.join(', ')}</p>
          </div>
        )}

        {/* Cast */}
        {selectedMovie.leadActors.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">
              Cast
            </h3>
            <p className="text-sm text-white/80">{selectedMovie.leadActors.slice(0, 4).join(', ')}</p>
          </div>
        )}

        {/* Overview */}
        {selectedMovie.overview && (
          <div>
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">
              Overview
            </h3>
            <p className="text-sm text-white/70 leading-relaxed line-clamp-4">
              {selectedMovie.overview}
            </p>
          </div>
        )}

        {/* Connection stats */}
        <div className="pt-3 border-t border-white/10">
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
            Connections ({connectionCount} movies)
          </h3>
          <div className="grid grid-cols-4 gap-2">
            <StatBadge label="Actor" count={connectionBreakdown.actor} color="#f97316" />
            <StatBadge label="Dir" count={connectionBreakdown.director} color="#3b82f6" />
            <StatBadge label="Genre" count={connectionBreakdown.genre} color="#22c55e" />
            <StatBadge label="Plot" count={connectionBreakdown.plot} color="#a855f7" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Small stat badge component
const StatBadge = ({ label, count, color }: { label: string; count: number; color: string }) => (
  <div className="text-center p-1.5 rounded bg-white/5">
    <div className="text-xs font-bold" style={{ color }}>{count}</div>
    <div className="text-[10px] text-white/40">{label}</div>
  </div>
);
