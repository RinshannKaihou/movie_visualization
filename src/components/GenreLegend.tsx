import { useState } from 'react';
import { GENRE_COLORS } from '../types';

interface GenreItem {
  name: string;
  color: string;
  /** Astronomical classification analogy */
  spectralClass: string;
}

// Each genre is mapped to a real stellar spectral class to reinforce
// the observatory metaphor. The letter codes are ordered by surface
// temperature, hottest (O/B/A) to coolest (K/M) plus peculiar classes.
const MAIN_GENRES: GenreItem[] = [
  { name: 'Sci-Fi',      color: GENRE_COLORS['Sci-Fi'],      spectralClass: 'B' },
  { name: 'Mystery',     color: GENRE_COLORS['Mystery'],     spectralClass: 'A' },
  { name: 'Documentary', color: GENRE_COLORS['Documentary'], spectralClass: 'A' },
  { name: 'Comedy',      color: GENRE_COLORS['Comedy'],      spectralClass: 'F' },
  { name: 'Drama',       color: GENRE_COLORS['Drama'],       spectralClass: 'G' },
  { name: 'Adventure',   color: GENRE_COLORS['Adventure'],   spectralClass: 'K' },
  { name: 'Animation',   color: GENRE_COLORS['Animation'],   spectralClass: 'K' },
  { name: 'War',         color: GENRE_COLORS['War'],         spectralClass: 'K' },
  { name: 'Crime',       color: GENRE_COLORS['Crime'],       spectralClass: 'K' },
  { name: 'Romance',     color: GENRE_COLORS['Romance'],     spectralClass: 'M' },
  { name: 'Action',      color: GENRE_COLORS['Action'],      spectralClass: 'M' },
  { name: 'Horror',      color: GENRE_COLORS['Horror'],      spectralClass: 'C' },
  { name: 'Fantasy',     color: GENRE_COLORS['Fantasy'],     spectralClass: 'P' },
  { name: 'Thriller',    color: GENRE_COLORS['Thriller'],    spectralClass: 'P' },
];

export const GenreLegend = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div style={{
      position: 'absolute',
      top: 108,
      right: 28,
      zIndex: 10,
    }}>
      <div style={{
        backgroundColor: 'rgba(10, 11, 24, 0.82)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderRadius: 3,
        border: '1px solid rgba(255, 251, 230, 0.12)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 251, 230, 0.03), 0 0 40px rgba(165, 123, 255, 0.05)',
        overflow: 'hidden',
        width: isExpanded ? 230 : 'auto',
        transition: 'all 320ms cubic-bezier(0.4, 0, 0.2, 1)',
        fontFamily: 'var(--font-mono)',
      }}>
        {/* Header */}
        <div style={{
          padding: isExpanded ? '16px 16px 14px' : '12px',
          borderBottom: isExpanded ? '1px solid rgba(255, 251, 230, 0.1)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <div>
                <h3 style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  fontWeight: 500,
                  color: 'var(--ink)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.22em',
                  margin: 0,
                }}>
                  Spectra
                </h3>
                <p style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-ghost)',
                  margin: '4px 0 0 0',
                }}>
                  Stellar classification
                </p>
              </div>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                style={{
                  color: 'var(--ink-ghost)',
                  transform: 'rotate(180deg)',
                  transition: 'transform 200ms',
                }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}>
              <div style={{
                width: 30,
                height: 30,
                borderRadius: 2,
                backgroundColor: 'rgba(165, 123, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(165, 123, 255, 0.25)',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--spec-fantasy)" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--ink-dim)',
                letterSpacing: '0.1em',
              }}>
                SPEC
              </span>
            </div>
          )}
        </div>

        {/* Genre list */}
        {isExpanded && (
          <div style={{
            padding: '10px 12px 14px',
            maxHeight: 360,
            overflowY: 'auto',
          }}>
            {MAIN_GENRES.map((genre) => (
              <div
                key={genre.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '6px 4px',
                }}
              >
                {/* Spectral dot with halo */}
                <div style={{
                  position: 'relative',
                  width: 14,
                  height: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <div style={{
                    position: 'absolute',
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${genre.color}66 0%, transparent 70%)`,
                  }} />
                  <div style={{
                    position: 'relative',
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    backgroundColor: genre.color,
                    boxShadow: `0 0 6px ${genre.color}`,
                  }} />
                </div>
                {/* Spectral class code */}
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  color: 'var(--ink-ghost)',
                  letterSpacing: '0.1em',
                  width: 12,
                }}>
                  {genre.spectralClass}
                </span>
                {/* Genre name */}
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--ink)',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  flex: 1,
                }}>
                  {genre.name}
                </span>
              </div>
            ))}

            {/* Footer note */}
            <div style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px dashed rgba(255, 251, 230, 0.12)',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.1em',
              color: 'var(--ink-ghost)',
              lineHeight: 1.7,
            }}>
              <p style={{ margin: 0 }}>
                <span style={{ color: 'var(--aurora)' }}>›</span>{' '}
                <span style={{ color: 'var(--ink-dim)' }}>magnitude = rating</span>
              </p>
              <p style={{ margin: '4px 0 0 0' }}>
                <span style={{ color: 'var(--aurora)' }}>›</span>{' '}
                <span style={{ color: 'var(--ink-dim)' }}>focus = white core</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
