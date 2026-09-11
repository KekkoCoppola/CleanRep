/**
 * Vettori 2D nello spazio immagine ISOTROPO: x moltiplicata per il rapporto
 * larghezza/altezza del frame, così un'unità vale uguale in orizzontale e in
 * verticale (unità = altezza del frame). I landmark MediaPipe sono normalizzati
 * separatamente su larghezza e altezza: calcolare angoli direttamente su quelli
 * li deforma su ogni frame non quadrato (4:3, 16:9, telefono in verticale).
 */

export interface Vec2 {
  x: number;
  y: number;
}

/** Gravità di default quando il sensore non c'è: "giù" = verso il basso dell'immagine. */
export const DEFAULT_DOWN: Vec2 = { x: 0, y: 1 };

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function scale(v: Vec2, k: number): Vec2 {
  return { x: v.x * k, y: v.y * k };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function length(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normalize(v: Vec2): Vec2 {
  const len = length(v);
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}

/** Punto normalizzato MediaPipe → spazio isotropo. */
export function toIso(p: Vec2, aspect: number): Vec2 {
  return { x: p.x * aspect, y: p.y };
}

/** Angolo (gradi, 0–180) tra due vettori. 0 se uno dei due è nullo. */
export function angleBetweenVectors(a: Vec2, b: Vec2): number {
  const la = length(a);
  const lb = length(b);
  if (la === 0 || lb === 0) return 0;
  const cos = Math.min(1, Math.max(-1, dot(a, b) / (la * lb)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Angolo (gradi) tra il vettore e la direzione "giù": 0 = verticale verso il basso. */
export function angleFromDown(v: Vec2, down: Vec2): number {
  return angleBetweenVectors(v, down);
}

/**
 * Inclinazione (gradi, 0–90) del vettore rispetto al pavimento
 * (piano perpendicolare alla gravità): 0 = orizzontale, 90 = verticale.
 */
export function elevationDeg(v: Vec2, down: Vec2): number {
  const len = length(v);
  if (len === 0) return 0;
  const s = Math.min(1, Math.abs(dot(v, normalize(down))) / len);
  return (Math.asin(s) * 180) / Math.PI;
}

/**
 * Scostamento segnato di `p` dalla retta a-b, misurato lungo la gravità:
 * positivo = p sta SOTTO la retta (verso il pavimento), negativo = sopra.
 * Indipendente dall'inclinazione della camera se `down` viene dal sensore.
 */
export function offsetFromLineAlongDown(p: Vec2, a: Vec2, b: Vec2, down: Vec2): number {
  const ab = sub(b, a);
  const lenSq = dot(ab, ab);
  const t = lenSq === 0 ? 0 : dot(sub(p, a), ab) / lenSq;
  const foot = add(a, scale(ab, t));
  return dot(sub(p, foot), normalize(down));
}
