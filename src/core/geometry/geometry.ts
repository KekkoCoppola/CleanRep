/**
 * Geometria 2D sul piano immagine (x,y normalizzati MediaPipe, y verso il basso).
 * La z di MediaPipe è troppo rumorosa per soglie affidabili: per il plank
 * ripreso di lato il piano immagine è sufficiente.
 */

export interface Point2D {
  x: number;
  y: number;
}

/** Angolo (gradi, 0–180) al vertice `b` del triangolo a-b-c. */
export function angleBetween3Points(a: Point2D, b: Point2D, c: Point2D): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const mag1 = Math.hypot(v1x, v1y);
  const mag2 = Math.hypot(v2x, v2y);
  if (mag1 === 0 || mag2 === 0) return 0;
  const cos = Math.min(1, Math.max(-1, (v1x * v2x + v1y * v2y) / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Scostamento verticale (in coordinate normalizzate) di `p` rispetto alla
 * retta a-b, misurato come p.y - y_della_proiezione_di_p_sulla_retta.
 * Positivo = p sta SOTTO la retta sullo schermo (y cresce verso il basso).
 */
export function verticalDeviationFromLine(p: Point2D, a: Point2D, b: Point2D): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return p.y - a.y;
  const t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
  const projY = a.y + t * aby;
  return p.y - projY;
}

export function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
