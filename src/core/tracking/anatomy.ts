import type { JointName } from '../../types/contracts';
import type { JointMap } from './candidate';

/** Ossa controllate: [prossimale, distale]. In caso di anomalia si scarta il distale. */
const BONES: Array<[string, string]> = [
  ['SHOULDER', 'ELBOW'],
  ['ELBOW', 'WRIST'],
  ['HIP', 'KNEE'],
  ['KNEE', 'ANKLE'],
];

export interface BoneMonitorConfig {
  window: number;
  minSamples: number;
  /** Scostamento relativo massimo dalla mediana della lunghezza dell'osso. */
  maxRelativeDeviation: number;
  minVisibility: number;
  /**
   * Anomalie consecutive dopo cui la statistica dell'osso viene ri-appresa:
   * se la mediana si fosse formata su dati sbagliati il giunto non deve restare
   * scartato per sempre.
   */
  relearnAfter: number;
}

export const DEFAULT_BONE_MONITOR: BoneMonitorConfig = {
  window: 60,
  minSamples: 15,
  maxRelativeDeviation: 0.3,
  minVisibility: 0.5,
  relearnAfter: 30,
};

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Coerenza anatomica: le ossa non cambiano lunghezza. Lavora sulle coordinate
 * MONDO di MediaPipe (metri, 3D): a differenza delle lunghezze 2D non cambiano
 * quando la persona ruota. Un gomito "teletrasportato" su un oggetto vicino
 * allunga l'avambraccio del 50%: il giunto viene scartato per quel frame.
 */
export class BoneLengthMonitor {
  private windows = new Map<string, number[]>();
  private anomalyStreak = new Map<string, number>();

  constructor(private readonly config: BoneMonitorConfig = DEFAULT_BONE_MONITOR) {}

  /** Ritorna i giunti con osso anomalo; aggiorna le statistiche con le ossa plausibili. */
  check(world: JointMap | null): JointName[] {
    if (!world) return [];
    const anomalous: JointName[] = [];
    for (const side of ['LEFT', 'RIGHT']) {
      for (const [a, b] of BONES) {
        const pa = world[`${side}_${a}` as JointName];
        const pb = world[`${side}_${b}` as JointName];
        if (!pa || !pb) continue;
        if (pa.visibility < this.config.minVisibility || pb.visibility < this.config.minVisibility) continue;
        const len = Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
        const key = `${side}_${a}_${b}`;
        const samples = this.windows.get(key) ?? [];
        if (samples.length >= this.config.minSamples) {
          const med = median(samples);
          if (med > 0 && Math.abs(len - med) / med > this.config.maxRelativeDeviation) {
            const streak = (this.anomalyStreak.get(key) ?? 0) + 1;
            if (streak < this.config.relearnAfter) {
              this.anomalyStreak.set(key, streak);
              anomalous.push(`${side}_${b}` as JointName);
              continue;
            }
            // Anomalia stabile: era la statistica a essere sbagliata. Si ricomincia.
            samples.length = 0;
          }
        }
        this.anomalyStreak.set(key, 0);
        samples.push(len);
        if (samples.length > this.config.window) samples.shift();
        this.windows.set(key, samples);
      }
    }
    return anomalous;
  }

  reset(): void {
    this.windows.clear();
    this.anomalyStreak.clear();
  }
}
