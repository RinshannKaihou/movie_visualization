import { Container, Graphics } from 'pixi.js';
import type { Dataset, Edge } from '../core/types.ts';
import { CONNECTION_META, primaryType } from '../core/connections.ts';
import { hexToTintInt } from './textures.ts';

/**
 * The base edge layer is built once. Edges are partitioned by connection mask
 * and weight bucket, each partition a hairline Graphics stroked white, so
 * filter toggles and zoom LOD are just `visible` / `tint` flips — no
 * re-tessellation, however many edges there are.
 */

/** Lower weight bound of each bucket, strongest first. */
export const WEIGHT_BUCKETS = [0.55, 0.3, 0] as const;
const BUCKET_ALPHA = [0.42, 0.24, 0.12];

export const bucketOf = (weight: number): number => WEIGHT_BUCKETS.findIndex(min => weight >= min);

/**
 * Weakest bucket still drawn at zoom k (relative to the fit-to-screen zoom):
 * zoomed out, only strong links show; zoomed in, everything does.
 */
export const visibleBuckets = (relativeZoom: number): number =>
  relativeZoom < 1.4 ? 1 : 2;

/**
 * Quadratic control point bowing the edge sideways by a fraction of its
 * length; the side alternates so parallel edges fan out instead of stacking.
 */
export const curveControl = (edge: Edge, sx: number, sy: number, tx: number, ty: number) => {
  const bend = ((edge.source + edge.target) % 2 === 0 ? 1 : -1) * 0.12;
  return { cx: (sx + tx) / 2 - (ty - sy) * bend, cy: (sy + ty) / 2 + (tx - sx) * bend };
};

export const edgeColor = (mask: number): number => hexToTintInt(CONNECTION_META[primaryType(mask)].color);

export interface EdgeGroup {
  mask: number;
  bucket: number;
  graphics: Graphics;
}

export const buildEdgeLayer = (dataset: Dataset): { container: Container; groups: EdgeGroup[] } => {
  const { nodes, edges } = dataset;
  const byKey = new Map<string, Edge[]>();
  for (const e of edges) {
    const key = `${e.mask}:${bucketOf(e.weight)}`;
    const list = byKey.get(key);
    if (list) list.push(e);
    else byKey.set(key, [e]);
  }

  const container = new Container();
  const groups: EdgeGroup[] = [];
  for (const [key, list] of byKey) {
    const [mask, bucket] = key.split(':').map(Number);
    const g = new Graphics();
    for (const e of list) {
      const s = nodes[e.source];
      const t = nodes[e.target];
      const { cx, cy } = curveControl(e, s.x, s.y, t.x, t.y);
      g.moveTo(s.x, s.y).quadraticCurveTo(cx, cy, t.x, t.y);
    }
    g.stroke({ color: 0xffffff, alpha: BUCKET_ALPHA[bucket], pixelLine: true });
    g.tint = edgeColor(mask);
    container.addChild(g);
    groups.push({ mask, bucket, graphics: g });
  }
  return { container, groups };
};

/** Show groups that carry an active connection type and pass the LOD cut;
 *  color each by its strongest *active* type. */
export const applyEdgeVisibility = (groups: readonly EdgeGroup[], activeMask: number, maxBucket: number) => {
  for (const { mask, bucket, graphics } of groups) {
    const active = mask & activeMask;
    graphics.visible = active !== 0 && bucket <= maxBucket;
    if (active) graphics.tint = edgeColor(active);
  }
};
