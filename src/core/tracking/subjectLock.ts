import type { BBox } from './types';
import {
  bboxCenterIso,
  bboxDiagIso,
  bboxIoU,
  proportionsDistance,
  type PoseCandidate,
} from './candidate';

export interface SubjectLockConfig {
  /** Dopo quanti ms di continuità il soggetto è "agganciato". */
  acquireMs: number;
  /** Dopo quanti ms senza vederlo si lascia il soggetto e se ne cerca un altro. */
  lostMs: number;
  /** Continuità minima (0–1) perché una posa sia considerata la stessa persona. */
  minContinuity: number;
}

export const DEFAULT_SUBJECT_LOCK: SubjectLockConfig = {
  acquireMs: 500,
  lostMs: 1500,
  minContinuity: 0.3,
};

export interface SubjectSelection {
  candidate: PoseCandidate | null;
  subjectId: number | null;
  locked: boolean;
  /** Riquadri delle persone ignorate. */
  others: BBox[];
  /** true se in questo frame è iniziato un nuovo soggetto (i filtri vanno azzerati). */
  changed: boolean;
}

interface Subject {
  id: number;
  bbox: BBox;
  proportions: number[] | null;
  since: number;
  lastSeen: number;
}

/**
 * Aggancio alla persona: tra più pose rilevate segue sempre la stessa, per
 * continuità spaziale (sovrapposizione e distanza dei riquadri) e per
 * "impronta" corporea (proporzioni ossee in metri). Una seconda persona che
 * entra nell'inquadratura, o un oggetto scambiato per una posa, viene ignorata.
 */
export class SubjectLock {
  private current: Subject | null = null;
  private nextId = 1;

  constructor(private readonly config: SubjectLockConfig = DEFAULT_SUBJECT_LOCK) {}

  select(candidates: PoseCandidate[], t: number, aspect: number): SubjectSelection {
    const boxes = (except?: PoseCandidate) =>
      candidates.filter((c) => c !== except).map((c) => c.bbox);

    if (this.current) {
      let best: PoseCandidate | null = null;
      let bestScore = -Infinity;
      for (const c of candidates) {
        const score = this.continuity(c, this.current, aspect);
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
      if (best && bestScore >= this.config.minContinuity) {
        this.follow(best, t);
        return this.result(best, boxes(best), false, t);
      }
      if (t - this.current.lastSeen <= this.config.lostMs) {
        // Soggetto momentaneamente perso: meglio nessuna posa che quella di un altro.
        return { candidate: null, subjectId: this.current.id, locked: false, others: boxes(), changed: false };
      }
      this.current = null;
    }

    if (candidates.length === 0) {
      return { candidate: null, subjectId: null, locked: false, others: [], changed: false };
    }
    const chosen = candidates.reduce((a, b) => (this.acquireScore(b, aspect) > this.acquireScore(a, aspect) ? b : a));
    this.current = {
      id: this.nextId++,
      bbox: chosen.bbox,
      proportions: chosen.proportions,
      since: t,
      lastSeen: t,
    };
    return this.result(chosen, boxes(chosen), true, t);
  }

  reset(): void {
    this.current = null;
  }

  private result(c: PoseCandidate, others: BBox[], changed: boolean, t: number): SubjectSelection {
    const s = this.current!;
    return {
      candidate: c,
      subjectId: s.id,
      locked: t - s.since >= this.config.acquireMs,
      others,
      changed,
    };
  }

  private follow(c: PoseCandidate, t: number): void {
    const s = this.current!;
    s.bbox = c.bbox;
    s.lastSeen = t;
    if (c.proportions) {
      s.proportions = s.proportions
        ? s.proportions.map((v, i) => {
            const n = c.proportions![i];
            if (!Number.isFinite(n)) return v;
            return Number.isFinite(v) ? 0.9 * v + 0.1 * n : n;
          })
        : c.proportions;
    }
  }

  private continuity(c: PoseCandidate, s: Subject, aspect: number): number {
    const iou = bboxIoU(c.bbox, s.bbox);
    const a = bboxCenterIso(c.bbox, aspect);
    const b = bboxCenterIso(s.bbox, aspect);
    const d = Math.hypot(a.x - b.x, a.y - b.y) / Math.max(bboxDiagIso(s.bbox, aspect), 0.05);
    let score = 0.5 * iou + 0.5 * Math.max(0, 1 - d);
    const propDiff = proportionsDistance(c.proportions, s.proportions);
    if (propDiff !== undefined && propDiff > 0.25) score -= 0.3;
    return score;
  }

  /** Nuovo aggancio: la persona più grande e più chiaramente visibile. */
  private acquireScore(c: PoseCandidate, aspect: number): number {
    const area = (c.bbox.maxX - c.bbox.minX) * aspect * (c.bbox.maxY - c.bbox.minY);
    return area * c.meanVisibility;
  }
}
