/**
 * Diffraction spike sprite — the 4-point "telescope capture" cross plus
 * fainter 45° diagonals. Drawn as a transparent bitmap that sits on top
 * of a halo under additive blend.
 *
 * Only high-rating stars (>= 7.5) wear spikes in StarfieldCanvas, so the
 * visual reads as "the bright stars have them" rather than uniform noise
 * across the field.
 */

export const buildDiffractionBitmap = (size: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2;

  // Primary axis rays — brightest. Use radial alpha gradient so the
  // ray fades toward the tip rather than ending abruptly.
  const rayLen = maxR * 0.82;
  const primaryGrad = ctx.createLinearGradient(cx - rayLen, 0, cx + rayLen, 0);
  primaryGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  primaryGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.55)');
  primaryGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.strokeStyle = primaryGrad;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(cx - rayLen, cy);
  ctx.lineTo(cx + rayLen, cy);
  ctx.stroke();

  // Vertical axis — reuse with a rotated gradient by rebuilding it.
  const vGrad = ctx.createLinearGradient(0, cy - rayLen, 0, cy + rayLen);
  vGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  vGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.55)');
  vGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.strokeStyle = vGrad;
  ctx.beginPath();
  ctx.moveTo(cx, cy - rayLen);
  ctx.lineTo(cx, cy + rayLen);
  ctx.stroke();

  // Secondary 45° diagonals, fainter and shorter.
  const diag = rayLen * 0.55 * Math.SQRT1_2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - diag, cy - diag);
  ctx.lineTo(cx + diag, cy + diag);
  ctx.moveTo(cx - diag, cy + diag);
  ctx.lineTo(cx + diag, cy - diag);
  ctx.stroke();

  return canvas;
};
