import { MovieGraph } from './MovieGraph';
import { FilterPanel } from './FilterPanel';
import { GenreLegend } from './GenreLegend';
import { MovieDetailsPanel } from './MovieDetailsPanel';
import { SearchBar } from './SearchBar';
import { LoadingScreen, ErrorScreen } from './LoadingScreen';
import { useMovieData } from '../hooks/useMovieData';
import { useGraphMode } from '../hooks/useGraphMode';

export const GraphScene = () => {
  const { isLoading, error, refreshData, progress } = useMovieData();
  const { is3DMode, isMobile, hasWebGL } = useGraphMode();

  // Show loading screen
  if (isLoading) {
    return <LoadingScreen message="Building movie network..." progress={progress} />;
  }

  // Show error screen
  if (error) {
    return <ErrorScreen message={error} onRetry={refreshData} />;
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      background: 'radial-gradient(ellipse at center, #0d0d15 0%, #050508 100%)',
      overflow: 'hidden',
    }}>
      {/* Animated background grid */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px',
        transform: 'perspective(500px) rotateX(60deg) translateY(-100px) scale(2)',
        transformOrigin: 'center top',
        opacity: 0.5,
        pointerEvents: 'none',
      }} />

      {/* Main graph */}
      <MovieGraph />

      {/* UI overlays */}
      <FilterPanel />
      <GenreLegend />
      <SearchBar />
      <MovieDetailsPanel />

      {/* Top bar with title and refresh */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        background: 'linear-gradient(to bottom, rgba(5, 5, 8, 0.9) 0%, transparent 100%)',
        pointerEvents: 'none',
        zIndex: 10,
      }}>
        {/* Title */}
        <div style={{
          pointerEvents: 'auto',
        }}>
          <h1 style={{
            fontSize: 24,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #00d4ff 0%, #8b5cf6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.5px',
            margin: 0,
          }}>
            CineVerse
          </h1>
          <p style={{
            fontSize: 12,
            color: 'rgba(255, 255, 255, 0.4)',
            margin: '4px 0 0 0',
            fontWeight: 400,
          }}>
            Interactive Movie Network
          </p>
        </div>

        {/* Refresh button */}
        <button
          onClick={refreshData}
          style={{
            pointerEvents: 'auto',
            padding: '10px 16px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: 13,
            color: 'rgba(255, 255, 255, 0.7)',
            cursor: 'pointer',
            transition: 'all 200ms ease',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.3)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
          title="Refresh data from API"
        >
          <svg 
            style={{ width: 16, height: 16 }} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      {/* Bottom status bar */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(to top, rgba(5, 5, 8, 0.9) 0%, transparent 100%)',
        pointerEvents: 'none',
        zIndex: 10,
      }}>
        {/* Mode indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 12,
          color: 'rgba(255, 255, 255, 0.5)',
          pointerEvents: 'auto',
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: is3DMode ? '#00d4ff' : '#22c55e',
            boxShadow: is3DMode ? '0 0 10px #00d4ff' : '0 0 10px #22c55e',
            animation: 'pulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontWeight: 500 }}>
            {is3DMode ? '3D Mode Active' : `2D Mode ${!hasWebGL ? '(WebGL Unavailable)' : isMobile ? '(Mobile Optimized)' : ''}`}
          </span>
        </div>

        {/* Help tooltip */}
        <div style={{
          fontSize: 12,
          color: 'rgba(255, 255, 255, 0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <kbd style={{
              padding: '2px 6px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: 4,
              fontSize: 10,
              fontFamily: 'inherit',
            }}>drag</kbd>
            <span>Rotate</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <kbd style={{
              padding: '2px 6px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: 4,
              fontSize: 10,
              fontFamily: 'inherit',
            }}>scroll</kbd>
            <span>Zoom</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <kbd style={{
              padding: '2px 6px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: 4,
              fontSize: 10,
              fontFamily: 'inherit',
            }}>click</kbd>
            <span>Details</span>
          </span>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
};
