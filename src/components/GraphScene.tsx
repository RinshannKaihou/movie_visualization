import { StarfieldCanvas } from './StarfieldCanvas';
import { FilterPanel } from './FilterPanel';
import { GenreLegend } from './GenreLegend';
import { MovieDetailsPanel } from './MovieDetailsPanel';
import { SearchBar } from './SearchBar';
import { ExportDataButton } from './ExportDataButton';
import { LoadingScreen, ErrorScreen } from './LoadingScreen';
import { useMovieData } from '../hooks/useMovieData';

export const GraphScene = () => {
  const { isLoading, error, refreshData, progress, usingStaticData } = useMovieData();

  if (isLoading) {
    return (
      <LoadingScreen
        message={usingStaticData ? "Charting the sky..." : "Charting the sky..."}
        progress={progress}
        hint={usingStaticData ? "Resolving stellar catalog" : undefined}
      />
    );
  }

  if (error) {
    return <ErrorScreen message={error} onRetry={refreshData} />;
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      background: 'radial-gradient(ellipse at 50% 55%, #0a0b18 0%, #05060d 60%, #020309 100%)',
      overflow: 'hidden',
      fontFamily: 'var(--font-ui)',
    }}>
      {/* Background is a clean radial gradient + subtle static stars
          rendered by StarfieldCanvas. The old nebula/stardust effects
          have been removed for visual clarity. */}

      {/* ─── Main graph (stars & gossamer threads) ─── */}
      <StarfieldCanvas />

      {/* ─── Vignette for focus ─── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 45%, rgba(5, 6, 13, 0.65) 100%)',
        pointerEvents: 'none',
      }} />

      {/* ─── UI panels ─── */}
      <FilterPanel />
      <GenreLegend />
      <SearchBar />
      <MovieDetailsPanel />

      {/* ─── Top bar ─── */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '24px 28px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        background: 'linear-gradient(to bottom, rgba(5, 6, 13, 0.92) 0%, rgba(5, 6, 13, 0.4) 55%, transparent 100%)',
        pointerEvents: 'none',
        zIndex: 10,
      }}>
        <div style={{ pointerEvents: 'auto' }}>
          {/* Catalog mark above title — observatory instrument feel */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 6,
          }}>
            <span style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--aurora)',
              boxShadow: '0 0 10px var(--aurora)',
              animation: 'celestial-pulse 3s ease-in-out infinite',
            }} />
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--ink-ghost)',
            }}>
              CATALOG · N1
            </span>
          </div>

          {/* Title set in Fraunces display */}
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 38,
            fontWeight: 400,
            fontStyle: 'italic',
            fontOpticalSizing: 'auto',
            lineHeight: 1,
            letterSpacing: '-0.015em',
            color: 'var(--starlight)',
            margin: 0,
            textShadow: '0 0 24px rgba(255, 251, 230, 0.22), 0 0 60px rgba(165, 123, 255, 0.18)',
          }}>
            CineVerse
          </h1>

          {/* Subtitle in mono with em-dashes */}
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            fontWeight: 400,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ink-dim)',
            margin: '8px 0 0 0',
          }}>
            An observable cinema · charted by gravity
          </p>
        </div>

        {/* Action buttons */}
        <div style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
        }}>
          <ExportDataButton />

          <button
            onClick={refreshData}
            disabled={isLoading}
            style={{
              pointerEvents: 'auto',
              padding: '10px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              backgroundColor: 'rgba(255, 251, 230, 0.04)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              borderRadius: 2,
              border: '1px solid rgba(255, 251, 230, 0.15)',
              color: 'var(--ink)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.45 : 1,
              transition: 'all 250ms ease',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
            }}
            onMouseEnter={(e) => {
              if (isLoading) return;
              e.currentTarget.style.backgroundColor = 'rgba(124, 255, 212, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(124, 255, 212, 0.4)';
              e.currentTarget.style.boxShadow = '0 4px 24px rgba(0, 0, 0, 0.4), 0 0 18px rgba(124, 255, 212, 0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 251, 230, 0.04)';
              e.currentTarget.style.borderColor = 'rgba(255, 251, 230, 0.15)';
              e.currentTarget.style.boxShadow = '0 4px 24px rgba(0, 0, 0, 0.4)';
            }}
            title={isLoading ? 'Resurvey in progress...' : 'Refresh catalog'}
          >
            <svg
              style={{ width: 14, height: 14 }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Resurvey
          </button>
        </div>
      </div>

      {/* ─── Bottom status bar — "instrument readout" ─── */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '24px 28px 22px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        background: 'linear-gradient(to top, rgba(5, 6, 13, 0.92) 0%, rgba(5, 6, 13, 0.4) 55%, transparent 100%)',
        pointerEvents: 'none',
        zIndex: 10,
      }}>
        {/* Mode indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--ink-dim)',
          pointerEvents: 'auto',
        }}>
          <span style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: 'var(--aurora)',
            boxShadow: '0 0 12px var(--aurora)',
            animation: 'celestial-pulse 2.6s ease-in-out infinite',
          }} />
          <span>
            projection · celestial
          </span>
        </div>

        {/* Help tooltip — styled as telescope controls */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--ink-ghost)',
          display: 'flex',
          alignItems: 'center',
          gap: 22,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <kbd style={{
              padding: '3px 7px',
              border: '1px solid rgba(255, 251, 230, 0.2)',
              borderRadius: 2,
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              color: 'var(--ink)',
              background: 'rgba(255, 251, 230, 0.04)',
            }}>drag</kbd>
            <span>pan</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <kbd style={{
              padding: '3px 7px',
              border: '1px solid rgba(255, 251, 230, 0.2)',
              borderRadius: 2,
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              color: 'var(--ink)',
              background: 'rgba(255, 251, 230, 0.04)',
            }}>scroll</kbd>
            <span>zoom</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <kbd style={{
              padding: '3px 7px',
              border: '1px solid rgba(255, 251, 230, 0.2)',
              borderRadius: 2,
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              color: 'var(--ink)',
              background: 'rgba(255, 251, 230, 0.04)',
            }}>click</kbd>
            <span>observe</span>
          </span>
        </div>
      </div>
    </div>
  );
};
