import type { ComputedAngles, EvaluationResult } from '../types/contracts';

/** Media mobile esponenziale per una singola serie di valori. */
export class Ema {
  private value: number | undefined;
  constructor(private readonly alpha = 0.3) {}

  push(sample: number): number {
    this.value = this.value === undefined ? sample : this.alpha * sample + (1 - this.alpha) * this.value;
    return this.value;
  }

  reset(): void {
    this.value = undefined;
  }
}

/** EMA applicata campo per campo agli angoli del plank (anti-jitter dei landmark). */
export class AngleSmoother {
  private emas = new Map<keyof ComputedAngles, Ema>();
  constructor(private readonly alpha = 0.3) {}

  push(angles: ComputedAngles): ComputedAngles {
    const out = {} as ComputedAngles;
    for (const key of Object.keys(angles) as Array<keyof ComputedAngles>) {
      let ema = this.emas.get(key);
      if (!ema) {
        ema = new Ema(this.alpha);
        this.emas.set(key, ema);
      }
      out[key] = ema.push(angles[key]);
    }
    return out;
  }

  reset(): void {
    this.emas.clear();
  }
}

function signature(r: EvaluationResult): string {
  return `${r.isCorrect}|${r.overallScore === 0 ? 'nopose' : 'pose'}|${r.jointsToColorRed.join(',')}`;
}

/**
 * Debounce dello stato verde/rosso: un nuovo giudizio viene "committato"
 * solo se persiste per almeno holdMs (timestamp degli snapshot, non wall clock).
 * Evita il flickering dei colori al confine delle soglie.
 */
export class StateDebouncer {
  private committed: EvaluationResult | undefined;
  private pending: EvaluationResult | undefined;
  private pendingSince = 0;

  constructor(private readonly holdMs = 500) {}

  push(result: EvaluationResult, timestamp: number): EvaluationResult {
    if (!this.committed) {
      this.committed = result;
      return result;
    }
    if (signature(result) === signature(this.committed)) {
      this.pending = undefined;
      // Aggiorna comunque score/frase del medesimo stato (variazioni fini non sono flickering).
      this.committed = result;
      return this.committed;
    }
    if (!this.pending || signature(result) !== signature(this.pending)) {
      this.pending = result;
      this.pendingSince = timestamp;
      return this.committed;
    }
    if (timestamp - this.pendingSince >= this.holdMs) {
      this.committed = result;
      this.pending = undefined;
    }
    return this.committed;
  }

  reset(): void {
    this.committed = undefined;
    this.pending = undefined;
  }
}
