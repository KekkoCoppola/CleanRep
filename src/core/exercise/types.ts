import type { ExerciseType, IssueSeverity, JointName, Side } from '../../types/contracts';
import type { OneEuroParams } from '../filters/oneEuro';
import type { Vec2 } from '../geometry/vector';
import type { StablePose } from '../tracking/types';

/** Tutto ciò che una regola può sapere della posa corrente (spazio isotropo). */
export interface ExerciseContext {
  pose: StablePose;
  /** Direzione della gravità (unitaria). */
  down: Vec2;
  /** Lato usato per la geometria: quello rivolto alla camera. */
  side: Side;
  variant: string | undefined;
  /** Lunghezza del torso: unità naturale per normalizzare le soglie. */
  torso: number;
  /** Punto isotropo della parte (es. 'HIP') sul lato vicino, o sul lontano se il vicino non è affidabile. */
  point(part: string): Vec2 | undefined;
  /** Punto isotropo di un giunto qualsiasi, solo se affidabile. */
  joint(name: JointName): Vec2 | undefined;
  /** Nome del giunto effettivamente usato da point(part) (per colorarlo). */
  jointName(part: string): JointName;
}

export type RuleStatus = 'ok' | 'violated' | 'skipped';

export interface RuleResult {
  status: RuleStatus;
  /** Giunti da colorare in rosso se violata. */
  joints?: JointName[];
}

export interface ExerciseRule {
  id: string;
  /** 1 = più importante (è la correzione che la voce dice per prima). */
  priority: number;
  severity: IssueSeverity;
  /** Punti sottratti al punteggio 10. */
  penalty: number;
  /** Varianti dell'esercizio a cui si applica (tutte se assente). */
  variants?: string[];
  /**
   * `wasViolated` permette l'isteresi: soglie diverse per entrare e uscire.
   * Se i giunti necessari non sono affidabili ritorna 'skipped' (MAI 'violated').
   */
  evaluate(ctx: ExerciseContext, wasViolated: boolean): RuleResult;
}

export interface ExerciseMessages {
  /** Invito a mettersi in posizione. */
  setup: string[];
  /** Se il corpo non si vede bene (es. "Mettiti di lato alla camera"). */
  lowConfidence: string[];
  /** Frasi per regola (varianti di formulazione alternate). */
  issues: Record<string, string[]>;
  /** Posizione corretta (testo HUD). */
  good: string[];
  variantNames?: Record<string, string>;
}

/** Esercizio statico a tenuta (plank, wall sit, hollow hold…). */
export interface HoldExerciseDefinition {
  id: ExerciseType;
  kind: 'hold';
  name: string;
  cameraSetup: 'side' | 'front';
  filter: OneEuroParams;
  /** Velocità massima plausibile dei giunti (torsi/s) per il gate anti-salto. */
  maxJointSpeed: number;
  isInPosition(ctx: ExerciseContext): boolean;
  detectVariant?(ctx: ExerciseContext, current: string | undefined): string | undefined;
  rules: ExerciseRule[];
  messages: ExerciseMessages;
}

/** In futuro: `| RepsExerciseDefinition` (squat, push-up) con contatore ripetizioni. */
export type ExerciseDefinition = HoldExerciseDefinition;
