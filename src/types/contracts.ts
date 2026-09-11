/**
 * Contratti dati di CleanRep.
 *
 * PoseSnapshot ed EvaluationResult sono il confine stabile dell'app:
 * oggi li consuma il rule engine locale, domani potrebbero viaggiare
 * verso un backend (vedi docs/future-claude-integration.md) senza modifiche.
 */

/** Punto MediaPipe normalizzato: x,y in [0,1] (y cresce verso il basso), z profondità relativa alle anche. */
export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export type JointName =
  | 'NOSE'
  | 'LEFT_EAR'
  | 'RIGHT_EAR'
  | 'LEFT_SHOULDER'
  | 'RIGHT_SHOULDER'
  | 'LEFT_ELBOW'
  | 'RIGHT_ELBOW'
  | 'LEFT_WRIST'
  | 'RIGHT_WRIST'
  | 'LEFT_HIP'
  | 'RIGHT_HIP'
  | 'LEFT_KNEE'
  | 'RIGHT_KNEE'
  | 'LEFT_ANKLE'
  | 'RIGHT_ANKLE'
  | 'LEFT_HEEL'
  | 'RIGHT_HEEL'
  | 'LEFT_FOOT_INDEX'
  | 'RIGHT_FOOT_INDEX';

export type Side = 'LEFT' | 'RIGHT';

export type ExerciseType = 'PLANK';

/** Fasi di una sessione di esercizio statico (hold). */
export type SessionPhase = 'NO_SUBJECT' | 'SETUP' | 'HOLDING' | 'PAUSED';

export type IssueSeverity = 'high' | 'medium' | 'low';

/**
 * Livello della deviazione (rubrica di valutazione del plank):
 * tollerabile = richiamo verbale, critica = cedimento tecnico.
 */
export type DeviationLevel = 'tolerable' | 'critical';

/** Una regola biomeccanica violata in questo momento. */
export interface EvaluationIssue {
  id: string;
  severity: IssueSeverity;
  joints: JointName[];
  level?: DeviationLevel;
  /** Misura della deviazione nell'unità della regola (cm, gradi). */
  value?: number;
}

export interface ComputedAngles {
  /** Angolo spalla–anca–caviglia, media sx/dx (gradi). 180 = corpo perfettamente in linea. */
  bodyLine: number;
  leftHipAngle: number;
  rightHipAngle: number;
  leftKneeAngle: number;
  rightKneeAngle: number;
}

export interface PoseSnapshot {
  exercise: ExerciseType;
  /** Epoch ms del frame. */
  timestamp: number;
  fps: number;
  landmarks: Partial<Record<JointName, LandmarkPoint>>;
  /** Pre-calcolati sul client; se assenti, l'evaluator li calcola dai landmark. */
  computedAngles?: ComputedAngles;
}

export interface EvaluationResult {
  isCorrect: boolean;
  /** 1–10 in posizione; 0 = non valutabile (fuori posizione o posa non affidabile). */
  overallScore: number;
  jointsToColorRed: JointName[];
  /** Frase italiana, massimo 8 parole (testo HUD; la voce la decide il Coach). */
  audioFeedback: string;
  phase: SessionPhase;
  /** Variante riconosciuta (plank: FOREARM | HIGH), solo in HOLDING. */
  variant?: string;
  /** 0–1: affidabilità del giudizio (qualità posa × regole valutabili). */
  confidence: number;
  issues: EvaluationIssue[];
}

/** Interfaccia del motore di valutazione: il rule engine locale la implementa oggi, un eventuale valutatore remoto (Claude) domani. */
export interface Evaluator {
  evaluate(snapshot: PoseSnapshot): EvaluationResult;
}
