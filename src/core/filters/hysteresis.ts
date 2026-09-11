/**
 * Isteresi: soglie diverse per entrare e uscire da uno stato. Un valore che
 * oscilla attorno a una soglia unica farebbe lampeggiare verde/rosso e cambiare
 * frase di continuo; con due soglie lo stato cambia solo per variazioni vere.
 */

/** Attivo quando il valore SUPERA `enter`; resta attivo finché non scende sotto `exit` (exit < enter). */
export function aboveWithHysteresis(wasActive: boolean, value: number, enter: number, exit: number): boolean {
  return wasActive ? value > exit : value > enter;
}

/** Attivo quando il valore SCENDE sotto `enter`; resta attivo finché non risale sopra `exit` (exit > enter). */
export function belowWithHysteresis(wasActive: boolean, value: number, enter: number, exit: number): boolean {
  return wasActive ? value < exit : value < enter;
}

/** Misura da quanto tempo (ms) una condizione è vera senza interruzioni. */
export class Persistence {
  private since: number | null = null;

  /** Aggiorna con la condizione al tempo `t`; ritorna i ms di persistenza (0 se falsa). */
  update(condition: boolean, t: number): number {
    if (!condition) {
      this.since = null;
      return 0;
    }
    if (this.since === null) this.since = t;
    return t - this.since;
  }

  reset(): void {
    this.since = null;
  }
}
