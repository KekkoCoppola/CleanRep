import type {
  ComputedAngles,
  EvaluationResult,
  JointName,
  LandmarkPoint,
  PoseSnapshot,
} from '../types/contracts';
import { angleBetween3Points, distance, verticalDeviationFromLine } from './geometry';

/** Soglie biomeccaniche del plank (coordinate normalizzate / gradi). */
export const PLANK_THRESHOLDS = {
  /**
   * Visibilità minima per considerare affidabile un landmark. Bassa di proposito:
   * nella ripresa di lato il lato lontano dalla camera è semi-occluso e MediaPipe
   * assegna visibilità modeste anche a tracking corretti.
   */
  minVisibility: 0.3,
  /** Sotto questo angolo spalla–anca–caviglia la linea del corpo è rotta. */
  minBodyLineAngle: 160,
  /**
   * Deviazione verticale dell'anca dalla retta spalla–caviglia, normalizzata
   * sulla lunghezza spalla–caviglia. Cattura i cedimenti moderati del bacino
   * che l'angolo da solo non vede (es. 166° ma anca chiaramente fuori linea).
   */
  maxHipDeviationRatio: 0.04,
  /** Sotto questo angolo anca–ginocchio–caviglia le gambe sono piegate. */
  minKneeAngle: 160,
  /** Scostamento orizzontale massimo gomito–spalla (frazione della larghezza frame). */
  maxElbowShoulderOffsetX: 0.1,
} as const;

const PENALTY = { bodyLine: 4, knees: 2, elbows: 2 } as const;

export const FEEDBACK = {
  notVisible: 'Mettiti di lato alla camera',
  hipSag: 'Alza il bacino, sei troppo basso',
  hipPike: 'Abbassa il bacino, corpo in linea',
  bentKnees: 'Distendi le gambe',
  elbows: 'Porta i gomiti sotto le spalle',
  correct: 'Ottima linea, mantieni la posizione',
} as const;

type Side = 'LEFT' | 'RIGHT';
const SIDES: Side[] = ['LEFT', 'RIGHT'];

interface SideAnalysis {
  side: Side;
  /** Visibilità media di spalla, anca, ginocchio e caviglia del lato. */
  visibility: number;
  shoulder: LandmarkPoint;
  hip: LandmarkPoint;
  knee: LandmarkPoint;
  ankle: LandmarkPoint;
  hipAngle: number;
  kneeAngle: number;
}

function getVisible(
  landmarks: PoseSnapshot['landmarks'],
  name: JointName,
): LandmarkPoint | undefined {
  const lm = landmarks[name];
  if (!lm || lm.visibility < PLANK_THRESHOLDS.minVisibility) return undefined;
  return lm;
}

/**
 * Analizza un lato del corpo. Ritorna undefined se il lato non è utilizzabile
 * (di lato alla camera il lato lontano è spesso occluso: è normale e non è un errore).
 */
function analyzeSide(landmarks: PoseSnapshot['landmarks'], side: Side): SideAnalysis | undefined {
  const shoulder = getVisible(landmarks, `${side}_SHOULDER`);
  const hip = getVisible(landmarks, `${side}_HIP`);
  const knee = getVisible(landmarks, `${side}_KNEE`);
  const ankle = getVisible(landmarks, `${side}_ANKLE`);
  if (!shoulder || !hip || !knee || !ankle) return undefined;
  return {
    side,
    visibility: (shoulder.visibility + hip.visibility + knee.visibility + ankle.visibility) / 4,
    shoulder,
    hip,
    knee,
    ankle,
    hipAngle: angleBetween3Points(shoulder, hip, ankle),
    kneeAngle: angleBetween3Points(hip, knee, ankle),
  };
}

function usableSides(landmarks: PoseSnapshot['landmarks']): SideAnalysis[] {
  return SIDES.map((s) => analyzeSide(landmarks, s)).filter((s): s is SideAnalysis => !!s);
}

/**
 * Calcola gli angoli del plank dai landmark, usando i soli lati visibili.
 * Ritorna undefined solo se NESSUN lato è utilizzabile.
 * Il lato occluso eredita gli angoli di quello visibile (non penalizza né assolve).
 */
export function computePlankAngles(
  landmarks: PoseSnapshot['landmarks'],
): ComputedAngles | undefined {
  const sides = usableSides(landmarks);
  if (sides.length === 0) return undefined;
  const left = sides.find((s) => s.side === 'LEFT');
  const right = sides.find((s) => s.side === 'RIGHT');
  const leftHipAngle = (left ?? right)!.hipAngle;
  const rightHipAngle = (right ?? left)!.hipAngle;
  return {
    bodyLine: sides.reduce((sum, s) => sum + s.hipAngle, 0) / sides.length,
    leftHipAngle,
    rightHipAngle,
    leftKneeAngle: (left ?? right)!.kneeAngle,
    rightKneeAngle: (right ?? left)!.kneeAngle,
  };
}

/**
 * Valuta un singolo snapshot di plank. Puro e senza stato: lo smoothing
 * temporale (EMA + debounce) vive in evaluator.ts.
 */
export function evaluatePlank(snapshot: PoseSnapshot): EvaluationResult {
  const { landmarks } = snapshot;
  const sides = usableSides(landmarks);
  if (sides.length === 0) {
    return {
      isCorrect: false,
      overallScore: 0,
      jointsToColorRed: [],
      audioFeedback: FEEDBACK.notVisible,
    };
  }
  // Lato dominante: quello con la visibilità migliore (il più affidabile per la geometria fine).
  const primary = sides.reduce((a, b) => (b.visibility > a.visibility ? b : a));
  const angles =
    snapshot.computedAngles ??
    computePlankAngles(landmarks) ?? {
      bodyLine: primary.hipAngle,
      leftHipAngle: primary.hipAngle,
      rightHipAngle: primary.hipAngle,
      leftKneeAngle: primary.kneeAngle,
      rightKneeAngle: primary.kneeAngle,
    };

  const red = new Set<JointName>();
  let score = 10;
  let feedback: string | undefined;

  // Regola principale: linea spalla–anca–caviglia. Due criteri complementari:
  // l'angolo (rotture nette) e la deviazione normalizzata dell'anca dalla retta
  // spalla–caviglia del lato dominante (cedimenti moderati ma visibili).
  const span = distance(primary.shoulder, primary.ankle);
  const deviation = verticalDeviationFromLine(primary.hip, primary.shoulder, primary.ankle);
  const deviationRatio = span > 0 ? deviation / span : 0;
  const brokenAngle = angles.bodyLine < PLANK_THRESHOLDS.minBodyLineAngle;
  const brokenDeviation = Math.abs(deviationRatio) > PLANK_THRESHOLDS.maxHipDeviationRatio;
  if (brokenAngle || brokenDeviation) {
    red.add('LEFT_HIP');
    red.add('RIGHT_HIP');
    score -= PENALTY.bodyLine;
    // y cresce verso il basso: deviazione positiva = bacino sotto la linea (cede).
    feedback = deviation > 0 ? FEEDBACK.hipSag : FEEDBACK.hipPike;
  }

  // Ginocchia distese (solo sui lati visibili).
  let kneesBent = false;
  for (const s of sides) {
    if (s.kneeAngle < PLANK_THRESHOLDS.minKneeAngle) {
      red.add(`${s.side}_KNEE`);
      kneesBent = true;
    }
  }
  if (kneesBent) {
    score -= PENALTY.knees;
    feedback ??= FEEDBACK.bentKnees;
  }

  // Gomiti sotto le spalle (plank su avambracci), solo se il gomito del lato è visibile.
  let elbowsOff = false;
  for (const s of sides) {
    const elbow = getVisible(landmarks, `${s.side}_ELBOW`);
    if (!elbow) continue;
    if (Math.abs(elbow.x - s.shoulder.x) > PLANK_THRESHOLDS.maxElbowShoulderOffsetX) {
      red.add(`${s.side}_ELBOW`);
      elbowsOff = true;
    }
  }
  if (elbowsOff) {
    score -= PENALTY.elbows;
    feedback ??= FEEDBACK.elbows;
  }

  const isCorrect = red.size === 0;
  return {
    isCorrect,
    overallScore: isCorrect ? 10 : Math.max(1, score),
    jointsToColorRed: [...red].sort(),
    audioFeedback: feedback ?? FEEDBACK.correct,
  };
}
