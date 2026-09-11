import type { SessionPhase } from '../../types/contracts';
import { Persistence } from '../filters/hysteresis';
import { QUALITY_PRIORITY, type HoldSessionState } from '../exercise/holdSession';
import type { ExerciseMessages } from '../exercise/types';
import type { PoseQuality, QualityIssue } from '../tracking/types';
import { COMMON_MESSAGES } from './messages.it';

export interface Utterance {
  key: string;
  text: string;
  /** true = può interrompere una frase in corso (solo cambi di fase). */
  interrupt: boolean;
}

export interface CoachConfig {
  /** Un errore viene detto solo se persiste almeno così (ms). */
  issueMinMs: number;
  lowSeverityMinMs: number;
  /** Silenzio minimo tra due frasi qualsiasi. */
  globalGapMs: number;
  /** La stessa correzione non viene ripetuta prima di… */
  repeatMs: number;
  lowRepeatMs: number;
  /** Conferma "Bene, così" dopo che l'errore detto è corretto da… */
  praiseAfterMs: number;
  praiseGapMs: number;
  milestoneEveryMs: number;
  /** Istruzioni di inquadratura: persistenza minima e ripetizione. */
  guidanceMinMs: number;
  guidanceRepeatMs: number;
  noPersonRepeatMs: number;
  setupMinMs: number;
  setupRepeatMs: number;
}

export const DEFAULT_COACH: CoachConfig = {
  issueMinMs: 1500,
  lowSeverityMinMs: 3000,
  globalGapMs: 3500,
  repeatMs: 10000,
  lowRepeatMs: 20000,
  praiseAfterMs: 1000,
  praiseGapMs: 15000,
  milestoneEveryMs: 30000,
  guidanceMinMs: 2000,
  guidanceRepeatMs: 8000,
  noPersonRepeatMs: 15000,
  setupMinMs: 3000,
  setupRepeatMs: 12000,
};

/**
 * Decide COSA dire e QUANDO. Principi:
 * - una sola correzione alla volta, la più importante, e solo se l'errore dura;
 * - mai correzioni o complimenti se non si è in posizione (HOLDING);
 * - silenzio se la posa non è affidabile: solo istruzioni di inquadratura;
 * - pause minime tra le frasi e niente ripetizioni ravvicinate.
 * Puro e con tempo iniettato: testabile senza TTS.
 */
export class Coach {
  private lastSpokenAt = -Infinity;
  private readonly lastByKey = new Map<string, number>();
  private readonly rotation = new Map<string, number>();
  private prevPhase: SessionPhase | null = null;
  private spokenIssue: string | null = null;
  private resolvedSince: number | null = null;
  private nextMilestoneMs = 0;
  private readonly qualitySince = new Map<QualityIssue, number>();
  private readonly setup = new Persistence();

  constructor(
    private readonly messages: ExerciseMessages,
    private readonly config: CoachConfig = DEFAULT_COACH,
  ) {}

  /** `speaking` = il TTS sta ancora parlando: in quel caso si aspetta. */
  update(t: number, state: HoldSessionState, quality: PoseQuality, speaking: boolean): Utterance | null {
    const candidate = this.pick(t, state, quality);
    if (!candidate) return null;
    if (!candidate.interrupt && (speaking || t - this.lastSpokenAt < this.config.globalGapMs)) return null;
    this.lastSpokenAt = t;
    this.lastByKey.set(candidate.key, t);
    if (candidate.key.startsWith('issue:')) {
      this.spokenIssue = candidate.key.slice('issue:'.length);
      this.resolvedSince = null;
    } else if (candidate.key === 'praise') {
      this.spokenIssue = null;
    } else if (candidate.key === 'milestone') {
      this.nextMilestoneMs += this.config.milestoneEveryMs;
    }
    return candidate;
  }

  reset(): void {
    this.lastSpokenAt = -Infinity;
    this.lastByKey.clear();
    this.rotation.clear();
    this.prevPhase = null;
    this.spokenIssue = null;
    this.resolvedSince = null;
    this.nextMilestoneMs = 0;
    this.qualitySince.clear();
    this.setup.reset();
  }

  private say(key: string, variants: readonly string[], interrupt: boolean): Utterance | null {
    if (!variants.length) return null;
    const i = this.rotation.get(key) ?? 0;
    this.rotation.set(key, i + 1);
    return { key, text: variants[i % variants.length], interrupt };
  }

  private since(key: string): number {
    return this.lastByKey.get(key) ?? -Infinity;
  }

  private pick(t: number, state: HoldSessionState, quality: PoseQuality): Utterance | null {
    for (const q of QUALITY_PRIORITY) {
      if (quality.issues.includes(q)) {
        if (!this.qualitySince.has(q)) this.qualitySince.set(q, t);
      } else {
        this.qualitySince.delete(q);
      }
    }
    const setupMs = this.setup.update(state.phase === 'SETUP' && !quality.blocking, t);

    if (state.phase !== this.prevPhase) {
      const prev = this.prevPhase;
      this.prevPhase = state.phase;
      if (state.phase === 'HOLDING') {
        const every = this.config.milestoneEveryMs;
        this.nextMilestoneMs = (Math.floor(state.holdMs / every) + 1) * every;
        this.spokenIssue = null;
        return this.say('holdStart', COMMON_MESSAGES.holdStart, true);
      }
      if (state.phase === 'PAUSED' && prev === 'HOLDING') {
        return this.say('paused', COMMON_MESSAGES.paused, true);
      }
    }

    if (state.phase === 'HOLDING') return this.pickHolding(t, state);
    return this.pickGuidance(t, state, setupMs);
  }

  private pickHolding(t: number, state: HoldSessionState): Utterance | null {
    for (const issue of state.issues) {
      const low = issue.severity === 'low';
      if (t - issue.since < (low ? this.config.lowSeverityMinMs : this.config.issueMinMs)) continue;
      const key = `issue:${issue.id}`;
      // La correzione principale è già stata detta da poco: si aspetta, senza passare a errori minori.
      if (t - this.since(key) < (low ? this.config.lowRepeatMs : this.config.repeatMs)) return null;
      return this.say(key, this.messages.issues[issue.id] ?? [], false);
    }
    if (state.issues.length > 0) return null;

    if (this.spokenIssue) {
      this.resolvedSince ??= t;
      if (t - this.resolvedSince >= this.config.praiseAfterMs) {
        if (t - this.since('praise') >= this.config.praiseGapMs) {
          return this.say('praise', COMMON_MESSAGES.praise, false);
        }
        this.spokenIssue = null;
      }
      return null;
    }

    if (state.holdMs >= this.nextMilestoneMs) {
      return {
        key: 'milestone',
        text: COMMON_MESSAGES.milestone(Math.round(this.nextMilestoneMs / 1000)),
        interrupt: false,
      };
    }
    return null;
  }

  private pickGuidance(t: number, state: HoldSessionState, setupMs: number): Utterance | null {
    for (const q of QUALITY_PRIORITY) {
      const since = this.qualitySince.get(q);
      if (since === undefined || t - since < this.config.guidanceMinMs) continue;
      const key = `quality:${q}`;
      const repeat = q === 'NO_PERSON' ? this.config.noPersonRepeatMs : this.config.guidanceRepeatMs;
      if (t - this.since(key) < repeat) return null;
      const variants = q === 'LOW_CONFIDENCE' ? this.messages.lowConfidence : COMMON_MESSAGES.quality[q];
      return this.say(key, variants, false);
    }
    if (
      state.phase === 'SETUP' &&
      setupMs >= this.config.setupMinMs &&
      t - this.since('setup') >= this.config.setupRepeatMs
    ) {
      return this.say('setup', this.messages.setup, false);
    }
    return null;
  }
}
