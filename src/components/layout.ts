import type { Insets } from '../render/camera';

/**
 * Layout constants shared by CSS-in-JSX and the camera. The renderer asks
 * for insets the moment a movie is selected — before React has mounted the
 * details panel — so the panel's footprint is computed, not measured. On
 * phones the legend pill sits bottom-left, inside the bottom inset.
 */

export const COMPACT_MAX_WIDTH = 767;
/** Opening a film from search moves keyboard focus to its title. */
export const DETAILS_TITLE_ID = 'details-title';
export const DETAILS_WIDTH = 384;
export const DETAILS_SHEET_HEIGHT = 0.58; // share of the viewport on phones

export const isCompactViewport = (width: number) => width <= COMPACT_MAX_WIDTH;

export const sceneInsets = (width: number, height: number, detailsOpen: boolean): Insets =>
  isCompactViewport(width)
    ? { top: 112, right: 0, bottom: detailsOpen ? Math.round(height * DETAILS_SHEET_HEIGHT) : 100, left: 0 }
    : { top: 92, right: detailsOpen ? DETAILS_WIDTH + 32 : 0, bottom: 56, left: 0 };
