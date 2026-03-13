import { useMemo, useCallback } from 'react';
import { useGraphStore } from '../stores/graphStore';
import { useGraphFilters } from '../hooks/useGraphFilters';
import { GENRE_COLORS, CONNECTION_COLORS, type Movie, type ConnectionType } from '../types';

const CONNECTION_META: Record<ConnectionType, { label: string; icon: string; description: string }> = {
  same_actor: { label: 'Actor', icon: '🎭', description: 'Shared cast members' },
  same_director: { label: 'Director', icon: '🎬', description: 'Same director' },
  same_genre: { label: 'Genre', icon: '🏷️', description: 'Shared genres' },
  similar_plot: { label: 'Plot', icon: '📖', description: 'Similar storyline' },
};

export const MovieDetailsPanel = () => {
  const { selectedMovie, selectMovie, nodes } = useGraphStore();
  const { connectedMovieIds, connectedEdges } = useGraphFilters();

  // Group related movies by connection type
  const groupedConnections = useMemo<Record<ConnectionType, { movie: Movie; strength: number; allTypes: ConnectionType[] }[]>>(() => {
    console.log('Computing groupedConnections:', { 
      selectedMovieId: selectedMovie?.id, 
      connectedCount: connectedMovieIds.size,
      nodesCount: nodes.length 
    });
    
    if (!selectedMovie || connectedMovieIds.size === 0) {
      return { same_actor: [], same_director: [], same_genre: [], similar_plot: [] };
    }
    
    const movieMap = new Map(nodes.map(n => [n.id, n]));
    
    // Initialize groups
    const groups: Record<ConnectionType, { movie: Movie; strength: number; allTypes: ConnectionType[] }[]> = {
      same_actor: [],
      same_director: [],
      same_genre: [],
      similar_plot: [],
    };
    
    // For each connected movie, find all its connection types and add to appropriate groups
    Array.from(connectedMovieIds).forEach(movieId => {
      const movie = movieMap.get(movieId);
      if (!movie) return;
      
      // Find all connection types to this movie
      const connectionTypes: ConnectionType[] = [];
      connectedEdges.forEach(edge => {
        const otherId = edge.source === selectedMovie.id ? edge.target : 
                       edge.target === selectedMovie.id ? edge.source : null;
        if (otherId === movieId) {
          connectionTypes.push(...edge.types);
        }
      });
      
      // Remove duplicates and get unique connection types
      const uniqueTypes = Array.from(new Set(connectionTypes));
      const strength = uniqueTypes.length;
      
      // Add movie to each relevant group
      uniqueTypes.forEach(type => {
        groups[type].push({ movie, strength, allTypes: uniqueTypes });
      });
    });
    
    // Sort each group by strength (descending) then by rating
    (Object.keys(groups) as ConnectionType[]).forEach(type => {
      groups[type].sort((a, b) => {
        if (b.strength !== a.strength) return b.strength - a.strength;
        return b.movie.rating - a.movie.rating;
      });
    });
    
    return groups;
  }, [selectedMovie, connectedMovieIds, connectedEdges, nodes]);

  // Calculate total unique connections
  const totalConnections = connectedMovieIds.size;
  
  // Calculate counts per type
  const connectionCounts = useMemo(() => ({
    same_actor: groupedConnections.same_actor.length,
    same_director: groupedConnections.same_director.length,
    same_genre: groupedConnections.same_genre.length,
    similar_plot: groupedConnections.similar_plot.length,
  }), [groupedConnections]);

  // Handle clicking on a related movie
  const handleRelatedMovieClick = useCallback((movie: Movie) => {
    console.log('Clicked related movie:', movie.id, movie.title);
    selectMovie(movie);
  }, [selectMovie]);

  // NOW we can do conditional rendering after all hooks are called
  if (!selectedMovie) {
    return (
      <div style={{
        position: 'absolute',
        bottom: 80,
        right: 24,
        zIndex: 10,
        width: 280,
      }}>
        <div style={{
          backgroundColor: 'rgba(13, 13, 21, 0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          padding: 32,
          textAlign: 'center',
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 212, 255, 0.1)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg
              width="28"
              height="28"
              fill="none"
              viewBox="0 0 24 24"
              stroke="#00d4ff"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
              />
            </svg>
          </div>
          <p style={{
            fontSize: 14,
            color: 'rgba(255, 255, 255, 0.5)',
            margin: 0,
            lineHeight: 1.5,
          }}>
            Click on a movie node<br />to explore details
          </p>
        </div>
      </div>
    );
  }

  // Order of connection types to display
  const typeOrder: ConnectionType[] = ['same_actor', 'same_director', 'same_genre', 'similar_plot'];

  return (
    <div style={{
      position: 'absolute',
      top: 80,
      right: 24,
      zIndex: 10,
      width: 340,
      maxHeight: 'calc(100vh - 160px)',
    }}>
      <div style={{
        backgroundColor: 'rgba(13, 13, 21, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 20,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 212, 255, 0.05)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 160px)',
      }}>
        {/* Header with poster */}
        <div style={{
          position: 'relative',
          height: 160,
          overflow: 'hidden',
        }}>
          {selectedMovie.poster ? (
            <img
              src={selectedMovie.poster}
              alt={selectedMovie.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.4,
              }}
            />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
            }} />
          )}
          
          {/* Gradient overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, transparent 0%, rgba(13, 13, 21, 0.95) 100%)',
          }} />

          {/* Close button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              selectMovie(null);
            }}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 200ms',
              color: 'rgba(255, 255, 255, 0.7)',
              zIndex: 10,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
            }}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Title and year */}
          <div style={{
            position: 'absolute',
            bottom: 16,
            left: 20,
            right: 20,
          }}>
            <h2 style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#ffffff',
              margin: '0 0 4px 0',
              lineHeight: 1.2,
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
            }}>
              {selectedMovie.title}
            </h2>
            <p style={{
              fontSize: 14,
              color: 'rgba(255, 255, 255, 0.6)',
              margin: 0,
            }}>
              {selectedMovie.year}
            </p>
          </div>
        </div>

        {/* Content */}
        <div style={{
          padding: 20,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>
          {/* Rating */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            backgroundColor: 'rgba(251, 191, 36, 0.1)',
            borderRadius: 12,
            border: '1px solid rgba(251, 191, 36, 0.2)',
          }}>
            <svg width="24" height="24" fill="#fbbf24" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <div>
              <span style={{
                fontSize: 24,
                fontWeight: 700,
                color: '#fbbf24',
              }}>
                {selectedMovie.rating.toFixed(1)}
              </span>
              <span style={{
                fontSize: 14,
                color: 'rgba(255, 255, 255, 0.4)',
                marginLeft: 4,
              }}>
                / 10
              </span>
            </div>
          </div>

          {/* Genres */}
          <div>
            <h3 style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.4)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              margin: '0 0 10px 0',
            }}>
              Genres
            </h3>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
            }}>
              {selectedMovie.genres.map(genre => (
                <span
                  key={genre}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: 20,
                    backgroundColor: `${GENRE_COLORS[genre] || GENRE_COLORS.default}20`,
                    color: GENRE_COLORS[genre] || GENRE_COLORS.default,
                    border: `1px solid ${GENRE_COLORS[genre] || GENRE_COLORS.default}30`,
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
              <h3 style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                margin: '0 0 6px 0',
              }}>
                Director{selectedMovie.directors.length > 1 ? 's' : ''}
              </h3>
              <p style={{
                fontSize: 14,
                color: 'rgba(255, 255, 255, 0.85)',
                margin: 0,
                lineHeight: 1.5,
              }}>
                {selectedMovie.directors.join(', ')}
              </p>
            </div>
          )}

          {/* Cast */}
          {selectedMovie.leadActors.length > 0 && (
            <div>
              <h3 style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                margin: '0 0 6px 0',
              }}>
                Cast
              </h3>
              <p style={{
                fontSize: 14,
                color: 'rgba(255, 255, 255, 0.85)',
                margin: 0,
                lineHeight: 1.5,
              }}>
                {selectedMovie.leadActors.slice(0, 4).join(', ')}
              </p>
            </div>
          )}

          {/* Overview */}
          {selectedMovie.overview && (
            <div>
              <h3 style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                margin: '0 0 8px 0',
              }}>
                Overview
              </h3>
              <p style={{
                fontSize: 13,
                color: 'rgba(255, 255, 255, 0.7)',
                margin: 0,
                lineHeight: 1.7,
              }}>
                {selectedMovie.overview}
              </p>
            </div>
          )}

          {/* Connections - Combined header and grouped movies */}
          {totalConnections > 0 && (
            <div>
              {/* Section header with total */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}>
                <h3 style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  margin: 0,
                }}>
                  Connections
                </h3>
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.6)',
                  padding: '4px 10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                }}>
                  {totalConnections} movies
                </span>
              </div>

              {/* Grouped by connection type */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              }}>
                {typeOrder.map((type) => {
                  const movies = groupedConnections[type];
                  const count = connectionCounts[type];
                  if (count === 0) return null;

                  const meta = CONNECTION_META[type];
                  const color = CONNECTION_COLORS[type];

                  return (
                    <div key={type}>
                      {/* Connection type header */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 10,
                        padding: '8px 12px',
                        backgroundColor: `${color}15`,
                        borderRadius: 10,
                        border: `1px solid ${color}25`,
                      }}>
                        <span style={{ fontSize: 14 }}>{meta.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: color,
                            textTransform: 'capitalize',
                          }}>
                            {meta.label}
                          </div>
                          <div style={{
                            fontSize: 10,
                            color: 'rgba(255, 255, 255, 0.4)',
                          }}>
                            {meta.description}
                          </div>
                        </div>
                        <span style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: color,
                          padding: '2px 8px',
                          backgroundColor: `${color}20`,
                          borderRadius: 10,
                        }}>
                          {count}
                        </span>
                      </div>

                      {/* Movies for this connection type */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}>
                        {movies.map((item) => {
                  const { movie, allTypes } = item;
                  return (
                          <div
                            key={`${type}-${movie.id}`}
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              console.log('Related movie clicked:', movie.title);
                              e.stopPropagation();
                              handleRelatedMovieClick(movie);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation();
                                handleRelatedMovieClick(movie);
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '10px 12px',
                              backgroundColor: 'rgba(255, 255, 255, 0.03)',
                              borderRadius: 10,
                              border: '1px solid rgba(255, 255, 255, 0.06)',
                              cursor: 'pointer',
                              transition: 'all 200ms ease',
                              width: '100%',
                              position: 'relative',
                              zIndex: 20,
                              pointerEvents: 'auto',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                              e.currentTarget.style.borderColor = `${color}50`;
                              e.currentTarget.style.transform = 'translateX(4px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                              e.currentTarget.style.transform = 'translateX(0)';
                            }}
                          >
                            {/* Poster thumbnail */}
                            <div style={{
                              width: 36,
                              height: 50,
                              borderRadius: 5,
                              overflow: 'hidden',
                              flexShrink: 0,
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            }}>
                              {movie.poster ? (
                                <img
                                  src={movie.poster}
                                  alt={movie.title}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                  }}
                                />
                              ) : (
                                <div style={{
                                  width: '100%',
                                  height: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 16,
                                }}>
                                  🎬
                                </div>
                              )}
                            </div>

                            {/* Movie info */}
                            <div style={{
                              flex: 1,
                              minWidth: 0,
                            }}>
                              <div style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: 'rgba(255, 255, 255, 0.9)',
                                marginBottom: 2,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}>
                                {movie.title}
                              </div>
                              <div style={{
                                fontSize: 11,
                                color: 'rgba(255, 255, 255, 0.5)',
                              }}>
                                {movie.year} • ⭐ {movie.rating.toFixed(1)}
                              </div>
                              
                              {/* Show other connection types for this movie */}
                              {allTypes.length > 1 && (
                                <div style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 3,
                                  marginTop: 5,
                                }}>
                                  {allTypes.filter((t: ConnectionType) => t !== type).map((otherType: ConnectionType) => (
                                    <span
                                      key={otherType}
                                      style={{
                                        fontSize: 8,
                                        padding: '1px 4px',
                                        borderRadius: 3,
                                        backgroundColor: `${CONNECTION_COLORS[otherType]}15`,
                                        color: CONNECTION_COLORS[otherType],
                                        textTransform: 'capitalize',
                                      }}
                                    >
                                      {CONNECTION_META[otherType].label}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Arrow icon */}
                            <svg
                              width={14}
                              height={14}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke={color}
                              style={{
                                flexShrink: 0,
                                opacity: 0.6,
                              }}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
