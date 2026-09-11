import type { JointName } from '../../types/contracts';
import { JOINT_NAMES, LANDMARK_INDEX } from '../pose/landmarks';
import type { BBox, RawLandmark, RawPose } from './types';

export type JointMap = Partial<Record<JointName, RawLandmark>>;

/** Una posa candidata (una delle persone rilevate) con i dati utili al subject lock. */
export interface PoseCandidate {
  index: number;
  joints: JointMap;
  world: JointMap | null;
  bbox: BBox;
  meanVisibility: number;
  /** Rapporti osso/torso in metri (mondo): "impronta" corporea della persona, stabile nel tempo. */
  proportions: number[] | null;
}

const BBOX_MIN_VISIBILITY = 0.5;

export function extractJoints(landmarks: RawLandmark[] | undefined): JointMap {
  const out: JointMap = {};
  if (!landmarks) return out;
  for (const name of JOINT_NAMES) {
    const lm = landmarks[LANDMARK_INDEX[name]];
    if (lm) out[name] = lm;
  }
  return out;
}

export function bboxOf(joints: JointMap, minVisibility = BBOX_MIN_VISIBILITY): BBox | null {
  const all = Object.values(joints) as RawLandmark[];
  const visible = all.filter((j) => j.visibility >= minVisibility);
  const pts = visible.length >= 4 ? visible : all;
  if (pts.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

export function bboxIoU(a: BBox, b: BBox): number {
  const ix = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const iy = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
  const inter = ix * iy;
  const areaA = (a.maxX - a.minX) * (a.maxY - a.minY);
  const areaB = (b.maxX - b.minX) * (b.maxY - b.minY);
  const union = areaA + areaB - inter;
  return union > 0 ? inter / union : 0;
}

/** Centro del riquadro nello spazio isotropo. */
export function bboxCenterIso(b: BBox, aspect: number): { x: number; y: number } {
  return { x: ((b.minX + b.maxX) / 2) * aspect, y: (b.minY + b.maxY) / 2 };
}

/** Diagonale del riquadro nello spazio isotropo (unità = altezza frame). */
export function bboxDiagIso(b: BBox, aspect: number): number {
  return Math.hypot((b.maxX - b.minX) * aspect, b.maxY - b.minY);
}

function dist3(a: RawLandmark, b: RawLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

const PROPORTION_BONES: Array<[string, string]> = [
  ['SHOULDER', 'ELBOW'],
  ['ELBOW', 'WRIST'],
  ['HIP', 'KNEE'],
  ['KNEE', 'ANKLE'],
];

function sideBone(world: JointMap, a: string, b: string): number | undefined {
  const values: number[] = [];
  for (const side of ['LEFT', 'RIGHT']) {
    const pa = world[`${side}_${a}` as JointName];
    const pb = world[`${side}_${b}` as JointName];
    if (pa && pb && pa.visibility >= BBOX_MIN_VISIBILITY && pb.visibility >= BBOX_MIN_VISIBILITY) {
      values.push(dist3(pa, pb));
    }
  }
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : undefined;
}

/** Rapporti [braccio, avambraccio, coscia, tibia] / torso; NaN dove il segmento non è visibile. */
export function proportionsOf(world: JointMap | null): number[] | null {
  if (!world) return null;
  const torso = sideBone(world, 'SHOULDER', 'HIP');
  if (!torso || torso <= 0) return null;
  return PROPORTION_BONES.map(([a, b]) => {
    const len = sideBone(world, a, b);
    return len === undefined ? NaN : len / torso;
  });
}

/** Differenza relativa media tra due impronte (solo sui segmenti presenti in entrambe). */
export function proportionsDistance(a: number[] | null, b: number[] | null): number | undefined {
  if (!a || !b) return undefined;
  const diffs: number[] = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (Number.isFinite(a[i]) && Number.isFinite(b[i]) && b[i] > 0) diffs.push(Math.abs(a[i] - b[i]) / b[i]);
  }
  return diffs.length >= 2 ? diffs.reduce((s, v) => s + v, 0) / diffs.length : undefined;
}

export function toCandidate(pose: RawPose, index: number): PoseCandidate | null {
  const joints = extractJoints(pose.landmarks);
  const bbox = bboxOf(joints);
  if (!bbox) return null;
  const values = Object.values(joints) as RawLandmark[];
  const world = pose.worldLandmarks ? extractJoints(pose.worldLandmarks) : null;
  return {
    index,
    joints,
    world,
    bbox,
    meanVisibility: values.reduce((s, j) => s + j.visibility, 0) / values.length,
    proportions: proportionsOf(world),
  };
}
