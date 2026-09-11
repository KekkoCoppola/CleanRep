import type { JointName } from '../../types/contracts';
import type { ExerciseContext, ExerciseRule, HoldExerciseDefinition, RuleResult } from '../../core/exercise/types';
import { aboveWithHysteresis } from '../../core/filters/hysteresis';
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
 * Soglie dalla rubrica "Valutazione biomeccanica e metodologia di giudizio
 * tecnico del plank": ottimale / difetto tollerabile (richiamo verbale) /
 * deviazione critica (cedimento tecnico). Distanze in cm (dai landmark mondo),
 * angoli in gradi riferiti alla gravità. enter/exit = isteresi del difetto
 * tollerabile, critical = soglia della deviazione critica.
 *
 * Asse ideale sul piano sagittale: orecchio – spalla – anca – ginocchio – caviglia.
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
  /** Bacino fuori dall'asse spalla–caviglia: < 5 cm tollerabile, > 5 cm critico. */
  hipCm: { enter: 3.5, exit: 2.5, critical: 5 },
  /** Flessione del ginocchio (180° − angolo): "breve e minima (< 10°)" tollerabile, persistente critica. */
  kneeFlexionDeg: { enter: 12, exit: 8, critical: 20 },
  /** Gomiti avanzati/arretrati rispetto alla verticale della spalla (omero dalla verticale). */
  elbowFromVerticalDeg: { enter: 15, exit: 10, critical: 30 },
  /** Braccia tese: polso rispetto alla verticale della spalla (variante non coperta dalla rubrica). */
  handFromVerticalDeg: { enter: 20, exit: 14, critical: 30 },
  /** Testa che cade sotto il prolungamento del busto: flessione passiva, tollerabile. */
  headDropDeg: { enter: 20, exit: 14 },
  /** Sguardo (orecchio→naso) rispetto alla verticale: 0 = a terra, 90 = orizzonte. Iperestensione critica. */
  gazeFromDownDeg: { enter: 50, exit: 40, critical: 70 },
} as const;

const T = PLANK_THRESHOLDS;
const skipped: RuleResult = { status: 'skipped' };
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Difetto con isteresi sul livello tollerabile e soglia critica sul valore. */
function leveled(
  was: boolean,
  value: number,
  th: { enter: number; exit: number; critical?: number },
  joints: JointName[],
): RuleResult {
  if (!aboveWithHysteresis(was, value, th.enter, th.exit)) return { status: 'ok', value: round1(value) };
  const critical = th.critical !== undefined && value >= th.critical;
  return { status: 'violated', joints, value: round1(value), level: critical ? 'critical' : 'tolerable' };
}

/** Scostamento dell'anca dalla retta spalla–caviglia in cm (+ = verso il pavimento). */
function hipOffsetCm(ctx: ExerciseContext): number | undefined {
  const s = ctx.point('SHOULDER');
  const h = ctx.point('HIP');
  const a = ctx.point('ANKLE');
  if (!s || !h || !a) return undefined;
  if (dist(s, a) < 0.5 * ctx.torso) return undefined;
  return offsetFromLineAlongDown(h, s, a, ctx.down) * ctx.metersPerUnit * 100;
}

const HIP_JOINTS: JointName[] = ['LEFT_HIP', 'RIGHT_HIP'];

const rules: ExerciseRule[] = [
  {
    id: 'hipSag',
    priority: 1,
    severity: 'high',
    penalty: 4,
    unit: 'cm',
    evaluate(ctx, was) {
      const cm = hipOffsetCm(ctx);
      return cm === undefined ? skipped : leveled(was, cm, T.hipCm, HIP_JOINTS);
    },
  },
  {
    id: 'hipPike',
    priority: 1,
    severity: 'high',
    penalty: 4,
    unit: 'cm',
    evaluate(ctx, was) {
      const cm = hipOffsetCm(ctx);
      return cm === undefined ? skipped : leveled(was, -cm, T.hipCm, HIP_JOINTS);
    },
  },
  {
    id: 'kneesBent',
    priority: 2,
    severity: 'medium',
    penalty: 2,
    unit: '°',
    evaluate(ctx, was) {
      const h = ctx.point('HIP');
      const k = ctx.point('KNEE');
      const a = ctx.point('ANKLE');
      if (!h || !k || !a) return skipped;
      const flexion = 180 - angleBetweenVectors(sub(h, k), sub(a, k));
      return leveled(was, flexion, T.kneeFlexionDeg, [ctx.jointName('KNEE')]);
    },
  },
  {
    id: 'elbowsUnderShoulders',
    priority: 3,
    severity: 'medium',
    penalty: 2,
    unit: '°',
    variants: ['FOREARM'],
    evaluate(ctx, was) {
      const s = ctx.point('SHOULDER');
      const e = ctx.point('ELBOW');
      if (!s || !e) return skipped;
      return leveled(was, angleFromDown(sub(e, s), ctx.down), T.elbowFromVerticalDeg, [
        ctx.jointName('ELBOW'),
        ctx.jointName('SHOULDER'),
      ]);
    },
  },
  {
    id: 'handsUnderShoulders',
    priority: 3,
    severity: 'medium',
    penalty: 2,
    unit: '°',
    variants: ['HIGH'],
    evaluate(ctx, was) {
      const s = ctx.point('SHOULDER');
      const w = ctx.point('WRIST');
      if (!s || !w) return skipped;
      return leveled(was, angleFromDown(sub(w, s), ctx.down), T.handFromVerticalDeg, [
        ctx.jointName('WRIST'),
        ctx.jointName('SHOULDER'),
      ]);
    },
  },
  {
    id: 'headUp',
    priority: 4,
    severity: 'medium',
    penalty: 1,
    unit: '°',
    evaluate(ctx, was) {
      const ear = ctx.point('EAR');
      const nose = ctx.joint('NOSE');
      if (!ear || !nose) return skipped;
      return leveled(was, angleFromDown(sub(nose, ear), ctx.down), T.gazeFromDownDeg, ['NOSE', ctx.jointName('EAR')]);
    },
  },
  {
    id: 'headDrop',
    priority: 5,
    severity: 'low',
    penalty: 1,
    unit: '°',
    evaluate(ctx, was) {
      const ear = ctx.point('EAR');
      const s = ctx.point('SHOULDER');
      const h = ctx.point('HIP');
      if (!ear || !s || !h) return skipped;
      // Solo la flessione (orecchio SOTTO il prolungamento del busto); l'estensione la giudica headUp.
      const below = offsetFromLineAlongDown(ear, h, s, ctx.down) > 0;
      const angle = below ? angleBetweenVectors(sub(ear, s), sub(s, h)) : 0;
      return leveled(was, angle, T.headDropDeg, [ctx.jointName('EAR')]);
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
  report: {
    // Valori normativi per adulti sani: secondi fino al cedimento tecnico.
    norms: {
      male: [
        { label: 'Insufficiente', minSeconds: 0, description: 'deficit severo di endurance del tronco' },
        { label: 'Sotto la media', minSeconds: 77, description: 'tenuta elementare, rischio di compensi' },
        { label: 'Buono', minSeconds: 107, description: 'stabilità del core adeguata a vita quotidiana e sport' },
        { label: 'Eccellente', minSeconds: 128.5, description: 'ottimo condizionamento della muscolatura posturale' },
      ],
      female: [
        { label: 'Insufficiente', minSeconds: 0, description: 'deficit severo di endurance del tronco' },
        { label: 'Sotto la media', minSeconds: 63, description: 'tenuta elementare, rischio di compensi' },
        { label: 'Buono', minSeconds: 91, description: 'stabilità del core adeguata a vita quotidiana e sport' },
        { label: 'Eccellente', minSeconds: 121.1, description: 'ottimo condizionamento della muscolatura posturale' },
      ],
    },
    notEvaluated: [
      'respirazione (apnea / manovra di Valsalva)',
      'scapole alate o torace che collassa tra le spalle',
      'larghezza dei piedi (serve una ripresa frontale)',
      'attivazione di addominali e glutei',
    ],
    maxUsefulHoldSeconds: 120,
  },
};
