import type { EvaluationResult, Evaluator, PoseSnapshot } from '../../types/contracts';
import { computePlankAngles, evaluatePlank } from './rules';
import { AngleSmoother, StateDebouncer } from '../../core/filters/smoothing';

/**
 * Motore di valutazione locale: angoli EMA-filtrati + regole pure del plank
 * + debounce dello stato. È l'unica implementazione di Evaluator nell'MVP;
 * un futuro valutatore remoto (Claude) implementerebbe la stessa interfaccia.
 */
export class LocalPlankEvaluator implements Evaluator {
  private smoother = new AngleSmoother();
  private debouncer: StateDebouncer;

  constructor(holdMs = 500) {
    this.debouncer = new StateDebouncer(holdMs);
  }

  evaluate(snapshot: PoseSnapshot): EvaluationResult {
    const rawAngles = snapshot.computedAngles ?? computePlankAngles(snapshot.landmarks);
    if (!rawAngles) {
      // Posa non rilevabile: azzera i filtri per non trascinare dati vecchi.
      this.smoother.reset();
      return this.debouncer.push(evaluatePlank(snapshot), snapshot.timestamp);
    }
    const smoothed: PoseSnapshot = { ...snapshot, computedAngles: this.smoother.push(rawAngles) };
    return this.debouncer.push(evaluatePlank(smoothed), snapshot.timestamp);
  }

  reset(): void {
    this.smoother.reset();
    this.debouncer.reset();
  }
}
