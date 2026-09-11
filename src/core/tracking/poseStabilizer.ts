import type { JointName, Side } from '../../types/contracts';
import { DEFAULT_DOWN, dist, normalize, toIso, type Vec2 } from '../geometry/vector';
import { PointFilter, STATIC_HOLD_FILTER, type OneEuroParams } from '../filters/oneEuro';
import { JOINT_NAMES } from '../pose/landmarks';
import { BoneLengthMonitor } from './anatomy';
import { toCandidate, type JointMap, type PoseCandidate } from './candidate';
import { assessQuality } from './quality';
import { correctSideSwaps } from './sideSwap';
import { SubjectLock } from './subjectLock';
import type { JointState, RawLandmark, RawPoseFrame, StableJoint, StablePose } from './types';

export interface StabilizerConfig {
  filter: OneEuroParams;
  /** Velocità massima plausibile di un giunto, in lunghezze di torso al secondo. */
  maxJointSpeed: number;
  /** Per quanto si tiene l'ultimo valore buono di un giunto non misurabile. */
  holdMs: number;
  /** Dopo quanto un "salto" confermato da campioni coerenti viene accettato (ri-sincronizzazione). */
  resyncMs: number;
  /** Isteresi sulla visibilità: soglia per diventare visibile / per smettere di esserlo. */
  visibilityEnter: number;
  visibilityExit: number;
}

export const DEFAULT_STABILIZER: StabilizerConfig = {
  filter: STATIC_HOLD_FILTER,
  maxJointSpeed: 8,
  holdMs: 300,
  resyncMs: 150,
  visibilityEnter: 0.5,
  visibilityExit: 0.35,
};

/** Lunghezza del torso di riserva (unità = altezza frame) prima della prima misura. */
const FALLBACK_TORSO = 0.25;
const NEAR_SIDE_SWITCH_MS = 1000;
const NEAR_SIDE_PARTS = ['SHOULDER', 'ELBOW', 'HIP', 'KNEE', 'ANKLE'];

interface JointTrack {
  filter: PointFilter;
  visible: boolean;
  /** Ultimo campione grezzo accettato (isotropo). */
  lastAccepted: Vec2 | null;
  lastAcceptT: number;
  /** Posizione filtrata (isotropa). */
  filtered: Vec2 | null;
  z: number;
  lastConfidence: number;
  state: JointState;
  rejectSince: number | null;
  lastRejected: Vec2 | null;
}

/**
 * Pipeline di stabilizzazione per frame:
 * 1. subject lock (sempre la stessa persona)
 * 2. correzione scambi sinistra/destra
 * 3. coerenza anatomica (lunghezze ossee in metri)
 * 4. isteresi di visibilità + gate di velocità (niente arti che saltano)
 * 5. filtro 1€ (niente tremolio)
 * 6. lato vicino alla camera + qualità della posa
 */
export class PoseStabilizer {
  private readonly config: StabilizerConfig;
  private readonly lock = new SubjectLock();
  private readonly bones = new BoneLengthMonitor();
  private tracks = new Map<JointName, JointTrack>();
  private torso = 0;
  private nearSide: Side | null = null;
  private nearCandidate: { side: Side; since: number } | null = null;

  constructor(config: Partial<StabilizerConfig> = {}) {
    this.config = { ...DEFAULT_STABILIZER, ...config };
  }

  /** Lunghezza corrente del torso (isotropa) usata per normalizzare le soglie. */
  get torsoLength(): number {
    return this.torso > 0 ? this.torso : FALLBACK_TORSO;
  }

  process(frame: RawPoseFrame): StablePose {
    const aspect = frame.width > 0 && frame.height > 0 ? frame.width / frame.height : 4 / 3;
    const t = frame.timestamp;
    const candidates = frame.poses
      .map((p, i) => toCandidate(p, i))
      .filter((c): c is PoseCandidate => c !== null);
    const selection = this.lock.select(candidates, t, aspect);
    if (selection.changed) this.resetSubjectState();

    const rejected: JointName[] = [];
    let swaps: string[] = [];
    let raw: JointMap | null = null;

    if (selection.candidate) {
      raw = { ...selection.candidate.joints };
      const world = selection.candidate.world ? { ...selection.candidate.world } : null;
      swaps = correctSideSwaps(raw, world, this.previousPositions(), aspect, this.torsoLength);
      const anomalous = new Set(this.bones.check(world));
      this.updateTorso(raw, aspect);
      for (const name of JOINT_NAMES) {
        this.updateJoint(name, raw[name], anomalous.has(name), t, aspect, rejected);
      }
      this.updateNearSide(raw, t);
    } else {
      for (const track of this.tracks.values()) this.decay(track, t);
    }

    const joints: Partial<Record<JointName, StableJoint>> = {};
    for (const [name, track] of this.tracks) {
      if (!track.filtered) continue;
      joints[name] = {
        x: track.filtered.x / aspect,
        y: track.filtered.y,
        z: track.z,
        confidence: track.state === 'lost' ? 0 : track.state === 'held' ? 0.8 * track.lastConfidence : track.lastConfidence,
        state: track.state,
      };
    }

    const hasSubject = selection.candidate !== null;
    const bbox = selection.candidate?.bbox ?? null;
    const quality = assessQuality({
      hasSubject,
      joints,
      raw,
      bbox,
      aspect,
      nearSide: this.nearSide,
      brightness: frame.brightness,
      phoneFlat: frame.phoneFlat,
    });
    const down = frame.down && !frame.phoneFlat ? normalize(frame.down) : DEFAULT_DOWN;

    return {
      timestamp: t,
      aspect,
      subjectId: selection.subjectId,
      locked: selection.locked,
      joints,
      nearSide: hasSubject ? this.nearSide : null,
      bbox,
      otherBoxes: selection.others,
      quality,
      down: down.x === 0 && down.y === 0 ? DEFAULT_DOWN : down,
      corrections: { swaps, rejected },
    };
  }

  reset(): void {
    this.lock.reset();
    this.resetSubjectState();
  }

  private resetSubjectState(): void {
    this.tracks.clear();
    this.bones.reset();
    this.torso = 0;
    this.nearSide = null;
    this.nearCandidate = null;
  }

  private previousPositions(): Partial<Record<JointName, Vec2>> {
    const out: Partial<Record<JointName, Vec2>> = {};
    for (const [name, track] of this.tracks) {
      if (track.filtered && track.state !== 'lost') out[name] = track.filtered;
    }
    return out;
  }

  private updateTorso(raw: JointMap, aspect: number): void {
    const lengths: number[] = [];
    for (const side of ['LEFT', 'RIGHT']) {
      const s = raw[`${side}_SHOULDER` as JointName];
      const h = raw[`${side}_HIP` as JointName];
      if (s && h && s.visibility >= 0.5 && h.visibility >= 0.5) lengths.push(dist(toIso(s, aspect), toIso(h, aspect)));
    }
    if (!lengths.length) return;
    const d = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    this.torso = this.torso > 0 ? 0.9 * this.torso + 0.1 * d : d;
  }

  private track(name: JointName): JointTrack {
    let track = this.tracks.get(name);
    if (!track) {
      track = {
        filter: new PointFilter(this.config.filter),
        visible: false,
        lastAccepted: null,
        lastAcceptT: 0,
        filtered: null,
        z: 0,
        lastConfidence: 0,
        state: 'lost',
        rejectSince: null,
        lastRejected: null,
      };
      this.tracks.set(name, track);
    }
    return track;
  }

  private updateJoint(
    name: JointName,
    lm: RawLandmark | undefined,
    anomalous: boolean,
    t: number,
    aspect: number,
    rejected: JointName[],
  ): void {
    const track = this.track(name);
    const vis = lm?.visibility ?? 0;
    track.visible = !!lm && (track.visible ? vis >= this.config.visibilityExit : vis >= this.config.visibilityEnter);

    if (lm && track.visible) {
      const p = toIso(lm, aspect);
      if (!anomalous && this.passesVelocityGate(track, p, t)) {
        if (track.state === 'lost' || !track.filtered) track.filter.reset();
        track.filtered = track.filter.filter(p, t);
        track.lastAccepted = p;
        track.lastAcceptT = t;
        track.z = lm.z;
        track.lastConfidence = vis;
        track.state = 'tracked';
        track.rejectSince = null;
        track.lastRejected = null;
        return;
      }
      rejected.push(name);
    }
    this.decay(track, t);
  }

  /**
   * Un giunto non può spostarsi più di maxJointSpeed torsi/secondo. Un salto
   * viene rifiutato, a meno che i campioni successivi confermino la nuova
   * posizione per resyncMs: in quel caso era un movimento vero e si riallinea.
   */
  private passesVelocityGate(track: JointTrack, p: Vec2, t: number): boolean {
    if (!track.lastAccepted || track.state === 'lost') return true;
    const dt = (t - track.lastAcceptT) / 1000;
    if (dt <= 0 || dt > 0.5) return true;
    const scale = this.torsoLength;
    if (dist(p, track.lastAccepted) / dt / scale <= this.config.maxJointSpeed) return true;

    if (track.lastRejected && dist(p, track.lastRejected) < 0.1 * scale) {
      if (track.rejectSince !== null && t - track.rejectSince >= this.config.resyncMs) {
        track.filter.reset();
        return true;
      }
    } else {
      track.rejectSince = t;
    }
    track.lastRejected = p;
    return false;
  }

  private decay(track: JointTrack, t: number): void {
    if (!track.filtered) {
      track.state = 'lost';
      return;
    }
    track.state = t - track.lastAcceptT <= this.config.holdMs ? 'held' : 'lost';
  }

  /**
   * Lato rivolto alla camera: più visibile e più vicino (z minore). Cambia solo
   * se l'evidenza contraria persiste per 1s (niente sfarfallio tra i lati).
   */
  private updateNearSide(raw: JointMap, t: number): void {
    const stats = (side: string) => {
      let vis = 0;
      let z = 0;
      let n = 0;
      for (const part of NEAR_SIDE_PARTS) {
        const lm = raw[`${side}_${part}` as JointName];
        if (!lm) continue;
        vis += lm.visibility;
        z += lm.z;
        n += 1;
      }
      return n ? { vis: vis / n, z: z / n } : { vis: 0, z: 0 };
    };
    const l = stats('LEFT');
    const r = stats('RIGHT');
    const score = l.vis - r.vis + 2 * (r.z - l.z);
    const candidate: Side | null = score > 0.1 ? 'LEFT' : score < -0.1 ? 'RIGHT' : null;
    if (!this.nearSide) {
      this.nearSide = candidate ?? (l.vis >= r.vis ? 'LEFT' : 'RIGHT');
      return;
    }
    if (candidate && candidate !== this.nearSide) {
      if (!this.nearCandidate || this.nearCandidate.side !== candidate) {
        this.nearCandidate = { side: candidate, since: t };
      } else if (t - this.nearCandidate.since >= NEAR_SIDE_SWITCH_MS) {
        this.nearSide = candidate;
        this.nearCandidate = null;
      }
    } else {
      this.nearCandidate = null;
    }
  }
}
