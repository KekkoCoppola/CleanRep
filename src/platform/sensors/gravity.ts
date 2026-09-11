import type { Vec2 } from '../../core/geometry/vector';

export interface GravityReading {
  /** Direzione "giù" nel frame della camera (spazio pixel), null se ignota. */
  down: Vec2 | null;
  /** Telefono quasi orizzontale: la gravità nel piano immagine non è affidabile. */
  phoneFlat: boolean;
}

const UNKNOWN: GravityReading = { down: null, phoneFlat: false };
/** Oltre questa quota di gravità lungo l'asse dello schermo il telefono è "piatto". */
const FLAT_RATIO = 0.85;

/**
 * Gravità dall'accelerometro (DeviceMotion): con la camera inclinata, "giù"
 * non è più l'asse y dell'immagine e le regole (bacino alto/basso) sbaglierebbero.
 * Su desktop non ci sono eventi: reading() resta UNKNOWN e il core usa (0,1).
 */
export class GravitySensor {
  private g: { x: number; y: number; z: number } | null = null;
  private readonly onMotion = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (a?.x == null || a.y == null || a.z == null) return;
    // Passa-basso: resta la gravità, sparisce la vibrazione.
    this.g = this.g
      ? { x: 0.8 * this.g.x + 0.2 * a.x, y: 0.8 * this.g.y + 0.2 * a.y, z: 0.8 * this.g.z + 0.2 * a.z }
      : { x: a.x, y: a.y, z: a.z };
  };

  start(): void {
    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      window.addEventListener('devicemotion', this.onMotion);
    }
  }

  stop(): void {
    window.removeEventListener('devicemotion', this.onMotion);
    this.g = null;
  }

  /** `frontCamera`: il frame (non specchiato) della camera frontale ha l'asse x invertito rispetto allo schermo. */
  read(frontCamera: boolean): GravityReading {
    const g = this.g;
    if (!g) return UNKNOWN;
    const norm = Math.hypot(g.x, g.y, g.z);
    if (norm < 1) return UNKNOWN;
    if (Math.abs(g.z) / norm > FLAT_RATIO) return { down: null, phoneFlat: true };
    // accelerationIncludingGravity punta verso l'ALTO (reazione). Assi dispositivo: x destra, y su.
    // In coordinate schermo nativo (x destra, y giù) il "giù" è (-ax, ay).
    const sx = -g.x;
    const sy = g.y;
    // Ruota nell'orientamento corrente del contenuto (0/90/180/270).
    const angle = ((screen.orientation?.angle ?? 0) * Math.PI) / 180;
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const cx = sx * cos - sy * sin;
    const cy = sx * sin + sy * cos;
    return { down: { x: frontCamera ? -cx : cx, y: cy }, phoneFlat: false };
  }
}
