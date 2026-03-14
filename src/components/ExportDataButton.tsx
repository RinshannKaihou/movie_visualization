import { useState, useCallback } from 'react';
import { useGraphStore } from '../stores/graphStore';

export const ExportDataButton = () => {
  const [isExporting, setIsExporting] = useState(false);
  const movies = useGraphStore(state => state.movies);
  const nodes = useGraphStore(state => state.nodes);
  const edges = useGraphStore(state => state.edges);

  const handleExport = useCallback(async () => {
    if (movies.length === 0) {
      alert('No data to export. Please load the data first.');
      return;
    }

    setIsExporting(true);

    try {
      const exportData = {
        movies,
        graphData: {
          nodes,
          links: edges,
        },
        timestamp: Date.now(),
        version: 3,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'movies.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('Data exported:', {
        movies: movies.length,
        nodes: nodes.length,
        edges: edges.length,
      });
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. See console for details.');
    } finally {
      setIsExporting(false);
    }
  }, [movies, nodes, edges]);

  // Only show if we have data
  if (movies.length === 0) return null;

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      title="Export data for deployment"
      style={{
        pointerEvents: 'auto',
        padding: '8px 14px',
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 10,
        border: '1px solid rgba(139, 92, 246, 0.3)',
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.7)',
        cursor: 'pointer',
        transition: 'all 200ms ease',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        opacity: isExporting ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!isExporting) {
          e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.3)';
          e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.2)';
        e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <svg 
        style={{ width: 14, height: 14 }} 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      {isExporting ? 'Exporting...' : 'Export Data'}
    </button>
  );
};
