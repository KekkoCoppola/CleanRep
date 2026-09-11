import type { DeviationLevel, JointName, Side } from '../../types/contracts';
import { DEFAULT_TORSO_METERS } from '../exercise/context';
import type { HoldExerciseDefinition, NormBand } from '../exercise/types';
import { dist, dot, toIso, type Vec2 } from '../geometry/vector';
import type { PipelineOutput } from '../pipeline';
import type { StablePose } from '../tracking/types';

/**
 * Valutazione di un video di esercizio statico secondo la metodologia del test
 * da campo del plank:
 * - il cronometro parte quando il corpo è in posizione, allineato e stabile;
 * - alla prima deviazione evidente scatta il richiamo e ci sono 3 s per ripristinare;
 * - il test termina se il soggetto non ripristina, se c'è una seconda deviazione
 *   o se il corpo collassa (ginocchia/bacino a terra).
 * Il tempo registrato è il "tempo valido fino al cedimento tecnico". L'analisi dei
 * difetti prosegue comunque su tutto il video, per dire cosa migliorare.
 */

export type Sex = 'male' | 'female';

export interface ReportOptions {
  durationMs: number;
  sex?: Sex;
}

export type EndReason = 'not_restored' | 'second_deviation' | 'collapse' | 'tracking_lost' | 'video_end' | 'none';

export interface ProtocolResult {
  /** Inizio del cronometro (ms del video); null = mai in posizione. */
  startMs: number | null;
  endMs: number | null;
  validHoldMs: number;
  endReason: EndReason;
  /** Difetto che ha causato il cedimento tecnico. */
  endIssueId: string | null;
  warnings: Array<{ atMs: number; issueId: string; restored: boolean }>;
}

export interface ReportIssue {
  id: string;
  label: string;
  advice: string;
  unit: string;
  level: DeviationLevel;
  /** true se un difetto tollerabile non è stato corretto entro 3 s. */
  escalated: boolean;
  totalMs: number;
  episodes: number;
  firstAtMs: number;
  peakValue: number;
  peakAtMs: number;
  snapshotKey: string | null;
}

export interface Rating {
  sex: Sex;
  band: NormBand;
  nextBand: NormBand | null;
  /** Il video finisce senza cedimento: il livello reale è almeno questo. */
  atLeast: boolean;
}

export interface ReportSnapshot {
  key: string;
  atMs: number;
  issueId: string | null;
  caption: string;
}

export interface HoldReport {
  exercise: string;
  variant: string | null;
  variantName: string | null;
  durationMs: number;
  analyzedFrames: number;
  inPositionMs: number;
  protocol: ProtocolResult;
  issues: ReportIssue[];
  /** Distretti giudicati senza difetti. */
  positives: string[];
  /** Quota di frame con posa affidabile (0–1). */
  reliability: number;
  ratings: Rating[];
  notEvaluated: string[];
  snapshots: ReportSnapshot[];
  summary: string;
}

/** Richiesta alla piattaforma: cattura QUESTO frame (immagine + scheletro) con questa chiave. */
export interface SnapshotRequest {
  key: string;
  issueId: string | null;
  joints: JointName[];
  caption: string;
}

/** Un difetto che sparisce per meno di così continua lo stesso episodio. */
const GAP_MS = 500;
/** Durata minima di un episodio per finire nel report (sotto è rumore). */
const MIN_TOLERABLE_MS = 700;
const MIN_CRITICAL_MS = 500;
/** Protocollo: finestra per ripristinare dopo il richiamo; tollerabile non corretto = deviazione. */
const RESTORE_MS = 3000;
const ESCALATE_MS = 3000;
/** Posizione pulita per almeno così = deviazione rientrata. */
const CLEAN_MS = 300;
const SNAPSHOT_MIN_AGE_MS = 500;
const SNAPSHOT_EVERY_MS = 250;
/**
 * Uscita dalla posizione (rialzarsi, ginocchia a terra): i "difetti" nati in
 * questa finestra prima dell'uscita sono il movimento di uscita, non la tenuta.
 */
const EXIT_WINDOW_MS = 1500;
/** Piedi che scivolano (aumento della distanza appoggi, cm) e oscillazioni del bacino (cm). */
const FEET_SLIDE_CM = { tolerable: 6, critical: 12 };
const SWAY_CM = 1.5;

interface Episode {
  id: string;
  index: number;
  startMs: number;
  lastSeenMs: number;
  critical: boolean;
  escalated: boolean;
  peakValue: number;
  peakAtMs: number;
  snapValue: number;
  snapAt: number;
  snapTaken: boolean;
}

interface SnapshotMeta {
  atMs: number;
  issueId: string | null;
  value: number;
  caption: string;
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const r = s % 60;
  return r ? `${Math.floor(s / 60)} min ${r} s` : `${Math.floor(s / 60)} min`;
}

function formatValue(value: number, unit: string): string {
  const v = unit === 'cm' ? Math.round(value) : Math.round(value);
  return unit === '°' ? `${v}°` : `${v} ${unit}`;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function std(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

function nearPoint(pose: StablePose, part: string): Vec2 | undefined {
  const sides: Side[] = pose.nearSide === 'RIGHT' ? ['RIGHT', 'LEFT'] : ['LEFT', 'RIGHT'];
  for (const side of sides) {
    const j = pose.joints[`${side}_${part}` as JointName];
    if (j && j.state !== 'lost' && j.confidence >= 0.4) return toIso(j, pose.aspect);
  }
  return undefined;
}

export class HoldReportBuilder {
  private frames = 0;
  private usableFrames = 0;
  private lastT: number | null = null;
  private holdMs = 0;
  private readonly variantMs = new Map<string, number>();
  private inPosSince: number | null = null;
  private outSince: number | null = null;
  private outBlocked = false;
  private prevPhase: PipelineOutput['state']['phase'] | null = null;
  /** Istanti in cui il corpo ha iniziato a uscire dalla posizione (poi confermato da HOLDING → pausa). */
  private readonly exits: number[] = [];

  private readonly open = new Map<string, Episode>();
  private readonly closed: Episode[] = [];
  private readonly episodeCount = new Map<string, number>();

  private evalFrames = 0;
  private readonly evaluated = new Map<string, number>();

  private protoState: 'waiting' | 'running' | 'warned' | 'restored' | 'ended' = 'waiting';
  private readonly proto: ProtocolResult = {
    startMs: null,
    endMs: null,
    validHoldMs: 0,
    endReason: 'none',
    endIssueId: null,
    warnings: [],
  };
  private critRun: { since: number; issueId: string } | null = null;
  private cleanSince: number | null = null;
  private lastHoldingT: number | null = null;

  private readonly supportSamples: Array<{ t: number; cm: number }> = [];
  private feetBaseline: number | null = null;
  private feetMax = 0;
  private feetMaxAt = 0;
  private feetSnapValue = 0;
  private readonly swaySamples: Array<{ t: number; cm: number }> = [];

  private refScore = -1;
  private refAt = -Infinity;
  private readonly snapshots = new Map<string, SnapshotMeta>();

  constructor(
    private readonly def: HoldExerciseDefinition,
    private readonly options: ReportOptions,
  ) {}

  /** Da chiamare per ogni frame analizzato; se ritorna una richiesta, la piattaforma cattura il frame. */
  add(out: PipelineOutput): SnapshotRequest | null {
    const { pose, state } = out;
    const t = pose.timestamp;
    const dt = this.lastT === null ? 0 : Math.min(Math.max(t - this.lastT, 0), 500);
    this.lastT = t;
    this.frames += 1;
    if (!pose.quality.blocking) this.usableFrames += 1;

    const holding = state.phase === 'HOLDING';
    if (holding) {
      this.holdMs += dt;
      this.lastHoldingT = t;
      if (state.variant) this.variantMs.set(state.variant, (this.variantMs.get(state.variant) ?? 0) + dt);
    }
    if (state.inPosition) {
      this.inPosSince ??= t;
      this.outSince = null;
    } else {
      if (this.outSince === null) {
        this.outSince = t;
        this.outBlocked = pose.quality.blocking;
      }
      this.inPosSince = null;
    }
    if (this.prevPhase === 'HOLDING' && !holding) this.exits.push(this.outSince ?? t);
    this.prevPhase = state.phase;

    if (holding && state.inPosition) {
      this.evalFrames += 1;
      for (const rule of this.applicableRules(state.variant)) {
        if (!state.skippedRules.includes(rule.id)) this.evaluated.set(rule.id, (this.evaluated.get(rule.id) ?? 0) + 1);
      }
    }

    const active = holding ? state.issues : [];
    this.updateEpisodes(active, t);
    const criticalNow = active.some((i) => i.level === 'critical' || this.open.get(i.id)?.escalated);
    this.updateCriticalRun(criticalNow, active, t);
    this.updateProtocol(state.phase, t);
    const mpu = out.metersPerUnit > 0 ? out.metersPerUnit : null;
    if (holding && state.inPosition) this.updateMetrics(pose, state.variant, mpu, t);

    return this.pickSnapshot(out, t);
  }

  /** `durationMs`: durata effettiva, se all'inizio non era nota. */
  finish(durationMs: number = this.options.durationMs): HoldReport {
    for (const ep of this.open.values()) this.closed.push(ep);
    this.open.clear();
    if (this.protoState === 'running' || this.protoState === 'warned' || this.protoState === 'restored') {
      this.endProtocol(this.lastHoldingT ?? this.proto.startMs ?? 0, 'video_end', null);
    }
    // Una "seconda deviazione" nata mentre ci si rialza è l'uscita dalla posizione, non un difetto di tenuta.
    const endMs = this.proto.endMs;
    if (this.proto.endReason === 'second_deviation' && endMs !== null) {
      const exit = this.exits.find((e) => endMs >= e - EXIT_WINDOW_MS && endMs <= e + GAP_MS);
      if (exit !== undefined) this.endProtocol(exit, 'collapse', null);
    }

    const issues = this.aggregateIssues();
    const variant = [...this.variantMs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const issueIds = new Set(issues.map((i) => i.id));
    const positives = [
      ...new Set(
        this.applicableRules(variant ?? undefined)
          .filter((r) => this.evalFrames > 0 && (this.evaluated.get(r.id) ?? 0) / this.evalFrames >= 0.5)
          .filter((r) => !issueIds.has(r.id))
          .map((r) => this.def.messages.parts[r.id])
          .filter((p): p is string => !!p),
      ),
    ].filter((part) => !issues.some((i) => this.def.messages.parts[i.id] === part));

    const snapshots: ReportSnapshot[] = [];
    for (const issue of issues) {
      const meta = issue.snapshotKey ? this.snapshots.get(issue.snapshotKey) : undefined;
      if (issue.snapshotKey && meta) {
        snapshots.push({ key: issue.snapshotKey, atMs: meta.atMs, issueId: issue.id, caption: meta.caption });
      }
    }
    const ref = this.snapshots.get('reference');
    if (snapshots.length === 0 && ref) snapshots.push({ key: 'reference', atMs: ref.atMs, issueId: null, caption: ref.caption });

    const report: HoldReport = {
      exercise: this.def.name,
      variant,
      variantName: variant ? (this.def.messages.variantNames?.[variant] ?? variant) : null,
      durationMs,
      analyzedFrames: this.frames,
      inPositionMs: this.holdMs,
      protocol: this.proto,
      issues,
      positives,
      reliability: this.frames ? this.usableFrames / this.frames : 0,
      ratings: this.ratings(),
      notEvaluated: this.def.report?.notEvaluated ?? [],
      snapshots,
      summary: '',
    };
    report.summary = buildSummary(report, this.def.report?.maxUsefulHoldSeconds);
    return report;
  }

  // ---------------------------------------------------------------- episodi

  private applicableRules(variant: string | undefined) {
    return this.def.rules.filter((r) => !r.variants || (variant !== undefined && r.variants.includes(variant)));
  }

  private updateEpisodes(active: PipelineOutput['state']['issues'], t: number): void {
    const seen = new Set<string>();
    for (const issue of active) {
      seen.add(issue.id);
      let ep = this.open.get(issue.id);
      if (!ep) {
        const index = this.episodeCount.get(issue.id) ?? 0;
        this.episodeCount.set(issue.id, index + 1);
        ep = {
          id: issue.id,
          index,
          startMs: t,
          lastSeenMs: t,
          critical: false,
          escalated: false,
          peakValue: -Infinity,
          peakAtMs: t,
          snapValue: -Infinity,
          snapAt: -Infinity,
          snapTaken: false,
        };
        this.open.set(issue.id, ep);
      }
      ep.lastSeenMs = t;
      if (issue.level === 'critical') ep.critical = true;
      const value = issue.value ?? 0;
      if (value > ep.peakValue) {
        ep.peakValue = value;
        ep.peakAtMs = t;
      }
      if (!ep.critical && !ep.escalated && t - ep.startMs >= ESCALATE_MS) ep.escalated = true;
    }
    for (const [id, ep] of this.open) {
      if (!seen.has(id) && t - ep.lastSeenMs > GAP_MS) {
        this.closed.push(ep);
        this.open.delete(id);
      }
    }
  }

  private aggregateIssues(): ReportIssue[] {
    const byId = new Map<string, Episode[]>();
    for (const ep of this.closed) {
      const serious = ep.critical || ep.escalated;
      if (ep.lastSeenMs - ep.startMs < (serious ? MIN_CRITICAL_MS : MIN_TOLERABLE_MS)) continue;
      if (this.exits.some((exit) => ep.startMs >= exit - EXIT_WINDOW_MS && ep.startMs <= exit + GAP_MS)) continue;
      byId.set(ep.id, [...(byId.get(ep.id) ?? []), ep]);
    }
    const issues: ReportIssue[] = [];
    for (const [id, eps] of byId) {
      const rule = this.def.rules.find((r) => r.id === id);
      const worst = eps.reduce((a, b) => (b.peakValue > a.peakValue ? b : a));
      const withSnap = [...eps].sort((a, b) => b.peakValue - a.peakValue).find((e) => this.snapshots.has(this.key(e)));
      issues.push({
        id,
        label: this.def.messages.labels[id] ?? id,
        advice: this.def.messages.advice[id] ?? '',
        unit: rule?.unit ?? '',
        level: eps.some((e) => e.critical || e.escalated) ? 'critical' : 'tolerable',
        escalated: eps.some((e) => e.escalated && !e.critical),
        totalMs: eps.reduce((s, e) => s + (e.lastSeenMs - e.startMs), 0),
        episodes: eps.length,
        firstAtMs: Math.min(...eps.map((e) => e.startMs)),
        peakValue: worst.peakValue,
        peakAtMs: worst.peakAtMs,
        snapshotKey: withSnap ? this.key(withSnap) : null,
      });
    }
    issues.push(...this.metricIssues());
    return issues.sort((a, b) => {
      if (a.level !== b.level) return a.level === 'critical' ? -1 : 1;
      return b.totalMs - a.totalMs;
    });
  }

  private key(ep: Episode): string {
    return `${ep.id}#${ep.index}`;
  }

  // ------------------------------------------------------------- protocollo

  private updateCriticalRun(criticalNow: boolean, active: PipelineOutput['state']['issues'], t: number): void {
    if (criticalNow) {
      this.cleanSince = null;
      if (!this.critRun) {
        const top = active.find((i) => i.level === 'critical' || this.open.get(i.id)?.escalated)!;
        this.critRun = { since: t, issueId: top.id };
      }
    } else {
      this.cleanSince ??= t;
      if (this.critRun && t - this.cleanSince >= CLEAN_MS) this.critRun = null;
    }
  }

  private updateProtocol(phase: PipelineOutput['state']['phase'], t: number): void {
    const deviation = this.critRun && t - this.critRun.since >= MIN_CRITICAL_MS ? this.critRun : null;
    const exited = () => {
      if (phase === 'HOLDING') return false;
      this.endProtocol(this.outSince ?? t, this.outBlocked ? 'tracking_lost' : 'collapse', null);
      return true;
    };
    switch (this.protoState) {
      case 'waiting':
        if (phase === 'HOLDING') {
          this.proto.startMs = this.inPosSince ?? t;
          this.protoState = 'running';
        }
        break;
      case 'running':
        if (exited()) break;
        if (deviation) {
          this.protoState = 'warned';
          this.proto.warnings.push({ atMs: deviation.since, issueId: deviation.issueId, restored: false });
        }
        break;
      case 'warned': {
        if (exited()) break;
        const warning = this.proto.warnings[this.proto.warnings.length - 1];
        if (!this.critRun) {
          warning.restored = true;
          this.protoState = 'restored';
        } else if (t - warning.atMs >= RESTORE_MS) {
          this.endProtocol(warning.atMs + RESTORE_MS, 'not_restored', warning.issueId);
        }
        break;
      }
      case 'restored':
        if (exited()) break;
        if (deviation) this.endProtocol(deviation.since, 'second_deviation', deviation.issueId);
        break;
      case 'ended':
        break;
    }
  }

  private endProtocol(atMs: number, reason: EndReason, issueId: string | null): void {
    this.protoState = 'ended';
    this.proto.endMs = atMs;
    this.proto.endReason = reason;
    this.proto.endIssueId = issueId;
    this.proto.validHoldMs = Math.max(0, atMs - (this.proto.startMs ?? atMs));
  }

  // ---------------------------------------------------------------- metriche

  private updateMetrics(pose: StablePose, variant: string | undefined, mpu: number | null, t: number): void {
    const hip = nearPoint(pose, 'HIP');
    const ankle = nearPoint(pose, 'ANKLE');
    const support = nearPoint(pose, variant === 'HIGH' ? 'WRIST' : 'ELBOW');
    const toCm = (units: number) => units * (mpu ?? DEFAULT_TORSO_METERS / 0.25) * 100;
    if (hip) this.swaySamples.push({ t, cm: toCm(dot(hip, pose.down)) });
    if (!ankle || !support) return;
    this.supportSamples.push({ t, cm: toCm(dist(ankle, support)) });
    const start = this.supportSamples[0].t;
    if (this.feetBaseline === null) {
      if (t - start >= 1000) this.feetBaseline = median(this.supportSamples.map((s) => s.cm));
      return;
    }
    const recent = this.supportSamples.filter((s) => t - s.t <= 500).map((s) => s.cm);
    const slide = median(recent) - this.feetBaseline;
    if (slide > this.feetMax) {
      this.feetMax = slide;
      this.feetMaxAt = t;
    }
  }

  private metricIssues(): ReportIssue[] {
    const out: ReportIssue[] = [];
    const m = this.def.messages;
    if (this.feetMax >= FEET_SLIDE_CM.tolerable) {
      out.push({
        id: 'feetSliding',
        label: m.labels.feetSliding ?? 'Piedi che scivolano',
        advice: m.advice.feetSliding ?? '',
        unit: 'cm',
        level: this.feetMax >= FEET_SLIDE_CM.critical ? 'critical' : 'tolerable',
        escalated: false,
        totalMs: 0,
        episodes: 1,
        firstAtMs: this.feetMaxAt,
        peakValue: Math.round(this.feetMax * 10) / 10,
        peakAtMs: this.feetMaxAt,
        snapshotKey: this.snapshots.has('feetSliding#0') ? 'feetSliding#0' : null,
      });
    }
    const sway = this.swayPeak();
    if (sway !== null && sway >= SWAY_CM) {
      out.push({
        id: 'instability',
        label: m.labels.instability ?? 'Oscillazioni del corpo',
        advice: m.advice.instability ?? '',
        unit: 'cm',
        level: 'tolerable',
        escalated: false,
        totalMs: 0,
        episodes: 1,
        firstAtMs: 0,
        peakValue: Math.round(sway * 10) / 10,
        peakAtMs: 0,
        snapshotKey: null,
      });
    }
    return out;
  }

  /** Oscillazione verticale del bacino: 90° percentile della deviazione standard su finestre di 2 s. */
  private swayPeak(): number | null {
    if (this.swaySamples.length < 20) return null;
    const windows: number[] = [];
    let start = 0;
    for (let i = 0; i < this.swaySamples.length; i++) {
      if (this.swaySamples[i].t - this.swaySamples[start].t >= 2000) {
        const w = this.swaySamples.slice(start, i).map((s) => s.cm);
        if (w.length >= 8) windows.push(std(w));
        start = i;
      }
    }
    if (!windows.length) return null;
    const sorted = windows.sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))];
  }

  // -------------------------------------------------------------- snapshot

  private pickSnapshot(out: PipelineOutput, t: number): SnapshotRequest | null {
    const { state, pose } = out;
    if (state.phase !== 'HOLDING') return null;
    const candidates = state.issues
      .map((issue) => ({ issue, ep: this.open.get(issue.id)! }))
      .filter(({ issue, ep }) => {
        if (!ep || t - ep.startMs < SNAPSHOT_MIN_AGE_MS || t - ep.snapAt < SNAPSHOT_EVERY_MS) return false;
        return !ep.snapTaken || (issue.value ?? 0) > ep.snapValue * 1.05 + 0.2;
      })
      .sort((a, b) => a.issue.priority - b.issue.priority);
    const pick = candidates[0];
    if (pick) {
      const { issue, ep } = pick;
      const value = issue.value ?? 0;
      ep.snapTaken = true;
      ep.snapValue = value;
      ep.snapAt = t;
      const unit = this.def.rules.find((r) => r.id === issue.id)?.unit ?? '';
      const caption = `${this.def.messages.labels[issue.id] ?? issue.id} · ${formatClock(t)}${
        unit ? ` · ${formatValue(value, unit)}` : ''
      }`;
      const key = this.key(ep);
      this.snapshots.set(key, { atMs: t, issueId: issue.id, value, caption });
      return { key, issueId: issue.id, joints: issue.joints, caption };
    }

    if (this.feetMax >= FEET_SLIDE_CM.tolerable && this.feetMax > this.feetSnapValue + 0.5 && t === this.feetMaxAt) {
      this.feetSnapValue = this.feetMax;
      const caption = `${this.def.messages.labels.feetSliding ?? 'Piedi che scivolano'} · ${formatClock(t)} · ${formatValue(this.feetMax, 'cm')}`;
      this.snapshots.set('feetSliding#0', { atMs: t, issueId: 'feetSliding', value: this.feetMax, caption });
      const foot: JointName[] = pose.nearSide === 'RIGHT' ? ['RIGHT_ANKLE', 'RIGHT_FOOT_INDEX'] : ['LEFT_ANKLE', 'LEFT_FOOT_INDEX'];
      return { key: 'feetSliding#0', issueId: 'feetSliding', joints: foot, caption };
    }

    const startMs = this.proto.startMs ?? t;
    if (
      state.inPosition &&
      state.issues.length === 0 &&
      t - startMs >= 2000 &&
      t - this.refAt >= 1000 &&
      pose.quality.score > this.refScore + 0.03
    ) {
      this.refScore = pose.quality.score;
      this.refAt = t;
      const caption = `Posizione di riferimento · ${formatClock(t)}`;
      this.snapshots.set('reference', { atMs: t, issueId: null, value: 0, caption });
      return { key: 'reference', issueId: null, joints: [], caption };
    }
    return null;
  }

  // ---------------------------------------------------------------- livelli

  private ratings(): Rating[] {
    const norms = this.def.report?.norms;
    const p = this.proto;
    if (!norms || p.startMs === null || p.endReason === 'tracking_lost') return [];
    const seconds = p.validHoldMs / 1000;
    const atLeast = p.endReason === 'video_end';
    const sexes: Sex[] = this.options.sex ? [this.options.sex] : ['male', 'female'];
    return sexes.map((sex) => {
      const bands = norms[sex];
      let idx = 0;
      bands.forEach((b, i) => {
        if (seconds >= b.minSeconds) idx = i;
      });
      return { sex, band: bands[idx], nextBand: bands[idx + 1] ?? null, atLeast };
    });
  }
}

// ------------------------------------------------------------------- testo

const SEX_LABEL: Record<Sex, string> = { male: 'uomini', female: 'donne' };

function endSentence(r: HoldReport, labelOf: (id: string | null) => string): string {
  const p = r.protocol;
  const at = p.endMs !== null ? formatClock(p.endMs) : '';
  switch (p.endReason) {
    case 'not_restored':
      return `cedimento tecnico a ${at}: difetto non corretto entro 3 secondi dal richiamo (${labelOf(p.endIssueId).toLowerCase()}).`;
    case 'second_deviation':
      return `cedimento tecnico a ${at}: seconda deviazione dopo il richiamo a ${formatClock(p.warnings[0]?.atMs ?? 0)} (${labelOf(p.endIssueId).toLowerCase()}).`;
    case 'collapse':
      return `a ${at} il corpo esce dalla posizione (ginocchia o bacino verso terra).`;
    case 'tracking_lost':
      return `da ${at} la persona non è più valutabile nel video (inquadratura o luce), il tempo è parziale.`;
    case 'video_end': {
      const restored = p.warnings.filter((w) => w.restored);
      return `nessun cedimento tecnico fino alla fine del video${
        restored.length ? ` (una deviazione a ${formatClock(restored[0].atMs)}, corretta in tempo)` : ''
      }.`;
    }
    default:
      return '';
  }
}

/** Testo breve del report: cosa è successo, cosa migliorare, cosa va bene, cosa non si può giudicare. */
export function buildSummary(r: HoldReport, maxUsefulHoldSeconds?: number): string {
  const labelOf = (id: string | null) => r.issues.find((i) => i.id === id)?.label ?? 'deviazione tecnica';
  const lines: string[] = [];

  if (r.protocol.startMs === null) {
    lines.push(
      `Nel video (${formatDuration(r.durationMs)}) non è stata riconosciuta una posizione di ${r.exercise.toLowerCase()} valutabile.`,
      'Riprendi di lato, a corpo intero dalla testa ai piedi, con il telefono fermo e buona luce.',
    );
    return lines.join('\n');
  }

  const variant = r.variantName ? ` sugli ${r.variantName}` : '';
  lines.push(
    `${r.exercise}${r.variant === 'HIGH' ? ' a braccia tese' : variant}: ${formatDuration(r.inPositionMs)} in posizione su ${formatDuration(r.durationMs)} di video.`,
  );
  lines.push(`Tempo valido fino al cedimento tecnico: ${formatDuration(r.protocol.validHoldMs)} — ${endSentence(r, labelOf)}`);

  if (r.ratings.length === 1) {
    const rt = r.ratings[0];
    const next = rt.nextBand ? ` Per salire a "${rt.nextBand.label}" servono ${Math.ceil(rt.nextBand.minSeconds)} s.` : '';
    lines.push(`Livello: ${rt.atLeast ? 'almeno ' : ''}${rt.band.label.toLowerCase()} (${rt.band.description}).${next}`);
  } else if (r.ratings.length > 1) {
    const parts = r.ratings.map((rt) => `${SEX_LABEL[rt.sex]} ${rt.atLeast ? 'almeno ' : ''}${rt.band.label.toLowerCase()}`);
    lines.push(`Livello: ${parts.join(' · ')}.`);
  }

  if (r.issues.length === 0) {
    lines.push('Esecuzione corretta: il corpo resta sull’asse orecchio–spalla–anca–ginocchio–caviglia per tutta la tenuta.');
  } else {
    lines.push('Da migliorare:');
    r.issues.forEach((issue, i) => {
      const measure =
        issue.id === 'instability'
          ? `oscillazioni fino a ${formatValue(issue.peakValue, 'cm')}`
          : `fino a ${formatValue(issue.peakValue, issue.unit)} (a ${formatClock(issue.peakAtMs)})${
              issue.totalMs >= 1000 ? `, per ${formatDuration(issue.totalMs)} in totale` : ''
            }`;
      const level =
        issue.level === 'critical' ? (issue.escalated ? 'non corretto entro 3 s' : 'deviazione critica') : 'difetto lieve';
      const advice = issue.advice ? ` ${issue.advice.charAt(0).toUpperCase()}${issue.advice.slice(1)}` : '';
      lines.push(`${i + 1}. ${issue.label} — ${measure}, ${level}.${advice}`);
    });
  }

  if (r.positives.length) lines.push(`Bene: ${r.positives.join(', ')}.`);
  if (r.reliability < 0.6) {
    lines.push('Attenzione: in buona parte del video la posa non era ben visibile, il giudizio è meno affidabile.');
  }
  if (maxUsefulHoldSeconds && r.protocol.validHoldMs / 1000 > maxUsefulHoldSeconds) {
    lines.push(
      'Oltre i 120–180 s la tenuta non aggiunge benefici: meglio curare la qualità o passare a una variante più difficile.',
    );
  }
  if (r.notEvaluated.length) lines.push(`Non valutabili dal video: ${r.notEvaluated.join('; ')}.`);
  return lines.join('\n');
}
