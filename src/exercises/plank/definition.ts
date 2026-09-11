import type { JointName } from '../../types/contracts';
import type { ExerciseContext, ExerciseRule, HoldExerciseDefinition, RuleResult } from '../../core/exercise/types';
import { aboveWithHysteresis, belowWithHysteresis } from '../../core/filters/hysteresis';
import { STATIC_HOLD_FILTER } from '../../core/filters/oneEuro';
import {
  angleBetweenVectors,
  angleFromDown,
  dist,
  dot,
  elevationDeg,
  offsetFromLineAlongDown,
  sub,
} from '../../core/geometry/vector';
import { PLANK_MESSAGES } from './messages.it';

export type PlankVariant = 'FOREARM' | 'HIGH';

/**
 * Soglie biomeccaniche del plank. Tutte normalizzate sul corpo (non sul frame)
 * e riferite alla gravità: valgono a qualsiasi distanza e con la camera inclinata.
 * Coppie enter/exit = isteresi (lo stato cambia solo per variazioni vere).
 */
export const PLANK_THRESHOLDS = {
  /** Inclinazione massima dell'asse spalle→caviglie rispetto al pavimento per essere "in plank". */
  maxBodyElevationDeg: 40,
  /** Inclinazione massima del busto (spalla→anca): esclude seduti/inginocchiati eretti. */
  maxTorsoElevationDeg: 50,
  /** Il braccio deve scendere verso il pavimento (angolo dalla verticale) per sostenere il corpo. */
  maxSupportArmFromDownDeg: 60,
  /** Angolo del gomito: sopra = braccia tese, sotto = avambracci, in mezzo si tiene la variante. */
  highPlankElbowDeg: 145,
  forearmPlankElbowDeg: 120,
  /** Anca sotto la retta spalla–caviglia, in frazioni della lunghezza spalla–caviglia. */
  hipSag: { enter: 0.05, exit: 0.035 },
  /** Anca sopra la retta (bacino a piramide): più tollerata del cedimento. */
  hipPike: { enter: 0.07, exit: 0.05 },
  /** Angolo anca–ginocchio–caviglia. */
  kneeAngle: { enter: 155, exit: 162 },
  /** Braccio (spalla→gomito o spalla→polso) lontano dalla verticale. */
  armFromVerticalDeg: { enter: 30, exit: 22 },
  /** Testa fuori linea col busto. */
  headDeg: { enter: 35, exit: 25 },
} as const;

const T = PLANK_THRESHOLDS;
const skipped: RuleResult = { status: 'skipped' };
const result = (violated: boolean, joints: JointName[]): RuleResult =>
  violated ? { status: 'violated', joints } : { status: 'ok' };

/** Scostamento segnato dell'anca dalla retta spalla–caviglia (+ = cede verso il pavimento). */
function hipDeviation(ctx: ExerciseContext): number | undefined {
  const s = ctx.point('SHOULDER');
  const h = ctx.point('HIP');
  const a = ctx.point('ANKLE');
  if (!s || !h || !a) return undefined;
  const span = dist(s, a);
  if (span < 0.5 * ctx.torso) return undefined;
  return offsetFromLineAlongDown(h, s, a, ctx.down) / span;
}

const HIP_JOINTS: JointName[] = ['LEFT_HIP', 'RIGHT_HIP'];

const rules: ExerciseRule[] = [
  {
    id: 'hipSag',
    priority: 1,
    severity: 'high',
    penalty: 4,
    evaluate(ctx, was) {
      const d = hipDeviation(ctx);
      if (d === undefined) return skipped;
      return result(aboveWithHysteresis(was, d, T.hipSag.enter, T.hipSag.exit), HIP_JOINTS);
    },
  },
  {
    id: 'hipPike',
    priority: 1,
    severity: 'high',
    penalty: 4,
    evaluate(ctx, was) {
      const d = hipDeviation(ctx);
      if (d === undefined) return skipped;
      return result(aboveWithHysteresis(was, -d, T.hipPike.enter, T.hipPike.exit), HIP_JOINTS);
    },
  },
  {
    id: 'kneesBent',
    priority: 2,
    severity: 'medium',
    penalty: 2,
    evaluate(ctx, was) {
      const h = ctx.point('HIP');
      const k = ctx.point('KNEE');
      const a = ctx.point('ANKLE');
      if (!h || !k || !a) return skipped;
      const angle = angleBetweenVectors(sub(h, k), sub(a, k));
      return result(belowWithHysteresis(was, angle, T.kneeAngle.enter, T.kneeAngle.exit), [ctx.jointName('KNEE')]);
    },
  },
  {
    id: 'elbowsUnderShoulders',
    priority: 3,
    severity: 'medium',
    penalty: 2,
    variants: ['FOREARM'],
    evaluate(ctx, was) {
      const s = ctx.point('SHOULDER');
      const e = ctx.point('ELBOW');
      if (!s || !e) return skipped;
      const angle = angleFromDown(sub(e, s), ctx.down);
      return result(aboveWithHysteresis(was, angle, T.armFromVerticalDeg.enter, T.armFromVerticalDeg.exit), [
        ctx.jointName('ELBOW'),
      ]);
    },
  },
  {
    id: 'handsUnderShoulders',
    priority: 3,
    severity: 'medium',
    penalty: 2,
    variants: ['HIGH'],
    evaluate(ctx, was) {
      const s = ctx.point('SHOULDER');
      const w = ctx.point('WRIST');
      if (!s || !w) return skipped;
      const angle = angleFromDown(sub(w, s), ctx.down);
      return result(aboveWithHysteresis(was, angle, T.armFromVerticalDeg.enter, T.armFromVerticalDeg.exit), [
        ctx.jointName('WRIST'),
      ]);
    },
  },
  {
    id: 'headAlignment',
    priority: 4,
    severity: 'low',
    penalty: 1,
    evaluate(ctx, was) {
      const ear = ctx.point('EAR');
      const s = ctx.point('SHOULDER');
      const h = ctx.point('HIP');
      if (!ear || !s || !h) return skipped;
      const angle = angleBetweenVectors(sub(ear, s), sub(s, h));
      return result(aboveWithHysteresis(was, angle, T.headDeg.enter, T.headDeg.exit), [ctx.jointName('EAR')]);
    },
  },
];

/** Plank = corpo quasi orizzontale, busto non eretto, sostenuto da braccia o avambracci. */
function isInPosition(ctx: ExerciseContext): boolean {
  const s = ctx.point('SHOULDER');
  const h = ctx.point('HIP');
  const a = ctx.point('ANKLE');
  if (!s || !h || !a) return false;
  if (elevationDeg(sub(a, s), ctx.down) > T.maxBodyElevationDeg) return false;
  if (elevationDeg(sub(h, s), ctx.down) > T.maxTorsoElevationDeg) return false;
  const e = ctx.point('ELBOW');
  const w = ctx.point('WRIST');
  const elbowSupport = !!e && angleFromDown(sub(e, s), ctx.down) < T.maxSupportArmFromDownDeg;
  const wristSupport = !!w && dot(sub(w, s), ctx.down) > 0.5 * ctx.torso;
  return elbowSupport || wristSupport;
}

function detectVariant(ctx: ExerciseContext, current: string | undefined): PlankVariant {
  const s = ctx.point('SHOULDER');
  const e = ctx.point('ELBOW');
  const w = ctx.point('WRIST');
  const fallback = (current as PlankVariant | undefined) ?? 'FOREARM';
  if (!s || !e || !w) return fallback;
  const angle = angleBetweenVectors(sub(s, e), sub(w, e));
  if (angle > T.highPlankElbowDeg) return 'HIGH';
  if (angle < T.forearmPlankElbowDeg) return 'FOREARM';
  if (current) return fallback;
  return angle >= (T.highPlankElbowDeg + T.forearmPlankElbowDeg) / 2 ? 'HIGH' : 'FOREARM';
}

export const PLANK: HoldExerciseDefinition = {
  id: 'PLANK',
  kind: 'hold',
  name: 'Plank',
  cameraSetup: 'side',
  filter: STATIC_HOLD_FILTER,
  maxJointSpeed: 8,
  isInPosition,
  detectVariant,
  rules,
  messages: PLANK_MESSAGES,
};
