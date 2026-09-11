/**
 * Filtro 1€ (Casiez et al., CHI 2012): passa-basso con frequenza di taglio
 * adattiva. Da fermi filtra forte (niente tremolio dello scheletro durante un
 * plank), in movimento rilassa il filtro (poco ritardo quando ti metti in posizione).
 *
 * - minCutoff (Hz): più basso = meno jitter da fermi, più ritardo.
 * - beta: più alto = meno ritardo nei movimenti veloci.
 * - dCutoff (Hz): taglio del filtro sulla velocità stimata.
 */
export interface OneEuroParams {
  minCutoff: number;
  beta: number;
  dCutoff: number;
}

export const STATIC_HOLD_FILTER: OneEuroParams = { minCutoff: 0.6, beta: 1.5, dCutoff: 1 };

function smoothingFactor(cutoffHz: number, dtS: number): number {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtS);
}

export class OneEuroFilter {
  private x: number | undefined;
  private dx = 0;
  private t = 0;

  constructor(private readonly params: OneEuroParams) {}

  /** `tMs` = timestamp in millisecondi (monotono). */
  filter(value: number, tMs: number): number {
    if (this.x === undefined) {
      this.x = value;
      this.dx = 0;
      this.t = tMs;
      return value;
    }
    let dt = (tMs - this.t) / 1000;
    if (!(dt > 0)) dt = 1 / 30;
    this.t = tMs;
    const rawDx = (value - this.x) / dt;
    this.dx += smoothingFactor(this.params.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.params.minCutoff + this.params.beta * Math.abs(this.dx);
    this.x += smoothingFactor(cutoff, dt) * (value - this.x);
    return this.x;
  }

  reset(): void {
    this.x = undefined;
    this.dx = 0;
  }
}

/** Coppia di filtri 1€ per un punto 2D. */
export class PointFilter {
  private fx: OneEuroFilter;
  private fy: OneEuroFilter;

  constructor(params: OneEuroParams) {
    this.fx = new OneEuroFilter(params);
    this.fy = new OneEuroFilter(params);
  }

  filter(p: { x: number; y: number }, tMs: number): { x: number; y: number } {
    return { x: this.fx.filter(p.x, tMs), y: this.fy.filter(p.y, tMs) };
  }

  reset(): void {
    this.fx.reset();
    this.fy.reset();
  }
}
