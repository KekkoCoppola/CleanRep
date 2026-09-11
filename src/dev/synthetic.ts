/**
 * Generatore di pose e sessioni sintetiche (puro, deterministico con seed).
 * Serve ai test di regressione e alla modalità demo `?replay`: permette di
 * riprodurre in modo ripetibile rumore, scambi sinistra/destra, giunti che
 * "saltano", seconde persone e oggetti scambiati per pose.
 *
 * Tutte le misure interne sono nello spazio isotropo (unità = altezza frame).
 */
import type { JointName, Side } from '../types/contracts';
import { LANDMARK_INDEX, MEDIAPIPE_LANDMARK_COUNT, mirrorJoint } from '../core/pose/landmarks';
import type { RawLandmark, RawPose, RawPoseFrame } from '../core/tracking/types';

export type SyntheticVariant = 'FOREARM' | 'HIGH';

export interface BodyParams {
  kind: 'plank' | 'standing';
  variant?: SyntheticVariant;
  /** Scostamento verticale dell'anca dalla linea spalla–caviglia (+ = verso il pavimento). */
  hipOffset?: number;
  /** Flessione del ginocchio in gradi (0 = gamba tesa). */
  kneeBend?: number;
  /** Spostamento in avanti di gomito (avambracci) o polso (braccia tese) rispetto alla spalla. */
  armForward?: number;
  /** Abbassamento dell'orecchio rispetto al prolungamento del busto. */
  headDrop?: number;
  /** Posizione x (isotropa) delle spalle. */
  originX?: number;
  /** Livello del pavimento (y normalizzata). */
  floorY?: number;
  /** Direzione della testa nell'immagine. */
  facing?: 'left' | 'right';
  /** Lato del corpo verso la camera. */
  nearSide?: Side;
  /** Scala della persona (1 = torso lungo 0.25 altezze frame). */
  size?: number;
  /** Visibilità dei giunti del lato vicino / lontano. */
  nearVisibility?: number;
  farVisibility?: number;
}

type Pt = { x: number; y: number };
const pt = (x: number, y: number): Pt => ({ x, y });

/** Posizioni isotrope del lato vicino (il lato lontano è quasi sovrapposto). */
export function syntheticJoints(p: BodyParams): Partial<Record<string, Pt>> {
  const s = p.size ?? 1;
  const T = 0.25 * s;
  const thigh = 0.2 * s;
  const shin = 0.2 * s;
  const upperArm = 0.15 * s;
  const forearm = 0.13 * s;
  const floor = p.floorY ?? 0.8;
  const dir = (p.facing ?? 'left') === 'left' ? -1 : 1;
  const ox = p.originX ?? 0.45;
  const j: Record<string, Pt> = {};

  if (p.kind === 'standing') {
    j.ANKLE = pt(ox, floor - 0.02);
    j.KNEE = pt(ox, j.ANKLE.y - shin);
    j.HIP = pt(ox, j.KNEE.y - thigh);
    j.SHOULDER = pt(ox, j.HIP.y - T);
    j.EAR = pt(ox + dir * 0.01, j.SHOULDER.y - 0.07 * s);
    j.NOSE = pt(ox + dir * 0.04 * s, j.EAR.y + 0.005);
    j.ELBOW = pt(ox, j.SHOULDER.y + upperArm);
    j.WRIST = pt(ox, j.ELBOW.y + forearm);
    j.HEEL = pt(ox - dir * 0.02 * s, floor);
    j.FOOT_INDEX = pt(ox + dir * 0.05 * s, floor);
    return j;
  }

  const af = p.armForward ?? 0;
  if ((p.variant ?? 'FOREARM') === 'FOREARM') {
    const elbowY = floor - 0.02;
    j.SHOULDER = pt(ox, elbowY - upperArm);
    j.ELBOW = pt(ox + dir * af, elbowY);
    j.WRIST = pt(j.ELBOW.x + dir * forearm, elbowY);
  } else {
    const wristY = floor - 0.02;
    j.SHOULDER = pt(ox, wristY - (upperArm + forearm));
    j.WRIST = pt(ox + dir * af, wristY);
    j.ELBOW = pt((j.SHOULDER.x + j.WRIST.x) / 2, (j.SHOULDER.y + j.WRIST.y) / 2);
  }
  const L = T + thigh + shin;
  const ankleY = floor - 0.03;
  const dy = ankleY - j.SHOULDER.y;
  const dx = Math.sqrt(Math.max(0, L * L - dy * dy));
  j.ANKLE = pt(j.SHOULDER.x - dir * dx, ankleY);
  const along = (f: number) =>
    pt(j.SHOULDER.x + (j.ANKLE.x - j.SHOULDER.x) * f, j.SHOULDER.y + (j.ANKLE.y - j.SHOULDER.y) * f);
  const hipBase = along(T / L);
  j.HIP = pt(hipBase.x, hipBase.y + (p.hipOffset ?? 0));
  const bend = ((p.kneeBend ?? 0) * Math.PI) / 180;
  const kneeBase = pt((j.HIP.x + j.ANKLE.x) / 2, (j.HIP.y + j.ANKLE.y) / 2);
  j.KNEE = pt(kneeBase.x, kneeBase.y + Math.sin(bend / 2) * thigh);
  j.HEEL = pt(j.ANKLE.x - dir * 0.03 * s, j.ANKLE.y - 0.02 * s);
  j.FOOT_INDEX = pt(j.ANKLE.x + dir * 0.01 * s, floor);
  const bodyDir = { x: j.SHOULDER.x - j.HIP.x, y: j.SHOULDER.y - j.HIP.y };
  const bl = Math.hypot(bodyDir.x, bodyDir.y) || 1;
  j.EAR = pt(j.SHOULDER.x + (bodyDir.x / bl) * 0.07 * s, j.SHOULDER.y + (bodyDir.y / bl) * 0.07 * s + (p.headDrop ?? 0));
  j.NOSE = pt(j.EAR.x + dir * 0.03 * s, j.EAR.y + 0.01 * s);
  return j;
}

const WORLD_METERS_PER_UNIT = 2; // torso 0.25 altezze frame ≈ 0.5 m

/** Posa MediaPipe completa (33 landmark + mondo) per la configurazione data. */
export function syntheticPose(p: BodyParams, aspect = 4 / 3): RawPose {
  const near = p.nearSide ?? 'LEFT';
  const nearVis = p.nearVisibility ?? 0.95;
  const farVis = p.farVisibility ?? 0.6;
  const parts = syntheticJoints(p);
  const hip = parts.HIP!;
  const landmarks: RawLandmark[] = Array.from({ length: MEDIAPIPE_LANDMARK_COUNT }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0,
  }));
  const worldLandmarks: RawLandmark[] = landmarks.map((l) => ({ ...l }));
  const set = (name: JointName, q: Pt, isNear: boolean, vis: number) => {
    const z = name === 'NOSE' ? 0 : isNear ? -0.1 : 0.1;
    const i = LANDMARK_INDEX[name];
    landmarks[i] = { x: q.x / aspect, y: q.y, z, visibility: vis };
    worldLandmarks[i] = {
      x: (q.x - hip.x) * WORLD_METERS_PER_UNIT,
      y: (q.y - hip.y) * WORLD_METERS_PER_UNIT,
      z: isNear ? -0.15 : 0.15,
      visibility: vis,
    };
  };
  for (const [part, q] of Object.entries(parts)) {
    if (!q) continue;
    if (part === 'NOSE') {
      set('NOSE', q, true, nearVis);
      continue;
    }
    const nearName = `${near}_${part}` as JointName;
    set(nearName, q, true, nearVis);
    set(mirrorJoint(nearName), { x: q.x + 0.004, y: q.y - 0.006 }, false, farVis);
  }
  return { landmarks, worldLandmarks };
}

/** Posa MediaPipe da una mappa di giunti normalizzati (per convertire le fixture JSON storiche). */
export function poseFromJointMap(map: Partial<Record<JointName, RawLandmark>>): RawPose {
  const landmarks: RawLandmark[] = Array.from({ length: MEDIAPIPE_LANDMARK_COUNT }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0,
  }));
  for (const [name, lm] of Object.entries(map) as Array<[JointName, RawLandmark]>) {
    landmarks[LANDMARK_INDEX[name]] = { ...lm };
  }
  return { landmarks };
}

// ---------- Perturbazioni ----------

/** PRNG deterministico (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

function clonePose(pose: RawPose): RawPose {
  return {
    landmarks: pose.landmarks.map((l) => ({ ...l })),
    worldLandmarks: pose.worldLandmarks?.map((l) => ({ ...l })),
  };
}

/** Rumore gaussiano sulle coordinate normalizzate (sigma in altezze frame). */
export function withNoise(pose: RawPose, sigma: number, rng: () => number, aspect = 4 / 3): RawPose {
  const out = clonePose(pose);
  for (const l of out.landmarks) {
    if (l.visibility <= 0) continue;
    l.x += (gaussian(rng) * sigma) / aspect;
    l.y += gaussian(rng) * sigma;
  }
  return out;
}

/** Scambia le etichette sinistra/destra delle parti indicate (errore tipico di MediaPipe di lato). */
export function swapSides(pose: RawPose, parts: string[] = ['KNEE', 'ANKLE', 'HEEL', 'FOOT_INDEX']): RawPose {
  const out = clonePose(pose);
  for (const part of parts) {
    const a = LANDMARK_INDEX[`LEFT_${part}` as JointName];
    const b = LANDMARK_INDEX[`RIGHT_${part}` as JointName];
    for (const arr of [out.landmarks, out.worldLandmarks]) {
      if (!arr) continue;
      [arr[a], arr[b]] = [arr[b], arr[a]];
    }
  }
  return out;
}

/** Sposta un giunto (coordinate normalizzate): simula un arto "agganciato" a un oggetto. */
export function displaceJoint(pose: RawPose, name: JointName, dx: number, dy: number): RawPose {
  const out = clonePose(pose);
  const i = LANDMARK_INDEX[name];
  out.landmarks[i].x += dx;
  out.landmarks[i].y += dy;
  if (out.worldLandmarks) {
    out.worldLandmarks[i].x += dx * WORLD_METERS_PER_UNIT * (4 / 3);
    out.worldLandmarks[i].y += dy * WORLD_METERS_PER_UNIT;
  }
  return out;
}

/** Abbassa la visibilità di alcuni giunti (occlusione / poca luce). */
export function occlude(pose: RawPose, names: JointName[], visibility = 0.1): RawPose {
  const out = clonePose(pose);
  for (const name of names) {
    out.landmarks[LANDMARK_INDEX[name]].visibility = visibility;
    if (out.worldLandmarks) out.worldLandmarks[LANDMARK_INDEX[name]].visibility = visibility;
  }
  return out;
}

// ---------- Sessioni ----------

export interface Segment {
  durationMs: number;
  body: BodyParams | null;
  /** Rumore (sigma, altezze frame). Default 0.004. */
  noise?: number;
  /** Modifica la posa principale (tempo relativo al segmento). */
  mutate?: (pose: RawPose, tMs: number, rng: () => number) => RawPose;
  /** Altre pose nello stesso frame (seconde persone, oggetti). Messe PRIMA della principale. */
  extra?: (tMs: number, rng: () => number) => RawPose[];
  brightness?: number;
}

export interface SessionOptions {
  fps?: number;
  width?: number;
  height?: number;
  seed?: number;
  startMs?: number;
}

export function buildSession(segments: Segment[], options: SessionOptions = {}): RawPoseFrame[] {
  const fps = options.fps ?? 30;
  const width = options.width ?? 640;
  const height = options.height ?? 480;
  const aspect = width / height;
  const rng = mulberry32(options.seed ?? 1);
  const step = 1000 / fps;
  const frames: RawPoseFrame[] = [];
  let t = options.startMs ?? 0;
  for (const seg of segments) {
    const base = seg.body ? syntheticPose(seg.body, aspect) : null;
    for (let local = 0; local < seg.durationMs; local += step) {
      const poses: RawPose[] = seg.extra ? seg.extra(local, rng) : [];
      if (base) {
        let pose = withNoise(base, seg.noise ?? 0.004, rng, aspect);
        if (seg.mutate) pose = seg.mutate(pose, local, rng);
        poses.push(pose);
      }
      frames.push({ timestamp: Math.round(t), width, height, poses, brightness: seg.brightness ?? 0.5 });
      t += step;
    }
  }
  return frames;
}

/** Sessione dimostrativa per `?replay` senza file: tutte le situazioni principali in sequenza. */
export function demoSession(): RawPoseFrame[] {
  const plank: BodyParams = { kind: 'plank', variant: 'FOREARM' };
  return buildSession([
    { durationMs: 3000, body: { kind: 'standing', originX: 0.6 } },
    { durationMs: 5000, body: plank },
    { durationMs: 4000, body: { ...plank, hipOffset: 0.05 } },
    { durationMs: 3000, body: plank },
    { durationMs: 4000, body: { ...plank, hipOffset: -0.06 } },
    {
      durationMs: 4000,
      body: plank,
      // Glitch tipici: gambe scambiate a tratti e un gomito che salta su un oggetto.
      mutate: (pose, tMs) => {
        let out = Math.floor(tMs / 400) % 3 === 1 ? swapSides(pose) : pose;
        if (Math.floor(tMs / 700) % 4 === 2) out = displaceJoint(out, 'LEFT_ELBOW', 0.15, -0.2);
        return out;
      },
    },
    {
      durationMs: 4000,
      body: plank,
      extra: (tMs) => [syntheticPose({ kind: 'standing', originX: 1.15 - tMs / 8000, size: 1.1 })],
    },
    { durationMs: 4000, body: { ...plank, kneeBend: 50 } },
    { durationMs: 5000, body: { kind: 'plank', variant: 'HIGH' } },
    { durationMs: 4000, body: { kind: 'plank', variant: 'HIGH', armForward: 0.12 } },
    { durationMs: 3000, body: { kind: 'standing', originX: 0.6 } },
    { durationMs: 2000, body: null },
  ]);
}
