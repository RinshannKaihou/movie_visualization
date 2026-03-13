import { useEffect, useState } from 'react';
import type { MovieNode } from '../types';

interface NodeTooltipProps {
  node: MovieNode | null;
}

export const NodeTooltip = ({ node }: NodeTooltipProps) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!node) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);

    const handleMouseMove = (e: MouseEvent) => {
      // Position tooltip near the mouse but keep it on screen
      const offsetX = 15;
      const offsetY = 15;
      
      let x = e.clientX + offsetX;
      let y = e.clientY + offsetY;
      
      // Simple boundary check (tooltip is ~200px wide, ~280px tall)
      if (x + 220 > window.innerWidth) {
        x = e.clientX - 235;
      }
      if (y + 300 > window.innerHeight) {
        y = e.clientY - 300;
      }
      
      setPosition({ x, y });
    };

    // Initial position
    handleMouseMove(new MouseEvent('mousemove', {
      clientX: (node.x || 0) + window.innerWidth / 2,
      clientY: (node.y || 0) + window.innerHeight / 2,
    }));

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [node]);

  if (!isVisible || !node) return null;

  const formatRating = (rating: number) => {
    const stars = '★'.repeat(Math.round(rating / 2));
    return `${stars} ${rating.toFixed(1)}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 1000,
        pointerEvents: 'none',
        animation: 'tooltipFadeIn 150ms ease-out',
      }}
    >
      <div
        style={{
          background: 'rgba(15, 15, 25, 0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 212, 255, 0.1)',
          padding: 12,
          width: 200,
        }}
      >
        {/* Poster Image */}
        <div
          style={{
            width: '100%',
            aspectRatio: '2/3',
            borderRadius: 8,
            overflow: 'hidden',
            marginBottom: 10,
            background: 'rgba(0, 0, 0, 0.3)',
          }}
        >
          <img
            src={node.poster}
            alt={node.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
            loading="lazy"
          />
        </div>

        {/* Title */}
        <h3
          style={{
            margin: '0 0 6px 0',
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
            lineHeight: 1.3,
          }}
        >
          {node.title}
        </h3>

        {/* Year & Rating */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: 'rgba(255, 255, 255, 0.5)',
            }}
          >
            {node.year}
          </span>
          <span
            style={{
              fontSize: 12,
              color: '#fbbf24',
              fontWeight: 500,
            }}
          >
            {formatRating(node.rating)}
          </span>
        </div>

        {/* Genres */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
          }}
        >
          {node.genres.slice(0, 3).map((genre) => (
            <span
              key={genre}
              style={{
                fontSize: 10,
                padding: '3px 8px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 4,
                color: 'rgba(255, 255, 255, 0.7)',
                whiteSpace: 'nowrap',
              }}
            >
              {genre}
            </span>
          ))}
        </div>

        {/* Directors (if space permits) */}
        {node.directors.length > 0 && (
          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: 'rgba(255, 255, 255, 0.4)',
              }}
            >
              Dir: {node.directors.slice(0, 2).join(', ')}
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes tooltipFadeIn {
          from {
            opacity: 0;
            transform: translateY(5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};
