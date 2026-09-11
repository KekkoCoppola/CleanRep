import type { JointName, Side } from '../../types/contracts';
import { bboxDiagIso, type JointMap } from './candidate';
import type { BBox, PoseQuality, QualityIssue, StableJoint } from './types';

const KEY_PARTS = ['SHOULDER', 'HIP', 'KNEE', 'ANKLE'];

export const QUALITY_THRESHOLDS = {
  minJointConfidence: 0.4,
  minMeanConfidence: 0.45,
  /** Margine dai bordi del frame (normalizzato) oltre il quale un giunto è "tagliato". */
  edgeMargin: 0.01,
  /** Diagonale minima del corpo (unità = altezza frame). */
  minBodyDiag: 0.3,
  /** Luminosità media minima 0–1. */
  minBrightness: 0.15,
} as const;

export interface QualityInput {
  hasSubject: boolean;
  joints: Partial<Record<JointName, StableJoint>>;
  raw: JointMap | null;
  bbox: BBox | null;
  aspect: number;
  nearSide: Side | null;
  brightness?: number;
  phoneFlat?: boolean;
}

function usable(j: StableJoint | undefined): j is StableJoint {
  return !!j && j.state !== 'lost' && j.confidence >= QUALITY_THRESHOLDS.minJointConfidence;
}

function goodCount(joints: QualityInput['joints'], side: Side): number {
  return KEY_PARTS.filter((p) => usable(joints[`${side}_${p}` as JointName])).length;
}

/**
 * Qualità della posa: decide se l'app può giudicare la tecnica. Se la posa è
 * bloccante (persona assente, poco visibile o tagliata fuori) l'esercizio non
 * viene valutato e la voce dà solo istruzioni di inquadratura.
 */
export function assessQuality(input: QualityInput): PoseQuality {
  if (!input.hasSubject) return { score: 0, issues: ['NO_PERSON'], blocking: true };

  const side: Side =
    input.nearSide ?? (goodCount(input.joints, 'LEFT') >= goodCount(input.joints, 'RIGHT') ? 'LEFT' : 'RIGHT');
  const key = KEY_PARTS.map((p) => input.joints[`${side}_${p}` as JointName]);
  const good = key.filter(usable);
  const meanConf = good.length ? good.reduce((s, j) => s + j.confidence, 0) / good.length : 0;

  const issues: QualityIssue[] = [];
  let score = 1;
  let blocking = false;

  const m = QUALITY_THRESHOLDS.edgeMargin;
  const clipped = KEY_PARTS.some((p) => {
    const lm = input.raw?.[`${side}_${p}` as JointName];
    return !!lm && (lm.x < m || lm.x > 1 - m || lm.y < m || lm.y > 1 - m);
  });
  if (clipped) {
    issues.push('CLIPPED');
    score -= 0.4;
    blocking = true;
  }
  if (good.length < 3 || meanConf < QUALITY_THRESHOLDS.minMeanConfidence) {
    issues.push('LOW_CONFIDENCE');
    score -= 0.5;
    blocking = true;
  }
  if (input.bbox && bboxDiagIso(input.bbox, input.aspect) < QUALITY_THRESHOLDS.minBodyDiag) {
    issues.push('TOO_FAR');
    score -= 0.2;
  }
  if (input.brightness !== undefined && input.brightness < QUALITY_THRESHOLDS.minBrightness) {
    issues.push('LOW_LIGHT');
    score -= 0.2;
  }
  if (input.phoneFlat) {
    issues.push('PHONE_FLAT');
    score -= 0.1;
  }
  return { score: Math.max(0, Math.min(1, score * (0.5 + 0.5 * meanConf))), issues, blocking };
}
