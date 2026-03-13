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

export const MovieGraph = () => {
  const [hoveredNode, setHoveredNode] = useState<MovieNode | null>(null);
  const nodes = useGraphStore(state => state.nodes);
  const selectMovie = useGraphStore(state => state.selectMovie);
  const selectedMovie = useGraphStore(state => state.selectedMovie);
  const { visibleEdges, visibleNodeIds } = useGraphFilters();
  const { is3DMode } = useGraphMode();

  // 使用原始数据引用，避免创建新对象
  const graphData = useMemo(() => {
    if (!visibleNodeIds || visibleNodeIds.size === nodes.length) {
      return { nodes, links: visibleEdges };
    }
    return {
      nodes: nodes.filter(node => visibleNodeIds.has(node.id)),
      links: visibleEdges,
    };
  }, [nodes, visibleEdges, visibleNodeIds]);

  // 缓存节点缩放计算
  const getNodeVal = useCallback((node: MovieNode) => {
    const baseSize = getNodeSize(node.rating);
    if (selectedMovie?.id === node.id) return baseSize * 2.2;
    if (hoveredNode?.id === node.id) return baseSize * 1.4;
    return baseSize;
  }, [selectedMovie, hoveredNode]);

  // 缓存节点颜色计算
  const getNodeColorMemo = useCallback((node: MovieNode) => {
    if (selectedMovie?.id === node.id || hoveredNode?.id === node.id) {
      return '#ffffff';
    }
    return getNodeColor(node.genres);
  }, [selectedMovie, hoveredNode]);

  // 缓存边颜色计算
  const getLinkColor = useCallback((link: MovieEdge) => {
    return getEdgeColor(link.types);
  }, []);

  // 缓存边宽度计算
  const getLinkWidth = useCallback((link: MovieEdge) => {
    return 0.8 + (link.strength - 1) * 0.35;
  }, []);

  // 缓存事件处理器
  const handleNodeClick = useCallback((node: MovieNode) => {
    selectMovie(node);
  }, [selectMovie]);

  const handleNodeHover = useCallback((node: MovieNode | null) => {
    setHoveredNode(node);
  }, []);

  console.log('MovieGraph rendering:', { 
    nodesCount: nodes.length, 
    edgesCount: visibleEdges.length, 
    is3DMode,
    graphDataNodes: graphData.nodes.length,
    graphDataLinks: graphData.links.length,
  });

  if (nodes.length === 0) {
    console.log('MovieGraph: No nodes, returning null');
    return null;
  }

  return (
    <>
      {is3DMode ? (
        <ForceGraph3D
          graphData={graphData}
          nodeId="id"
          linkSource="source"
          linkTarget="target"
          nodeLabel=""
          nodeColor={getNodeColorMemo}
          nodeVal={getNodeVal}
          linkColor={getLinkColor}
          linkWidth={getLinkWidth}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          backgroundColor="#0a0a0f"
          warmupTicks={8}
          cooldownTicks={8}
          cooldownTime={800}
          d3AlphaDecay={0.05}
          d3VelocityDecay={0.4}
          linkOpacity={0.28}
          nodeOpacity={1}
          forceEngine="d3"
          nodeResolution={4}
        />
      ) : (
        <ForceGraph2D
          graphData={graphData}
          nodeId="id"
          linkSource="source"
          linkTarget="target"
          nodeLabel=""
          nodeColor={getNodeColorMemo}
          nodeVal={getNodeVal}
          linkColor={getLinkColor}
          linkWidth={getLinkWidth}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          backgroundColor="#0a0a0f"
          warmupTicks={8}
          cooldownTicks={8}
          cooldownTime={800}
          d3AlphaDecay={0.05}
          d3VelocityDecay={0.4}
        />
      )}
      
      {/* Custom tooltip overlay */}
      <NodeTooltip node={hoveredNode} />

      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: `
          radial-gradient(ellipse at 20% 80%, rgba(0, 212, 255, 0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(139, 92, 246, 0.06) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, transparent 0%, rgba(0, 0, 0, 0.4) 100%)
        `,
      }} />
    </>
  );
};
