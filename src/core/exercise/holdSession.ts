import type { EvaluationIssue, EvaluationResult, SessionPhase } from '../../types/contracts';
import { Persistence } from '../filters/hysteresis';
import { StateDebouncer } from '../filters/smoothing';
import { COMMON_MESSAGES } from '../feedback/messages.it';
import type { QualityIssue, StablePose } from '../tracking/types';
import { createContext } from './context';
import type { ExerciseContext, HoldExerciseDefinition } from './types';

export interface HoldSessionConfig {
  /** Quanto bisogna restare "in posizione" prima che il timer parta. */
  enterHoldMs: number;
  /** Quanto si può uscire di posizione prima di andare in pausa. */
  exitHoldMs: number;
  /** Dopo quanto senza persona si torna a NO_SUBJECT. */
  noSubjectMs: number;
  /** Debounce del colore verde/rosso dello scheletro. */
  colorDebounceMs: number;
}

export const DEFAULT_HOLD_SESSION: HoldSessionConfig = {
  enterHoldMs: 800,
  exitHoldMs: 1000,
  noSubjectMs: 1000,
  colorDebounceMs: 400,
};

export interface ActiveIssue extends EvaluationIssue {
  priority: number;
  /** Da quando (ms) la regola è violata senza interruzioni. */
  since: number;
}

export interface HoldSessionState {
  phase: SessionPhase;
  variant: string | undefined;
  /** Tempo totale in posizione (ms). */
  holdMs: number;
  /** Tempo in posizione CORRETTA (ms). */
  correctMs: number;
  inPosition: boolean;
  /** Regole violate ora, ordinate per priorità. */
  issues: ActiveIssue[];
  /** Regole non valutabili ora (giunti non affidabili). */
  skippedRules: string[];
  result: EvaluationResult;
}

/** Ordine con cui si segnalano i problemi di inquadratura. */
export const QUALITY_PRIORITY: QualityIssue[] = [
  'NO_PERSON',
  'CLIPPED',
  'LOW_CONFIDENCE',
  'LOW_LIGHT',
  'TOO_FAR',
  'PHONE_FLAT',
];

/**
 * Macchina a stati di un esercizio statico:
 *   NO_SUBJECT → SETUP → HOLDING ⇄ PAUSED
 * La tecnica viene giudicata SOLO in HOLDING: una persona in piedi, che cammina
 * o si sta sistemando non riceve mai correzioni né complimenti.
 */
export class HoldSession {
  private phase: SessionPhase = 'NO_SUBJECT';
  private variant: string | undefined;
  private holdMs = 0;
  private correctMs = 0;
  private lastT: number | null = null;
  private readonly absent = new Persistence();
  private readonly inPos = new Persistence();
  private readonly outPos = new Persistence();
  private readonly violatedSince = new Map<string, number>();
  private issues: ActiveIssue[] = [];
  private skipped: string[] = [];
  private readonly colors: StateDebouncer;

  constructor(
    private readonly def: HoldExerciseDefinition,
    private readonly config: HoldSessionConfig = DEFAULT_HOLD_SESSION,
  ) {
    this.colors = new StateDebouncer(config.colorDebounceMs);
  }

  update(pose: StablePose, torso: number): HoldSessionState {
    const t = pose.timestamp;
    const dt = this.lastT === null ? 0 : Math.min(Math.max(t - this.lastT, 0), 250);
    this.lastT = t;

    let ctx = createContext(pose, this.variant, torso);
    const present = pose.subjectId !== null && !pose.quality.issues.includes('NO_PERSON');
    const inPosition = present && !pose.quality.blocking && this.def.isInPosition(ctx);
    const absentMs = this.absent.update(!present, t);
    const inMs = this.inPos.update(inPosition, t);
    const outMs = this.outPos.update(!inPosition, t);

    if (absentMs >= this.config.noSubjectMs) {
      this.phase = 'NO_SUBJECT';
    } else if (this.phase !== 'HOLDING' && inMs >= this.config.enterHoldMs) {
      this.phase = 'HOLDING';
      this.variant = this.def.detectVariant?.(ctx, undefined);
    } else if (this.phase === 'HOLDING' && outMs >= this.config.exitHoldMs) {
      this.phase = 'PAUSED';
    } else if (this.phase === 'NO_SUBJECT' && present) {
      this.phase = 'SETUP';
    }

    const holding = this.phase === 'HOLDING';
    if (holding) {
      this.holdMs += dt;
      if (inPosition) {
        if (this.def.detectVariant) {
          this.variant = this.def.detectVariant(ctx, this.variant);
          ctx = createContext(pose, this.variant, torso);
        }
        this.evaluateRules(ctx, t);
      }
      // Fuori posizione per meno di exitHoldMs: si mantiene l'ultimo giudizio.
    } else {
      this.violatedSince.clear();
      this.issues = [];
      this.skipped = [];
    }

    const penalty = this.issues.reduce((s, i) => s + (this.def.rules.find((r) => r.id === i.id)?.penalty ?? 0), 0);
    const isCorrect = holding && this.issues.length === 0;
    if (isCorrect) this.correctMs += dt;
    const applicable = holding ? this.applicableRules().length : 0;
    const evaluatedShare = applicable ? (applicable - this.skipped.length) / applicable : 1;

    const raw: EvaluationResult = {
      isCorrect,
      overallScore: holding ? Math.max(1, 10 - penalty) : 0,
      jointsToColorRed: [...new Set(this.issues.flatMap((i) => i.joints))].sort(),
      audioFeedback: this.hudMessage(pose),
      phase: this.phase,
      variant: holding ? this.variant : undefined,
      confidence: pose.quality.score * evaluatedShare,
      issues: this.issues.map(({ id, severity, joints }) => ({ id, severity, joints })),
    };
    const committed = this.colors.push(raw, t);

    return {
      phase: this.phase,
      variant: this.variant,
      holdMs: this.holdMs,
      correctMs: this.correctMs,
      inPosition,
      issues: this.issues,
      skippedRules: this.skipped,
      result: { ...raw, isCorrect: committed.isCorrect, jointsToColorRed: committed.jointsToColorRed },
    };
  }

  reset(): void {
    this.phase = 'NO_SUBJECT';
    this.variant = undefined;
    this.holdMs = 0;
    this.correctMs = 0;
    this.lastT = null;
    this.absent.reset();
    this.inPos.reset();
    this.outPos.reset();
    this.violatedSince.clear();
    this.issues = [];
    this.skipped = [];
    this.colors.reset();
  }

  private applicableRules() {
    return this.def.rules.filter((r) => !r.variants || (this.variant !== undefined && r.variants.includes(this.variant)));
  }

  private evaluateRules(ctx: ExerciseContext, t: number): void {
    const rules = this.applicableRules();
    const ids = new Set(rules.map((r) => r.id));
    for (const id of [...this.violatedSince.keys()]) if (!ids.has(id)) this.violatedSince.delete(id);
    const issues: ActiveIssue[] = [];
    const skipped: string[] = [];
    for (const rule of rules) {
      const res = rule.evaluate(ctx, this.violatedSince.has(rule.id));
      if (res.status === 'violated') {
        const since = this.violatedSince.get(rule.id) ?? t;
        this.violatedSince.set(rule.id, since);
        issues.push({ id: rule.id, severity: rule.severity, joints: res.joints ?? [], priority: rule.priority, since });
      } else {
        this.violatedSince.delete(rule.id);
        if (res.status === 'skipped') skipped.push(rule.id);
      }
    }
    this.issues = issues.sort((a, b) => a.priority - b.priority);
    this.skipped = skipped;
  }

  /** Testo per l'HUD (la voce la decide il Coach, con i suoi tempi). */
  private hudMessage(pose: StablePose): string {
    const m = this.def.messages;
    switch (this.phase) {
      case 'HOLDING': {
        const top = this.issues[0];
        return top ? (m.issues[top.id]?.[0] ?? m.good[0]) : m.good[0];
      }
      case 'PAUSED':
        return COMMON_MESSAGES.paused[0];
      default: {
        const q = QUALITY_PRIORITY.find((issue) => pose.quality.issues.includes(issue));
        if (q === 'LOW_CONFIDENCE') return m.lowConfidence[0];
        if (q) return COMMON_MESSAGES.quality[q][0];
        return m.setup[0];
      }
    }
  }
}
