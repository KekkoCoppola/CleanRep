import type { JointName, Side } from '../../types/contracts';
import { toIso, type Vec2 } from '../geometry/vector';
import type { StablePose } from '../tracking/types';
import type { ExerciseContext } from './types';

/** Confidenza minima perché un giunto entri nella geometria delle regole. */
export const MIN_RULE_CONFIDENCE = 0.4;

const other = (side: Side): Side => (side === 'LEFT' ? 'RIGHT' : 'LEFT');

export function createContext(pose: StablePose, variant: string | undefined, torso: number): ExerciseContext {
  const side: Side = pose.nearSide ?? 'LEFT';
  const joint = (name: JointName): Vec2 | undefined => {
    const j = pose.joints[name];
    if (!j || j.state === 'lost' || j.confidence < MIN_RULE_CONFIDENCE) return undefined;
    return toIso(j, pose.aspect);
  };
  const jointName = (part: string): JointName => {
    const near = `${side}_${part}` as JointName;
    if (joint(near)) return near;
    const far = `${other(side)}_${part}` as JointName;
    return joint(far) ? far : near;
  };
  return {
    pose,
    down: pose.down,
    side,
    variant,
    torso,
    joint,
    jointName,
    point: (part) => joint(jointName(part)),
  };
}
