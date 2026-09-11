/**
 * Mappatura frame analizzato → pixel del canvas. Unica fonte di verità per
 * disegnare sia l'immagine sia lo scheletro: stessi numeri, allineamento esatto.
 *
 * "Contain" (letterbox): il frame intero è visibile senza deformazioni, così a
 * schermo si vede esattamente ciò che vede il modello (nessuna parte del corpo
 * tagliata, nessuno stiramento come col vecchio object-fit: cover + canvas stirato).
 */
export interface Viewport {
  /** Pixel del canvas per pixel del frame. */
  scale: number;
  offsetX: number;
  offsetY: number;
  /** Dimensioni dell'area disegnata (pixel canvas). */
  width: number;
  height: number;
  mirrored: boolean;
}

export function containViewport(
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
  mirrored: boolean,
): Viewport {
  if (srcWidth <= 0 || srcHeight <= 0 || dstWidth <= 0 || dstHeight <= 0) {
    return { scale: 0, offsetX: 0, offsetY: 0, width: 0, height: 0, mirrored };
  }
  const scale = Math.min(dstWidth / srcWidth, dstHeight / srcHeight);
  const width = srcWidth * scale;
  const height = srcHeight * scale;
  return { scale, offsetX: (dstWidth - width) / 2, offsetY: (dstHeight - height) / 2, width, height, mirrored };
}

/** Coordinate normalizzate MediaPipe (0–1 sul frame NON specchiato) → pixel canvas. */
export function project(vp: Viewport, nx: number, ny: number): { x: number; y: number } {
  return {
    x: vp.offsetX + (vp.mirrored ? 1 - nx : nx) * vp.width,
    y: vp.offsetY + ny * vp.height,
  };
}
