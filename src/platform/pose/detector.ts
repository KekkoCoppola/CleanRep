import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import type { RawLandmark, RawPose } from '../../core/tracking/types';
import { DEFAULT_DETECTOR, type DetectorOptions } from './detectorOptions';

/** Asset locali (scripts/fetch-models.mjs): stessa versione della libreria, offline, inclusi nell'APK. */
const ASSET_BASE = `${import.meta.env.BASE_URL}mediapipe`;

export type { DetectorOptions, PoseModel } from './detectorOptions';

/** Timestamp del warm-up: i frame reali (performance.now()) arrivano sempre dopo. */
const WARMUP_TIMESTAMP = 1;

function toRaw(list: Array<{ x: number; y: number; z: number; visibility?: number }>): RawLandmark[] {
  return list.map((l) => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility ?? 0 }));
}

/**
 * Wrapper MediaPipe PoseLandmarker (VIDEO mode). Prova il delegate GPU e, se la
 * WebView/driver non lo supporta, ripiega su CPU invece di fallire.
 * Soglie di confidenza ai default Google (0.5): più basse facevano scambiare
 * ombre e oggetti per arti; il gating fine lo fa comunque il core.
 */
export class PoseDetector {
  private avgMs = 0;

  private constructor(
    private readonly landmarker: PoseLandmarker,
    readonly delegate: 'GPU' | 'CPU',
  ) {}

  static async create(options: DetectorOptions): Promise<PoseDetector> {
    const fileset = await FilesetResolver.forVisionTasks(`${ASSET_BASE}/wasm`);
    const make = (delegate: 'GPU' | 'CPU') =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: `${ASSET_BASE}/models/pose_landmarker_${options.model}.task`, delegate },
        runningMode: 'VIDEO',
        numPoses: options.numPoses,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    let detector: PoseDetector;
    try {
      detector = new PoseDetector(await make('GPU'), 'GPU');
    } catch (err) {
      console.warn('[PoseDetector] GPU non disponibile, uso CPU', err);
      detector = new PoseDetector(await make('CPU'), 'CPU');
    }
    detector.warmUp();
    return detector;
  }

  /**
   * La prima inferenza compila gli shader GPU (anche diversi secondi): la si fa
   * qui, su un'immagine vuota, durante "Caricamento modello", invece che sul
   * primo frame della camera (che resterebbe congelato).
   */
  private warmUp(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    canvas.getContext('2d')?.fillRect(0, 0, 256, 256);
    try {
      this.landmarker.detectForVideo(canvas, WARMUP_TIMESTAMP);
    } catch (err) {
      console.warn('[PoseDetector] warm-up fallito', err);
    }
  }

  /** Tempo medio di inferenza (ms, media mobile). */
  get inferenceMs(): number {
    return this.avgMs;
  }

  /** `timestampMs` deve crescere strettamente a ogni chiamata. */
  detect(source: HTMLVideoElement, timestampMs: number): RawPose[] {
    const started = performance.now();
    const result: PoseLandmarkerResult = this.landmarker.detectForVideo(source, timestampMs);
    const elapsed = performance.now() - started;
    this.avgMs = this.avgMs === 0 ? elapsed : 0.9 * this.avgMs + 0.1 * elapsed;
    return result.landmarks.map((lms, i) => ({
      landmarks: toRaw(lms),
      worldLandmarks: result.worldLandmarks[i] ? toRaw(result.worldLandmarks[i]) : undefined,
    }));
  }

  close(): void {
    this.landmarker.close();
  }
}

let shared: { key: string; promise: Promise<PoseDetector> } | null = null;

/** Detector condiviso: cambiare camera o riavviare la sessione non ricarica il modello. */
export function getDetector(options: DetectorOptions = DEFAULT_DETECTOR): Promise<PoseDetector> {
  const key = `${options.model}:${options.numPoses}`;
  if (!shared || shared.key !== key) {
    const previous = shared?.promise;
    shared = { key, promise: PoseDetector.create(options) };
    previous?.then((d) => d.close()).catch(() => undefined);
    // Un fallimento non deve restare in cache: al prossimo tentativo si riprova.
    shared.promise.catch(() => {
      if (shared?.key === key) shared = null;
    });
  }
  return shared.promise;
}
