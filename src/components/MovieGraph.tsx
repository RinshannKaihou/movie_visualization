// @ts-ignore - types are incomplete
import ForceGraph2D from 'react-force-graph-2d';
// @ts-ignore - types are incomplete
import ForceGraph3D from 'react-force-graph-3d';
import { useMemo, useState, useCallback } from 'react';
import { getEdgeColor, getNodeColor, getNodeSize } from '../services/graphBuilder';
import { useGraphFilters } from '../hooks/useGraphFilters';
import { useGraphStore } from '../stores/graphStore';
import { useGraphMode } from '../hooks/useGraphMode';
import { NodeTooltip } from './NodeTooltip';
import type { MovieEdge, MovieNode } from '../types';

/**
 * Celestial Cinema — custom canvas rendering.
 *
 * Each movie is drawn as a *star* with:
 *   • a radial halo (large soft glow tinted to spectral class)
 *   • a bright near-white core (compressed energy)
 *   • subtle 4-point cross rays (telescope diffraction spikes)
 *
 * Each edge is drawn as a *gossamer thread* with a two-stop gradient
 * from source to target spectral color, plus a soft shadow blur for
 * luminous aura. Directional particles flow along the thread,
 * reading as photons traveling between stars.
 */

// -- color helpers ---------------------------------------------------
// Convert a #rrggbb hex to an rgba() string with the given alpha.
// Memoised by hex so we don't allocate strings on every frame.
const hexCache = new Map<string, [number, number, number]>();
const hexToRgb = (hex: string): [number, number, number] => {
  const cached = hexCache.get(hex);
  if (cached) return cached;
  const h = hex.replace('#', '');
  const full = h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  const tuple: [number, number, number] = [r, g, b];
  hexCache.set(hex, tuple);
  return tuple;
};

const rgba = (hex: string, alpha: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
};

// Blend a spectral color toward warm starlight for the core.
const STARLIGHT: [number, number, number] = [255, 251, 230];
const toCoreColor = (hex: string, mix = 0.7): string => {
  const [r, g, b] = hexToRgb(hex);
  const cr = Math.round(r + (STARLIGHT[0] - r) * mix);
  const cg = Math.round(g + (STARLIGHT[1] - g) * mix);
  const cb = Math.round(b + (STARLIGHT[2] - b) * mix);
  return `rgb(${cr},${cg},${cb})`;
};

export const MovieGraph = () => {
  const [hoveredNode, setHoveredNode] = useState<MovieNode | null>(null);
  const nodes = useGraphStore(state => state.nodes);
  const selectMovie = useGraphStore(state => state.selectMovie);
  const selectedMovie = useGraphStore(state => state.selectedMovie);
  const { visibleEdges, visibleNodeIds } = useGraphFilters();
  const { is3DMode } = useGraphMode();

  const graphData = useMemo(() => {
    if (!visibleNodeIds || visibleNodeIds.size === nodes.length) {
      return { nodes, links: visibleEdges };
    }
    return {
      nodes: nodes.filter(node => visibleNodeIds.has(node.id)),
      links: visibleEdges,
    };
  }, [nodes, visibleEdges, visibleNodeIds]);

  // Radius in graph units. When the node is selected/hovered we
  // widen the halo significantly so the star visually "blooms".
  const getNodeRadius = useCallback((node: MovieNode) => {
    const base = getNodeSize(node.rating);
    if (selectedMovie?.id === node.id) return base * 1.6;
    if (hoveredNode?.id === node.id) return base * 1.3;
    return base;
  }, [selectedMovie, hoveredNode]);

  // -- 2D custom rendering ----------------------------------------
  const paintNode = useCallback((
    node: MovieNode,
    ctx: CanvasRenderingContext2D,
    globalScale: number,
  ) => {
    if (node.x == null || node.y == null) return;

    const spectralColor = getNodeColor(node.genres);
    const radius = getNodeRadius(node);
    const isFocused = selectedMovie?.id === node.id || hoveredNode?.id === node.id;

    // 1. Halo — soft radial glow. Radius scales with rating.
    const haloRadius = radius * (isFocused ? 4.2 : 3.2);
    const gradient = ctx.createRadialGradient(
      node.x, node.y, 0,
      node.x, node.y, haloRadius,
    );
    gradient.addColorStop(0,    rgba(spectralColor, isFocused ? 0.95 : 0.85));
    gradient.addColorStop(0.25, rgba(spectralColor, isFocused ? 0.55 : 0.38));
    gradient.addColorStop(0.6,  rgba(spectralColor, 0.12));
    gradient.addColorStop(1,    rgba(spectralColor, 0));

    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(node.x, node.y, haloRadius, 0, Math.PI * 2);
    ctx.fill();

    // 2. Cross rays — telescope diffraction spikes.
    //    Only at reasonable zoom; skip when the sky is far away
    //    (globalScale < 0.6) to avoid shimmering artifacts.
    if (globalScale > 0.6) {
      const rayLen = radius * (isFocused ? 5.5 : 4.2);
      const rayAlpha = isFocused ? 0.55 : 0.32;
      ctx.strokeStyle = rgba(spectralColor, rayAlpha);
      ctx.lineWidth = Math.max(0.5, radius * 0.12);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(node.x - rayLen, node.y);
      ctx.lineTo(node.x + rayLen, node.y);
      ctx.moveTo(node.x, node.y - rayLen);
      ctx.lineTo(node.x, node.y + rayLen);
      ctx.stroke();

      // Subtle 45° spikes — half length, lower alpha.
      const diagLen = rayLen * 0.55;
      const diag = diagLen * Math.SQRT1_2;
      ctx.strokeStyle = rgba(spectralColor, rayAlpha * 0.55);
      ctx.lineWidth = Math.max(0.4, radius * 0.08);
      ctx.beginPath();
      ctx.moveTo(node.x - diag, node.y - diag);
      ctx.lineTo(node.x + diag, node.y + diag);
      ctx.moveTo(node.x - diag, node.y + diag);
      ctx.lineTo(node.x + diag, node.y - diag);
      ctx.stroke();
    }

    // 3. Bright core — small dense center that reads as "the star itself".
    const coreRadius = radius * (isFocused ? 0.8 : 0.55);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = toCoreColor(spectralColor, isFocused ? 0.85 : 0.65);
    ctx.beginPath();
    ctx.arc(node.x, node.y, coreRadius, 0, Math.PI * 2);
    ctx.fill();

    // 4. Inner white hotspot for focused stars — "we are looking at you".
    if (isFocused) {
      ctx.fillStyle = 'rgba(255, 251, 230, 0.95)';
      ctx.beginPath();
      ctx.arc(node.x, node.y, coreRadius * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [getNodeRadius, selectedMovie, hoveredNode]);

  // -- pointer hit-test region -----------------------------------
  // Crucial: without this, hover only works over the default circle
  // area. We paint the halo region as the hover target so users
  // can grab the visible glow.
  const paintPointerArea = useCallback((
    node: MovieNode,
    color: string,
    ctx: CanvasRenderingContext2D,
  ) => {
    if (node.x == null || node.y == null) return;
    const radius = getNodeRadius(node) * 2.2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }, [getNodeRadius]);

  // -- gossamer edge renderer ------------------------------------
  const paintLink = useCallback((
    link: MovieEdge,
    ctx: CanvasRenderingContext2D,
  ) => {
    // `source` / `target` become objects after the graph is initialized.
    const src: any = link.source;
    const tgt: any = link.target;
    if (!src || !tgt || src.x == null || tgt.x == null) return;

    const srcColor = getNodeColor(src.genres || []);
    const tgtColor = getNodeColor(tgt.genres || []);
    const edgeColor = getEdgeColor(link.types);

    const strength = link.strength || 1;
    const baseAlpha = 0.18 + Math.min(strength - 1, 3) * 0.08;

    // Highlight edges touching the selected/hovered node.
    const focusedId = selectedMovie?.id ?? hoveredNode?.id;
    const isFocused = focusedId != null && (src.id === focusedId || tgt.id === focusedId);
    const alpha = isFocused ? Math.min(baseAlpha + 0.35, 0.85) : baseAlpha;
    const width = (0.5 + (strength - 1) * 0.35) * (isFocused ? 1.8 : 1);

    // Linear gradient between spectral colors, tinted by edge type.
    const gradient = ctx.createLinearGradient(src.x, src.y, tgt.x, tgt.y);
    gradient.addColorStop(0,   rgba(srcColor, alpha * 0.9));
    gradient.addColorStop(0.5, rgba(edgeColor, alpha));
    gradient.addColorStop(1,   rgba(tgtColor, alpha * 0.9));

    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = gradient;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }, [selectedMovie, hoveredNode]);

  // -- particle config -------------------------------------------
  const linkParticleCount = useCallback((link: MovieEdge) => {
    // Stronger connections flow more photons.
    // Cap at 3 so the sky doesn't turn into a traffic jam.
    const strength = link.strength || 1;
    return Math.min(strength, 3);
  }, []);

  const linkParticleWidth = useCallback((link: MovieEdge) => {
    const strength = link.strength || 1;
    return 1.2 + (strength - 1) * 0.4;
  }, []);

  const linkParticleColor = useCallback((link: MovieEdge) => {
    return getEdgeColor(link.types);
  }, []);

  // -- 3D fallbacks -----------------------------------------------
  const getNodeVal = useCallback((node: MovieNode) => {
    const baseSize = getNodeSize(node.rating);
    if (selectedMovie?.id === node.id) return baseSize * 2.2;
    if (hoveredNode?.id === node.id) return baseSize * 1.4;
    return baseSize;
  }, [selectedMovie, hoveredNode]);

  const getNodeColor3D = useCallback((node: MovieNode) => {
    if (selectedMovie?.id === node.id || hoveredNode?.id === node.id) {
      return '#fffbe6';
    }
    return getNodeColor(node.genres);
  }, [selectedMovie, hoveredNode]);

  const getLinkColor3D = useCallback((link: MovieEdge) => getEdgeColor(link.types), []);
  const getLinkWidth3D = useCallback((link: MovieEdge) => 0.8 + (link.strength - 1) * 0.35, []);

  // -- interaction ------------------------------------------------
  const handleNodeClick = useCallback((node: MovieNode) => {
    selectMovie(node);
  }, [selectMovie]);

  const handleNodeHover = useCallback((node: MovieNode | null) => {
    setHoveredNode(node);
  }, []);

  if (nodes.length === 0) return null;

  return (
    <>
      {is3DMode ? (
        <ForceGraph3D
          graphData={graphData}
          nodeId="id"
          linkSource="source"
          linkTarget="target"
          nodeLabel=""
          nodeColor={getNodeColor3D}
          nodeVal={getNodeVal}
          linkColor={getLinkColor3D}
          linkWidth={getLinkWidth3D}
          linkDirectionalParticles={linkParticleCount}
          linkDirectionalParticleSpeed={0.004}
          linkDirectionalParticleWidth={linkParticleWidth}
          linkDirectionalParticleColor={linkParticleColor}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          backgroundColor="rgba(0,0,0,0)"
          warmupTicks={8}
          cooldownTicks={8}
          cooldownTime={800}
          d3AlphaDecay={0.05}
          d3VelocityDecay={0.4}
          linkOpacity={0.35}
          nodeOpacity={1}
          forceEngine="d3"
          nodeResolution={8}
        />
      ) : (
        <ForceGraph2D
          graphData={graphData}
          nodeId="id"
          linkSource="source"
          linkTarget="target"
          nodeLabel=""
          nodeCanvasObjectMode={() => 'replace'}
          nodeCanvasObject={paintNode}
          nodePointerAreaPaint={paintPointerArea}
          linkCanvasObjectMode={() => 'replace'}
          linkCanvasObject={paintLink}
          linkDirectionalParticles={linkParticleCount}
          linkDirectionalParticleSpeed={0.0045}
          linkDirectionalParticleWidth={linkParticleWidth}
          linkDirectionalParticleColor={linkParticleColor}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          backgroundColor="rgba(0,0,0,0)"
          warmupTicks={12}
          cooldownTicks={40}
          cooldownTime={1600}
          d3AlphaDecay={0.04}
          d3VelocityDecay={0.38}
        />
      )}

      {/* Custom tooltip overlay */}
      <NodeTooltip node={hoveredNode} />
    </>
  );
};
