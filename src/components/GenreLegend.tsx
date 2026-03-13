import { useState } from 'react';
import { GENRE_COLORS } from '../types';

interface GenreItem {
  name: string;
  color: string;
}

// Main genres to display (subset for cleaner UI)
const MAIN_GENRES: GenreItem[] = [
  { name: 'Action', color: GENRE_COLORS['Action'] },
  { name: 'Adventure', color: GENRE_COLORS['Adventure'] },
  { name: 'Animation', color: GENRE_COLORS['Animation'] },
  { name: 'Comedy', color: GENRE_COLORS['Comedy'] },
  { name: 'Crime', color: GENRE_COLORS['Crime'] },
  { name: 'Documentary', color: GENRE_COLORS['Documentary'] },
  { name: 'Drama', color: GENRE_COLORS['Drama'] },
  { name: 'Fantasy', color: GENRE_COLORS['Fantasy'] },
  { name: 'Horror', color: GENRE_COLORS['Horror'] },
  { name: 'Mystery', color: GENRE_COLORS['Mystery'] },
  { name: 'Romance', color: GENRE_COLORS['Romance'] },
  { name: 'Sci-Fi', color: GENRE_COLORS['Sci-Fi'] },
  { name: 'Thriller', color: GENRE_COLORS['Thriller'] },
  { name: 'War', color: GENRE_COLORS['War'] },
];

export const GenreLegend = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div style={{
      position: 'absolute',
      top: 80,
      right: 24,
      zIndex: 10,
    }}>
      {/* Main panel */}
      <div style={{
        backgroundColor: 'rgba(13, 13, 21, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 16,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(139, 92, 246, 0.05)',
        overflow: 'hidden',
        width: isExpanded ? 200 : 'auto',
        transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {/* Header */}
        <div style={{
          padding: isExpanded ? '16px 16px 12px' : '12px',
          borderBottom: isExpanded ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
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
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.9)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  margin: 0,
                }}>
                  Genres
                </h3>
                <p style={{
                  fontSize: 11,
                  color: 'rgba(255, 255, 255, 0.4)',
                  margin: '2px 0 0 0',
                }}>
                  Node colors
                </p>
              </div>
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                style={{ 
                  color: 'rgba(255, 255, 255, 0.4)',
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
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(139, 92, 246, 0.2)',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="4" />
                </svg>
              </div>
              <span style={{
                fontSize: 10,
                color: 'rgba(255, 255, 255, 0.5)',
                fontWeight: 500,
              }}>
                Genres
              </span>
            </div>
          )}
        </div>

        {/* Genre list */}
        {isExpanded && (
          <div style={{ 
            padding: '8px 12px 12px',
            maxHeight: 320,
            overflowY: 'auto',
          }}>
            {MAIN_GENRES.map((genre) => (
              <div
                key={genre.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 4px',
                  borderRadius: 8,
                }}
              >
                {/* Color dot */}
                <div style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: genre.color,
                  boxShadow: `0 0 8px ${genre.color}40`,
                  flexShrink: 0,
                }} />
                {/* Genre name */}
                <span style={{
                  fontSize: 12,
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontWeight: 500,
                }}>
                  {genre.name}
                </span>
              </div>
            ))}
            
            {/* Note about node size */}
            <div style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            }}>
              <p style={{
                fontSize: 11,
                color: 'rgba(255, 255, 255, 0.4)',
                margin: 0,
                lineHeight: 1.5,
              }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Size:</span> Rating
              </p>
              <p style={{
                fontSize: 11,
                color: 'rgba(255, 255, 255, 0.4)',
                margin: '4px 0 0 0',
                lineHeight: 1.5,
              }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>White:</span> Selected
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
