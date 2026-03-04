import { useCallback, useRef, useEffect, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import { useGraphStore } from '../stores/graphStore';
import { useGraphMode } from '../hooks/useGraphMode';
import { useGraphFilters } from '../hooks/useGraphFilters';
import { getNodeColor, getNodeSize, getEdgeColor } from '../services/graphBuilder';
import type { MovieNode, MovieEdge } from '../types';

// Extended interface for 3D links with line reference
interface ExtendedMovieEdge extends MovieEdge {
  __line?: THREE.Line;
}

export const MovieGraph = () => {
  const graphRef = useRef<any>(null);
  const { nodes, selectMovie, hoverMovie } = useGraphStore();
  const { is3DMode } = useGraphMode();
  const { filteredEdges, getNodeHighlight } = useGraphFilters();

  // Combine nodes with filtered edges for graph data
  const graphData = useMemo(() => ({
    nodes,
    links: filteredEdges,
  }), [nodes, filteredEdges]);

  // Set up force simulation on mount
  useEffect(() => {
    if (graphRef.current && nodes.length > 0) {
      // Configure force simulation
      const fg = graphRef.current;

      if (is3DMode) {
        // 3D forces
        fg.d3Force('link')?.distance(50);
        fg.d3Force('charge')?.strength(-100);
      } else {
        // 2D forces
        fg.d3Force('link')?.distance(80);
        fg.d3Force('charge')?.strength(-200);
        fg.d3Force('center');
      }

      // Initial zoom to fit
      fg.zoomToFit(400, 50);
    }
  }, [nodes.length, is3DMode]);

  // Node click handler
  const handleNodeClick = useCallback((node: MovieNode) => {
    selectMovie(node);
  }, [selectMovie]);

  // Node hover handler
  const handleNodeHover = useCallback((node: MovieNode | null) => {
    hoverMovie(node);
    document.body.style.cursor = node ? 'pointer' : 'default';
  }, [hoverMovie]);

  // 2D node canvas renderer
  const paint2DNode = useCallback((node: MovieNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const highlight = getNodeHighlight(node.id);
    const size = getNodeSize(node.rating);
    const color = getNodeColor(node.genres);

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, size, 0, 2 * Math.PI);
    ctx.fillStyle = highlight.isDimmed
      ? `${color}40` // Dimmed (40% opacity)
      : highlight.isSelected
        ? '#00d4ff'
        : color;
    ctx.fill();

    // Selection ring
    if (highlight.isSelected) {
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, size + 4, 0, 2 * Math.PI);
      ctx.strokeStyle = '#00d4ff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Glow effect for connected nodes
    if (highlight.isConnected && !highlight.isSelected) {
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, size + 3, 0, 2 * Math.PI);
      ctx.strokeStyle = `${color}80`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Label (only when zoomed in enough)
    if (globalScale > 0.8) {
      const label = node.title;
      const fontSize = Math.min(12 / globalScale, 12);
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = highlight.isDimmed ? '#ffffff40' : '#ffffff';
      ctx.fillText(label, node.x!, node.y! + size + fontSize);
    }
  }, [getNodeHighlight]);

  // 2D link canvas renderer
  const paint2DLink = useCallback((link: MovieEdge, ctx: CanvasRenderingContext2D) => {
    const source = link.source as unknown as MovieNode;
    const target = link.target as unknown as MovieNode;
    const color = getEdgeColor(link.types);
    const opacity = link.strength * 0.2 + 0.1; // 0.1 - 0.9 based on strength

    ctx.beginPath();
    ctx.moveTo(source.x!, source.y!);
    ctx.lineTo(target.x!, target.y!);
    ctx.strokeStyle = `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
    ctx.lineWidth = Math.min(link.strength * 0.5 + 0.5, 2);
    ctx.stroke();
  }, []);

  // 3D node object creator
  const create3DNode = useCallback((node: MovieNode) => {
    const highlight = getNodeHighlight(node.id);
    const size = getNodeSize(node.rating) * 0.5;
    const color = getNodeColor(node.genres);

    // Create sphere
    const geometry = new THREE.SphereGeometry(size, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: highlight.isSelected ? 0x00d4ff : new THREE.Color(color),
      transparent: true,
      opacity: highlight.isDimmed ? 0.3 : 0.9,
    });
    const sphere = new THREE.Mesh(geometry, material);

    // Add glow for selected/connected nodes
    if (highlight.isSelected || highlight.isConnected) {
      const glowGeometry = new THREE.SphereGeometry(size * 1.3, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: highlight.isSelected ? 0x00d4ff : new THREE.Color(color),
        transparent: true,
        opacity: 0.2,
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      sphere.add(glow);
    }

    // Add label sprite
    const sprite = new SpriteText(node.title);
    sprite.color = highlight.isDimmed ? 'rgba(255,255,255,0.4)' : '#ffffff';
    sprite.textHeight = 4;
    sprite.position.y = size + 4;
    sphere.add(sprite);

    return sphere;
  }, [getNodeHighlight]);

  // 3D link object creator
  const create3DLink = useCallback((link: MovieEdge) => {
    const color = getEdgeColor(link.types);
    const opacity = link.strength * 0.15 + 0.1;

    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity,
      linewidth: link.strength,
    });

    const geometry = new THREE.BufferGeometry();
    return new THREE.Line(geometry, material);
  }, []);

  // 3D link position update handler
  const handle3DLinkPositionUpdate = useCallback(
    (link: ExtendedMovieEdge, { start, end }: { start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } }) => {
      if (link.__line) {
        const positions = new Float32Array([
          start.x, start.y, start.z,
          end.x, end.y, end.z,
        ]);
        link.__line.geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(positions, 3)
        );
      }
    },
    []
  );

  if (nodes.length === 0) {
    return null;
  }

  // Render 3D or 2D based on device capability
  if (is3DMode) {
    return (
      <ForceGraph3D
        ref={graphRef}
        graphData={graphData}
        nodeId="id"
        linkSource="source"
        linkTarget="target"
        nodeThreeObject={create3DNode}
        linkThreeObject={create3DLink}
        linkPositionUpdate={handle3DLinkPositionUpdate}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        backgroundColor="#0a0a0f"
        enableNavigationControls={true}
        enableNodeDrag={true}
      />
    );
  }

  return (
    <ForceGraph2D
      ref={graphRef}
      graphData={graphData}
      nodeId="id"
      linkSource="source"
      linkTarget="target"
      nodeCanvasObject={paint2DNode}
      linkCanvasObject={paint2DLink}
      onNodeClick={handleNodeClick}
      onNodeHover={handleNodeHover}
      backgroundColor="#0a0a0f"
      enableZoomInteraction={true}
      enablePanInteraction={true}
      enableNodeDrag={true}
      cooldownTicks={100}
      onEngineStop={() => {
        graphRef.current?.zoomToFit(400, 50);
      }}
    />
  );
};
