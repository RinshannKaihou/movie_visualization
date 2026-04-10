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

// -- star sprite cache ----------------------------------------------
// Pre-render each spectral color as an offscreen canvas ONCE.
// The hot render path then just calls `drawImage` on the cached
// bitmap — effectively a GPU blit, instead of allocating a new
// CanvasGradient object per node per frame (which was the main
// stutter source).
const STAR_SPRITE_SIZE = 192;           // bitmap resolution
const STAR_SPRITE_HALF = STAR_SPRITE_SIZE / 2;
const starSpriteCache = new Map<string, HTMLCanvasElement>();

const buildStarSprite = (hex: string): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = STAR_SPRITE_SIZE;
  canvas.height = STAR_SPRITE_SIZE;
  const ctx = canvas.getContext('2d')!;
  const cx = STAR_SPRITE_HALF;
  const cy = STAR_SPRITE_HALF;
  const maxR = STAR_SPRITE_HALF;

  // 1. Halo — radial gradient. Drawn ONCE per color, not per frame.
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
  gradient.addColorStop(0,    rgba(hex, 0.95));
  gradient.addColorStop(0.06, rgba(hex, 0.80));
  gradient.addColorStop(0.18, rgba(hex, 0.42));
  gradient.addColorStop(0.45, rgba(hex, 0.12));
  gradient.addColorStop(0.75, rgba(hex, 0.03));
  gradient.addColorStop(1,    rgba(hex, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, STAR_SPRITE_SIZE, STAR_SPRITE_SIZE);

  // 2. Diffraction spikes — baked into the sprite so every star gets
  //    the classic "telescope capture" look for zero per-frame cost.
  const rayLen = maxR * 0.82;
  ctx.strokeStyle = rgba(hex, 0.30);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - rayLen, cy);
  ctx.lineTo(cx + rayLen, cy);
  ctx.moveTo(cx, cy - rayLen);
  ctx.lineTo(cx, cy + rayLen);
  ctx.stroke();

  // Fainter 45° secondary spikes.
  const diag = rayLen * 0.50 * Math.SQRT1_2;
  ctx.strokeStyle = rgba(hex, 0.16);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(cx - diag, cy - diag);
  ctx.lineTo(cx + diag, cy + diag);
  ctx.moveTo(cx - diag, cy + diag);
  ctx.lineTo(cx + diag, cy - diag);
  ctx.stroke();

  // 3. Bright spectral core.
  ctx.fillStyle = toCoreColor(hex, 0.65);
  ctx.beginPath();
  ctx.arc(cx, cy, maxR * 0.09, 0, Math.PI * 2);
  ctx.fill();

  // 4. Warm white hotspot at the very center.
  ctx.fillStyle = 'rgba(255, 251, 230, 0.92)';
  ctx.beginPath();
  ctx.arc(cx, cy, maxR * 0.045, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
};

const getStarSprite = (hex: string): HTMLCanvasElement => {
  let sprite = starSpriteCache.get(hex);
  if (!sprite) {
    sprite = buildStarSprite(hex);
    starSpriteCache.set(hex, sprite);
  }
  return sprite;
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
  // Hot path — runs for every node every frame. Keep it as thin as
  // possible: look up the cached star sprite and drawImage it at the
  // right size. No gradients, no composite-mode switching, no extra
  // paths for non-focused nodes.
  const paintNode = useCallback((
    node: MovieNode,
    ctx: CanvasRenderingContext2D,
  ) => {
    if (node.x == null || node.y == null) return;

    const radius = getNodeRadius(node);
    const isFocused = selectedMovie?.id === node.id || hoveredNode?.id === node.id;

    // The sprite is sized so that the halo extends ~3x the core radius.
    const drawSize = radius * (isFocused ? 8 : 6);
    const half = drawSize * 0.5;
    const sprite = getStarSprite(getNodeColor(node.genres));
    ctx.drawImage(sprite, node.x - half, node.y - half, drawSize, drawSize);

    // Focused nodes get a tiny warm hotspot on top for extra pop.
    // This is a single arc fill — negligible cost.
    if (isFocused) {
      ctx.fillStyle = 'rgba(255, 251, 230, 0.95)';
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius * 0.35, 0, Math.PI * 2);
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
  // Hot path — solid stroke only. The previous version created a
  // CanvasLinearGradient per edge per frame which was the second
  // biggest allocation source after the radial gradients.
  const paintLink = useCallback((
    link: MovieEdge,
    ctx: CanvasRenderingContext2D,
  ) => {
    const src: any = link.source;
    const tgt: any = link.target;
    if (!src || !tgt || src.x == null || tgt.x == null) return;

    const strength = link.strength || 1;
    const baseAlpha = 0.16 + Math.min(strength - 1, 3) * 0.07;

    // Highlight edges touching the focused node.
    const focusedId = selectedMovie?.id ?? hoveredNode?.id;
    const isFocused = focusedId != null && (src.id === focusedId || tgt.id === focusedId);
    const alpha = isFocused ? Math.min(baseAlpha + 0.38, 0.9) : baseAlpha;
    const width = (0.55 + (strength - 1) * 0.35) * (isFocused ? 1.8 : 1);

    ctx.strokeStyle = rgba(getEdgeColor(link.types), alpha);
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.stroke();
  }, [selectedMovie, hoveredNode]);

  // -- particle config -------------------------------------------
  // Only the strongest connections get photons — keeps the moving
  // particle count manageable for the frame budget.
  const linkParticleCount = useCallback((link: MovieEdge) => {
    const strength = link.strength || 1;
    if (strength >= 3) return 2;
    if (strength >= 2) return 1;
    return 0;
  }, []);

  const linkParticleWidth = useCallback((link: MovieEdge) => {
    const strength = link.strength || 1;
    return 1.1 + (strength - 1) * 0.35;
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
          nodeCanvasObjectMode="replace"
          nodeCanvasObject={paintNode}
          nodePointerAreaPaint={paintPointerArea}
          linkCanvasObjectMode="replace"
          linkCanvasObject={paintLink}
          linkDirectionalParticles={linkParticleCount}
          linkDirectionalParticleSpeed={0.0045}
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
        />
      )}

      {/* Custom tooltip overlay */}
      <NodeTooltip node={hoveredNode} />
    </>
  );
};
