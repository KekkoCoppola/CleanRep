import type { DeviationLevel, ExerciseType, IssueSeverity, JointName, Side } from '../../types/contracts';
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
  /** Metri per unità isotropa (dai landmark mondo): converte le distanze in cm. */
  metersPerUnit: number;
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
  /** Livello della deviazione (default: critical). */
  level?: DeviationLevel;
  /** Misura della deviazione nell'unità della regola. */
  value?: number;
}

export interface ExerciseRule {
  id: string;
  /** 1 = più importante (è la correzione che la voce dice per prima). */
  priority: number;
  severity: IssueSeverity;
  /** Punti sottratti al punteggio 10 per una deviazione critica (metà se tollerabile). */
  penalty: number;
  /** Unità di `RuleResult.value`, per il report. */
  unit?: 'cm' | '°';
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
  /** Frasi vocali per regola (varianti di formulazione alternate). */
  issues: Record<string, string[]>;
  /** Posizione corretta (testo HUD). */
  good: string[];
  variantNames?: Record<string, string>;
  /** Nome esteso del difetto, per il report (es. "Bacino che cede"). */
  labels: Record<string, string>;
  /** Consiglio tecnico per correggerlo, per il report. */
  advice: Record<string, string>;
  /** Distretto corporeo giudicato da ogni regola (per elencare cosa è andato bene). */
  parts: Record<string, string>;
}

/** Fascia di riferimento del tempo di tenuta fino al cedimento tecnico. */
export interface NormBand {
  label: string;
  /** Limite inferiore incluso, in secondi. */
  minSeconds: number;
  description: string;
}

/** Configurazione della valutazione di un video (report). */
export interface HoldReportConfig {
  /** Fasce normative per sesso, ordinate dalla più bassa. */
  norms?: { male: NormBand[]; female: NormBand[] };
  /** Aspetti della rubrica che dalla ripresa non si possono giudicare. */
  notEvaluated: string[];
  /** Secondi oltre i quali la tenuta non aggiunge benefici. */
  maxUsefulHoldSeconds?: number;
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
  report?: HoldReportConfig;
}

/** In futuro: `| RepsExerciseDefinition` (squat, push-up) con contatore ripetizioni. */
export type ExerciseDefinition = HoldExerciseDefinition;
