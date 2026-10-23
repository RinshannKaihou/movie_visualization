/**
 * Renders a static PNG of a dataset's layout with node-canvas, approximating
 * the in-app look. A tuning aid for graph/layout parameters — much faster
 * than reloading the browser. Used by `npm run data:build -- --preview`.
 */

import { writeFile } from 'node:fs/promises';
import { createCanvas } from 'canvas';
import type { Dataset } from '../src/core/types.ts';
import { familyColor } from '../src/core/genres.ts';
import { CONNECTION_META, primaryType } from '../src/core/connections.ts';

const DEFAULT_SIZE = 2400;
const PADDING = 80;

export const renderPreview = async (dataset: Dataset, path: string, size = DEFAULT_SIZE): Promise<void> => {
  const { nodes, edges } = dataset;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
  }
  const scale = (size - PADDING * 2) / Math.max(maxX - minX, maxY - minY);
  const px = (x: number) => PADDING + (x - minX) * scale;
  const py = (y: number) => PADDING + (y - minY) * scale;

  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#05060d';
  ctx.fillRect(0, 0, size, size);

  ctx.lineWidth = 1;
  for (const e of edges) {
    const s = nodes[e.source];
    const t = nodes[e.target];
    ctx.strokeStyle = CONNECTION_META[primaryType(e.mask)].color;
    ctx.globalAlpha = 0.06 + 0.3 * e.weight;
    ctx.beginPath();
    ctx.moveTo(px(s.x), py(s.y));
    ctx.lineTo(px(t.x), py(t.y));
    ctx.stroke();
  }

  for (const n of nodes) {
    const r = Math.max(1.2, n.radius * scale);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = familyColor(n.family);
    ctx.beginPath();
    ctx.arc(px(n.x), py(n.y), r * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(px(n.x), py(n.y), r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#fffbe6';
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'center';
  for (const n of [...nodes].sort((a, b) => b.rating - a.rating || b.degree - a.degree).slice(0, 40)) {
    ctx.fillText(n.title, px(n.x), py(n.y) - n.radius * scale - 6);
  }

  await writeFile(path, canvas.toBuffer('image/png'));
};
