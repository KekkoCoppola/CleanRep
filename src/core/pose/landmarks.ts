import type { JointName } from '../../types/contracts';

/** Indici del modello MediaPipe Pose (33 landmark). Solo quelli usati da CleanRep. */
export const LANDMARK_INDEX: Record<JointName, number> = {
  NOSE: 0,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
};

/** Numero di landmark prodotti da MediaPipe Pose. */
export const MEDIAPIPE_LANDMARK_COUNT = 33;

export const JOINT_NAMES = Object.keys(LANDMARK_INDEX) as JointName[];

/** Giunto omologo dell'altro lato (NOSE → NOSE). */
export function mirrorJoint(name: JointName): JointName {
  if (name.startsWith('LEFT_')) return name.replace('LEFT_', 'RIGHT_') as JointName;
  if (name.startsWith('RIGHT_')) return name.replace('RIGHT_', 'LEFT_') as JointName;
  return name;
}

/** Nome del giunto per lato: sideJoint('LEFT', 'HIP') → 'LEFT_HIP'. */
export function sideJoint(side: 'LEFT' | 'RIGHT', part: string): JointName {
  return `${side}_${part}` as JointName;
}

/** Segmenti dello scheletro disegnati sull'overlay. */
export const SKELETON_CONNECTIONS: Array<[JointName, JointName]> = [
  ['LEFT_SHOULDER', 'RIGHT_SHOULDER'],
  ['LEFT_SHOULDER', 'LEFT_ELBOW'],
  ['LEFT_ELBOW', 'LEFT_WRIST'],
  ['RIGHT_SHOULDER', 'RIGHT_ELBOW'],
  ['RIGHT_ELBOW', 'RIGHT_WRIST'],
  ['LEFT_SHOULDER', 'LEFT_HIP'],
  ['RIGHT_SHOULDER', 'RIGHT_HIP'],
  ['LEFT_HIP', 'RIGHT_HIP'],
  ['LEFT_HIP', 'LEFT_KNEE'],
  ['LEFT_KNEE', 'LEFT_ANKLE'],
  ['RIGHT_HIP', 'RIGHT_KNEE'],
  ['RIGHT_KNEE', 'RIGHT_ANKLE'],
  ['LEFT_ANKLE', 'LEFT_HEEL'],
  ['LEFT_HEEL', 'LEFT_FOOT_INDEX'],
  ['LEFT_ANKLE', 'LEFT_FOOT_INDEX'],
  ['RIGHT_ANKLE', 'RIGHT_HEEL'],
  ['RIGHT_HEEL', 'RIGHT_FOOT_INDEX'],
  ['RIGHT_ANKLE', 'RIGHT_FOOT_INDEX'],
  ['LEFT_EAR', 'LEFT_SHOULDER'],
  ['RIGHT_EAR', 'RIGHT_SHOULDER'],
];

/** Landmark indispensabili per valutare il plank (gating visibilità). */
export const PLANK_REQUIRED_JOINTS: JointName[] = [
  'LEFT_SHOULDER',
  'RIGHT_SHOULDER',
  'LEFT_HIP',
  'RIGHT_HIP',
  'LEFT_KNEE',
  'RIGHT_KNEE',
  'LEFT_ANKLE',
  'RIGHT_ANKLE',
];
