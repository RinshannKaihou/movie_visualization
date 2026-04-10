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
      const offsetX = 18;
      const offsetY = 18;

      let x = e.clientX + offsetX;
      let y = e.clientY + offsetY;

      if (x + 240 > window.innerWidth) {
        x = e.clientX - 256;
      }
      if (y + 340 > window.innerHeight) {
        y = e.clientY - 340;
      }

      setPosition({ x, y });
    };

    handleMouseMove(new MouseEvent('mousemove', {
      clientX: (node.x || 0) + window.innerWidth / 2,
      clientY: (node.y || 0) + window.innerHeight / 2,
    }));

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [node]);

  if (!isVisible || !node) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 1000,
        pointerEvents: 'none',
        animation: 'tooltipFadeIn 180ms cubic-bezier(0.2, 0.9, 0.3, 1)',
      }}
    >
      <div
        style={{
          background: 'rgba(10, 11, 24, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 3,
          border: '1px solid rgba(255, 251, 230, 0.14)',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 251, 230, 0.05), 0 0 40px rgba(124, 255, 212, 0.05)',
          padding: 14,
          width: 220,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Catalog-style top rule with mono ID */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--ink-ghost)',
        }}>
          <span>OBJ · {String(node.id).padStart(6, '0')}</span>
          <span style={{ color: 'var(--aurora)' }}>●</span>
        </div>

        {/* Poster */}
        <div
          style={{
            width: '100%',
            aspectRatio: '2/3',
            borderRadius: 2,
            overflow: 'hidden',
            marginBottom: 12,
            background: 'rgba(255, 251, 230, 0.03)',
            border: '1px solid rgba(255, 251, 230, 0.08)',
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
              filter: 'contrast(1.05) saturate(0.95)',
            }}
            loading="lazy"
          />
        </div>

        {/* Title in Fraunces */}
        <h3
          style={{
            margin: '0 0 8px 0',
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 500,
            fontStyle: 'italic',
            color: 'var(--starlight)',
            lineHeight: 1.15,
            letterSpacing: '-0.01em',
          }}
        >
          {node.title}
        </h3>

        {/* Year / rating row — mono for catalog feel */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.1em',
          }}
        >
          <span style={{ color: 'var(--ink-dim)' }}>
            {node.year}
          </span>
          <span style={{
            color: 'var(--ember)',
            fontWeight: 500,
          }}>
            ★ {node.rating.toFixed(1)} / 10
          </span>
        </div>

        {/* Genre chips */}
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
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                padding: '3px 7px',
                backgroundColor: 'rgba(255, 251, 230, 0.05)',
                border: '1px solid rgba(255, 251, 230, 0.12)',
                borderRadius: 2,
                color: 'var(--ink-dim)',
                whiteSpace: 'nowrap',
              }}
            >
              {genre}
            </span>
          ))}
        </div>

        {/* Director line */}
        {node.directors.length > 0 && (
          <div
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: '1px dashed rgba(255, 251, 230, 0.12)',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.08em',
              color: 'var(--ink-ghost)',
            }}
          >
            <span style={{ color: 'var(--aurora)' }}>dir ›</span>{' '}
            <span style={{ color: 'var(--ink-dim)' }}>
              {node.directors.slice(0, 2).join(' · ')}
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes tooltipFadeIn {
          from {
            opacity: 0;
            transform: translateY(6px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
};
