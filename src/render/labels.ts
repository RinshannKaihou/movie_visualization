/**
 * Greedy, priority-ordered label placement in screen space — the same idea
 * map renderers use for city names. Candidates arrive most-important first;
 * each is accepted only if its box does not overlap an accepted one. A
 * uniform grid keeps every test O(1), so the whole pass is cheap enough to
 * run on every camera frame.
 */

export interface LabelBox {
  /** Opaque id handed back for accepted boxes (e.g. a node index). */
  id: number;
  x: number;       // left
  y: number;       // top
  width: number;
  height: number;
}

const CELL = 64;

export const placeLabels = (
  candidates: Iterable<LabelBox>,
  viewport: { width: number; height: number },
  maxCount: number,
  gap = 3,
): LabelBox[] => {
  const accepted: LabelBox[] = [];
  const grid = new Map<number, LabelBox[]>();
  const cellsOf = (b: LabelBox, visit: (key: number) => boolean | void) => {
    const x0 = Math.floor((b.x - gap) / CELL), x1 = Math.floor((b.x + b.width + gap) / CELL);
    const y0 = Math.floor((b.y - gap) / CELL), y1 = Math.floor((b.y + b.height + gap) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        if (visit(cx * 100_003 + cy) === true) return true;
      }
    }
    return false;
  };
  const overlaps = (a: LabelBox, b: LabelBox) =>
    a.x - gap < b.x + b.width && b.x - gap < a.x + a.width && a.y - gap < b.y + b.height && b.y - gap < a.y + a.height;

  for (const box of candidates) {
    if (accepted.length >= maxCount) break;
    const onScreen =
      box.x + box.width > 0 && box.y + box.height > 0 && box.x < viewport.width && box.y < viewport.height;
    if (!onScreen) continue;
    const blocked = cellsOf(box, key => grid.get(key)?.some(other => overlaps(box, other)));
    if (blocked) continue;
    accepted.push(box);
    cellsOf(box, key => {
      const list = grid.get(key);
      if (list) list.push(box);
      else grid.set(key, [box]);
    });
  }
  return accepted;
};

// Hangul Jamo, CJK (radicals through Yi), Hangul syllables, CJK compatibility, fullwidth forms.
const WIDE_GLYPH = /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\uff00-\uff60]/u;

/** Monospace width estimate: wide (CJK, fullwidth) glyphs take ~2 columns. */
export const estimateTextWidth = (text: string, fontSize: number): number => {
  let columns = 0;
  for (const ch of text) columns += WIDE_GLYPH.test(ch) ? 2 : 1;
  return columns * fontSize * 0.6;
};
