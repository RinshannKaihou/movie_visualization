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
    label: 'Cast',
    description: 'Shared ensemble',
    color: CONNECTION_COLORS.same_actor,
    icon: '◈',
  },
  {
    type: 'same_director',
    label: 'Auteur',
    description: 'Same director',
    color: CONNECTION_COLORS.same_director,
    icon: '◇',
  },
  {
    type: 'same_genre',
    label: 'Spectrum',
    description: 'Genre resonance',
    color: CONNECTION_COLORS.same_genre,
    icon: '◉',
  },
  {
    type: 'similar_plot',
    label: 'Theme',
    description: 'Narrative echo',
    color: CONNECTION_COLORS.similar_plot,
    icon: '◎',
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
      top: 108,
      left: 28,
      zIndex: 10,
    }}>
      {/* Main panel — observatory instrument card */}
      <div style={{
        backgroundColor: 'rgba(10, 11, 24, 0.82)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderRadius: 3,
        border: '1px solid rgba(255, 251, 230, 0.12)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 251, 230, 0.03), 0 0 40px rgba(124, 255, 212, 0.04)',
        overflow: 'hidden',
        width: isExpanded ? 250 : 'auto',
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
                  Gravitation
                </h3>
                <p style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-ghost)',
                  margin: '4px 0 0 0',
                }}>
                  {activeFilters.size} / 4 channels
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
                backgroundColor: 'rgba(124, 255, 212, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(124, 255, 212, 0.25)',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--aurora)" strokeWidth="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--ink-dim)',
                fontWeight: 500,
                letterSpacing: '0.1em',
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
                    borderRadius: 2,
                    border: '1px solid transparent',
                    backgroundColor: isActive ? 'rgba(255, 251, 230, 0.05)' : 'transparent',
                    borderColor: isActive ? `${option.color}35` : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 240ms ease',
                    marginBottom: 4,
                    opacity: isActive ? 1 : 0.55,
                    fontFamily: 'var(--font-mono)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 251, 230, 0.03)';
                      e.currentTarget.style.opacity = '0.85';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.opacity = '0.55';
                    }
                  }}
                >
                  {/* Glyph */}
                  <span style={{
                    fontSize: 14,
                    color: isActive ? option.color : 'var(--ink-ghost)',
                    textShadow: isActive ? `0 0 8px ${option.color}` : 'none',
                    transition: 'all 200ms',
                    width: 14,
                    textAlign: 'center',
                  }}>{option.icon}</span>

                  {/* Label & description */}
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      fontWeight: 500,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'var(--ink)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      {option.label}
                      <span style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        backgroundColor: option.color,
                        boxShadow: isActive ? `0 0 10px ${option.color}` : 'none',
                        transition: 'box-shadow 200ms',
                      }} />
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      letterSpacing: '0.08em',
                      color: 'var(--ink-ghost)',
                      marginTop: 3,
                    }}>
                      {option.description}
                    </div>
                  </div>

                  {/* Toggle — slim rail */}
                  <div style={{
                    width: 28,
                    height: 14,
                    borderRadius: 0,
                    backgroundColor: isActive ? `${option.color}30` : 'rgba(255, 251, 230, 0.08)',
                    border: isActive ? `1px solid ${option.color}60` : '1px solid rgba(255, 251, 230, 0.1)',
                    position: 'relative',
                    transition: 'all 200ms',
                  }}>
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: 0,
                      backgroundColor: isActive ? option.color : 'rgba(255, 251, 230, 0.45)',
                      position: 'absolute',
                      top: 2,
                      left: isActive ? 17 : 2,
                      transition: 'all 220ms cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: isActive ? `0 0 10px ${option.color}` : 'none',
                    }} />
                  </div>
                </button>
              );
            })}

            {/* Action buttons */}
            <div style={{
              display: 'flex',
              gap: 8,
              marginTop: 10,
              paddingTop: 12,
              borderTop: '1px dashed rgba(255, 251, 230, 0.1)',
            }}>
              <button
                onClick={setAllFilters}
                disabled={allActive}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  fontWeight: 500,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: allActive ? 'var(--ink-ghost)' : 'var(--ink)',
                  backgroundColor: allActive ? 'transparent' : 'rgba(255, 251, 230, 0.05)',
                  border: `1px solid ${allActive ? 'rgba(255, 251, 230, 0.08)' : 'rgba(255, 251, 230, 0.15)'}`,
                  borderRadius: 2,
                  cursor: allActive ? 'not-allowed' : 'pointer',
                  transition: 'all 200ms',
                }}
              >
                All on
              </button>
              <button
                onClick={clearAllFilters}
                disabled={noneActive}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  fontWeight: 500,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: noneActive ? 'var(--ink-ghost)' : 'var(--ink)',
                  backgroundColor: noneActive ? 'transparent' : 'rgba(255, 251, 230, 0.05)',
                  border: `1px solid ${noneActive ? 'rgba(255, 251, 230, 0.08)' : 'rgba(255, 251, 230, 0.15)'}`,
                  borderRadius: 2,
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
