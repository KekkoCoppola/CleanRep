import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { JointName, LandmarkPoint, PoseSnapshot } from '../../types/contracts';
import { JOINT_NAMES, LANDMARK_INDEX } from '../../core/pose/landmarks';

/** Asset locali (scripts/fetch-models.mjs): stessa versione della libreria, funzionano offline e nell'APK. */
const ASSET_BASE = `${import.meta.env.BASE_URL}mediapipe`;
const WASM_PATH = `${ASSET_BASE}/wasm`;

export type PoseModel = 'lite' | 'full';

/**
 * "full" è il default: il modello "lite" perde spesso le pose orizzontali a terra
 * (plank incluso). Su hardware debole il frame-skipping adattivo compensa;
 * in alternativa si può forzare "lite" via ?model=lite.
 */
const MODEL_URLS: Record<PoseModel, string> = {
  lite: `${ASSET_BASE}/models/pose_landmarker_lite.task`,
  full: `${ASSET_BASE}/models/pose_landmarker_full.task`,
};

/** Sopra questo tempo medio di inferenza si dimezza il framerate di tracking. */
const SLOW_INFERENCE_MS = 28;

export interface TrackerMetrics {
  /** Media mobile del tempo di inferenza (ms). */
  inferenceMs: number;
  /** 1 = ogni frame, 2 = un frame su due (frame-skipping adattivo attivo). */
  frameSkip: number;
}

export type SnapshotHandler = (snapshot: PoseSnapshot, metrics: TrackerMetrics) => void;

/**
 * Wrapper leggero attorno a MediaPipe PoseLandmarker (VIDEO mode, GPU delegate).
 * - Frame-skipping adattivo quando l'hardware è lento.
 * - Pausa automatica quando il tab è nascosto (oltre al throttling nativo di rAF).
 */
export class PoseTracker {
  private landmarker: PoseLandmarker | undefined;
  private rafId = 0;
  private running = false;
  private frameCount = 0;
  private avgInferenceMs = 0;
  private lastVideoTime = -1;

  async init(model: PoseModel = 'full'): Promise<void> {
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    this.landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URLS[model], delegate: 'GPU' },
      runningMode: 'VIDEO',
      numPoses: 1,
      // Più permissive del default (0.5): le pose distese a terra hanno
      // confidenze più basse; il gating fine lo fa il rule engine.
      minPoseDetectionConfidence: 0.3,
      minPosePresenceConfidence: 0.3,
      minTrackingConfidence: 0.3,
    });
  }

  start(video: HTMLVideoElement, onSnapshot: SnapshotHandler): void {
    if (!this.landmarker) throw new Error('PoseTracker non inizializzato: chiamare init()');
    this.running = true;

    const loop = () => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(loop);
      if (document.hidden || video.readyState < 2) return;

      const frameSkip = this.avgInferenceMs > SLOW_INFERENCE_MS ? 2 : 1;
      this.frameCount += 1;
      if (this.frameCount % frameSkip !== 0) return;
      // Evita di rianalizzare lo stesso frame video.
      if (video.currentTime === this.lastVideoTime) return;
      this.lastVideoTime = video.currentTime;

      const started = performance.now();
      const result = this.landmarker!.detectForVideo(video, started);
      const elapsed = performance.now() - started;
      this.avgInferenceMs =
        this.avgInferenceMs === 0 ? elapsed : 0.9 * this.avgInferenceMs + 0.1 * elapsed;

      const pose = result.landmarks[0];
      const landmarks: Partial<Record<JointName, LandmarkPoint>> = {};
      if (pose) {
        for (const name of JOINT_NAMES) {
          const lm = pose[LANDMARK_INDEX[name]];
          if (lm) {
            landmarks[name] = {
              x: lm.x,
              y: lm.y,
              z: lm.z,
              visibility: lm.visibility ?? 0,
            };
          }
        }
      }

      onSnapshot(
        {
          exercise: 'PLANK',
          timestamp: Date.now(),
          fps: frameSkip === 2 ? 15 : 30,
          landmarks,
        },
        { inferenceMs: this.avgInferenceMs, frameSkip },
      );
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  dispose(): void {
    this.stop();
    this.landmarker?.close();
    this.landmarker = undefined;
  }
}
