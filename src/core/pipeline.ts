import { HoldSession, type HoldSessionState } from './exercise/holdSession';
import type { ExerciseDefinition } from './exercise/types';
import { Coach, type Utterance } from './feedback/coach';
import { PoseStabilizer } from './tracking/poseStabilizer';
import type { RawPoseFrame, StablePose } from './tracking/types';

export interface PipelineOutput {
  pose: StablePose;
  state: HoldSessionState;
  /** Frase da pronunciare ora (null = silenzio). */
  utterance: Utterance | null;
}

/**
 * L'intero cervello dell'app, senza DOM: frame grezzo → posa stabile →
 * stato dell'esercizio → eventuale frase. La UI si limita a fornire frame,
 * disegnare l'output e passare le frasi al TTS.
 */
export class TrainingPipeline {
  readonly stabilizer: PoseStabilizer;
  readonly session: HoldSession;
  readonly coach: Coach;

  constructor(readonly exercise: ExerciseDefinition) {
    this.stabilizer = new PoseStabilizer({ filter: exercise.filter, maxJointSpeed: exercise.maxJointSpeed });
    this.session = new HoldSession(exercise);
    this.coach = new Coach(exercise.messages);
  }

  process(frame: RawPoseFrame, speaking = false): PipelineOutput {
    const pose = this.stabilizer.process(frame);
    const state = this.session.update(pose, this.stabilizer.torsoLength);
    const utterance = this.coach.update(pose.timestamp, state, pose.quality, speaking);
    return { pose, state, utterance };
  }

  reset(): void {
    this.stabilizer.reset();
    this.session.reset();
    this.coach.reset();
  }
}
