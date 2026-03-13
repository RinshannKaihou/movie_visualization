import { useState } from 'react';
import { useGraphFilters } from '../hooks/useGraphFilters';
import { CONNECTION_COLORS, type ConnectionType } from '../types';

interface FilterOption {
  type: ConnectionType;
  label: string;
  description: string;
  color: string;
  icon: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  {
    type: 'same_actor',
    label: 'Actor',
    description: 'Shared cast members',
    color: CONNECTION_COLORS.same_actor,
    icon: '🎭',
  },
  {
    type: 'same_director',
    label: 'Director',
    description: 'Same director',
    color: CONNECTION_COLORS.same_director,
    icon: '🎬',
  },
  {
    type: 'same_genre',
    label: 'Genre',
    description: 'Same category',
    color: CONNECTION_COLORS.same_genre,
    icon: '🏷️',
  },
  {
    type: 'similar_plot',
    label: 'Plot',
    description: 'Similar themes',
    color: CONNECTION_COLORS.similar_plot,
    icon: '📖',
  },
];

export const FilterPanel = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const {
    activeFilters,
    toggleFilter,
    setAllFilters,
    clearAllFilters,
    isFilterActive,
  } = useGraphFilters();

  const allActive = activeFilters.size === 4;
  const noneActive = activeFilters.size === 0;

  return (
    <div style={{
      position: 'absolute',
      top: 80,
      left: 24,
      zIndex: 10,
    }}>
      {/* Main panel */}
      <div style={{
        backgroundColor: 'rgba(13, 13, 21, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 16,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 212, 255, 0.05)',
        overflow: 'hidden',
        width: isExpanded ? 240 : 'auto',
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
                  Connections
                </h3>
                <p style={{
                  fontSize: 11,
                  color: 'rgba(255, 255, 255, 0.4)',
                  margin: '2px 0 0 0',
                }}>
                  {activeFilters.size} active
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
                backgroundColor: 'rgba(0, 212, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(0, 212, 255, 0.2)',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <span style={{
                fontSize: 10,
                color: 'rgba(255, 255, 255, 0.5)',
                fontWeight: 500,
              }}>
                {activeFilters.size}
              </span>
            </div>
          )}
        </div>

        {/* Filter options */}
        {isExpanded && (
          <div style={{ padding: 8 }}>
            {FILTER_OPTIONS.map((option) => {
              const isActive = isFilterActive(option.type);

              return (
                <button
                  key={option.type}
                  onClick={() => toggleFilter(option.type)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: 'none',
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 200ms ease',
                    marginBottom: 4,
                    opacity: isActive ? 1 : 0.6,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                      e.currentTarget.style.opacity = '0.8';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.opacity = '0.6';
                    }
                  }}
                >
                  {/* Icon */}
                  <span style={{ fontSize: 16 }}>{option.icon}</span>

                  {/* Label & description */}
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'rgba(255, 255, 255, 0.9)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      {option.label}
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: option.color,
                        boxShadow: isActive ? `0 0 8px ${option.color}` : 'none',
                        transition: 'box-shadow 200ms',
                      }} />
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: 'rgba(255, 255, 255, 0.4)',
                      marginTop: 1,
                    }}>
                      {option.description}
                    </div>
                  </div>

                  {/* Toggle switch */}
                  <div style={{
                    width: 36,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: isActive ? `${option.color}40` : 'rgba(255, 255, 255, 0.1)',
                    position: 'relative',
                    transition: 'background-color 200ms',
                  }}>
                    <div style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      backgroundColor: isActive ? option.color : 'rgba(255, 255, 255, 0.5)',
                      position: 'absolute',
                      top: 2,
                      left: isActive ? 18 : 2,
                      transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                    }} />
                  </div>
                </button>
              );
            })}

            {/* Action buttons */}
            <div style={{
              display: 'flex',
              gap: 8,
              marginTop: 8,
              paddingTop: 12,
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            }}>
              <button
                onClick={setAllFilters}
                disabled={allActive}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: 11,
                  fontWeight: 500,
                  color: allActive ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.7)',
                  backgroundColor: allActive ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: 8,
                  cursor: allActive ? 'not-allowed' : 'pointer',
                  transition: 'all 200ms',
                }}
              >
                Select All
              </button>
              <button
                onClick={clearAllFilters}
                disabled={noneActive}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: 11,
                  fontWeight: 500,
                  color: noneActive ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.7)',
                  backgroundColor: noneActive ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: 8,
                  cursor: noneActive ? 'not-allowed' : 'pointer',
                  transition: 'all 200ms',
                }}
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
