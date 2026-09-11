import type { EvaluationResult } from '../../types/contracts';

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
