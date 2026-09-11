import type { RawPoseFrame } from '../core/tracking/types';
import type { PoseDetector } from './pose/detector';
import type { GravitySensor } from './sensors/gravity';

export interface SourceMetrics {
  /** Frame analizzati al secondo. */
  fps: number;
  inferenceMs: number;
  delegate: string;
}

/** `image` = il frame esatto che è stato analizzato (null nel replay di landmark). */
export type FrameHandler = (frame: RawPoseFrame, image: CanvasImageSource | null) => void;

/**
 * Sorgente di frame analizzati: camera live, file video o registrazione.
 * Un futuro plugin nativo Android (CameraX + MediaPipe Kotlin) implementerà
 * la stessa interfaccia senza toccare core e UI.
 */
export interface FrameSource {
  readonly mirrored: boolean;
  start(onFrame: FrameHandler): void;
  stop(): void;
  metrics(): SourceMetrics;
}

class FpsMeter {
  private last = 0;
  private avgMs = 0;

  tick(t: number): void {
    if (this.last) {
      const dt = t - this.last;
      this.avgMs = this.avgMs ? 0.9 * this.avgMs + 0.1 * dt : dt;
    }
    this.last = t;
  }

  get fps(): number {
    return this.avgMs ? 1000 / this.avgMs : 0;
  }
}

/** Luminosità media del frame (0–1), campionata una volta al secondo su un canvas 32×24. */
export class BrightnessProbe {
  private readonly ctx: CanvasRenderingContext2D | null;
  private value: number | undefined;
  private lastT = -Infinity;

  constructor() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 24;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
  }

  sample(image: CanvasImageSource, t: number): number | undefined {
    if (!this.ctx || t - this.lastT < 1000) return this.value;
    this.lastT = t;
    try {
      this.ctx.drawImage(image, 0, 0, 32, 24);
      const { data } = this.ctx.getImageData(0, 0, 32, 24);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      this.value = sum / (data.length / 4) / 255;
    } catch {
      this.value = undefined;
    }
    return this.value;
  }
}

/**
 * Analizza un <video> (camera o file) un frame nuovo alla volta. Il frame
 * passato a `onFrame` è lo stesso elemento video appena analizzato: disegnandolo
 * subito, immagine e scheletro appartengono allo STESSO frame (niente drift).
 */
export class VideoFrameSource implements FrameSource {
  private running = false;
  private rafId = 0;
  private lastMediaTime = -1;
  private lastTs = 0;
  private readonly fps = new FpsMeter();
  private readonly brightness = new BrightnessProbe();

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly detector: PoseDetector,
    readonly mirrored: boolean,
    private readonly gravity: GravitySensor | null,
    private readonly frontCamera: boolean,
  ) {}

  start(onFrame: FrameHandler): void {
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(loop);
      const v = this.video;
      if (document.hidden || v.readyState < 2 || v.videoWidth === 0) return;
      if (v.currentTime === this.lastMediaTime) return; // nessun frame nuovo
      this.lastMediaTime = v.currentTime;
      let ts = performance.now();
      if (ts <= this.lastTs) ts = this.lastTs + 1;
      this.lastTs = ts;
      const poses = this.detector.detect(v, ts);
      this.fps.tick(ts);
      const g = this.gravity?.read(this.frontCamera);
      onFrame(
        {
          timestamp: ts,
          width: v.videoWidth,
          height: v.videoHeight,
          poses,
          brightness: this.brightness.sample(v, ts),
          down: g?.down ?? null,
          phoneFlat: g?.phoneFlat ?? false,
        },
        v,
      );
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  metrics(): SourceMetrics {
    return { fps: this.fps.fps, inferenceMs: this.detector.inferenceMs, delegate: this.detector.delegate };
  }
}

/** Riproduce frame registrati (o sintetici) in tempo reale, in loop. */
export class ReplayFrameSource implements FrameSource {
  readonly mirrored = false;
  private running = false;
  private rafId = 0;
  private readonly fps = new FpsMeter();

  constructor(private readonly frames: RawPoseFrame[]) {}

  start(onFrame: FrameHandler): void {
    if (this.frames.length === 0) return;
    this.running = true;
    const base = this.frames[0].timestamp;
    const duration = this.frames[this.frames.length - 1].timestamp - base + 33;
    const startedAt = performance.now();
    let index = 0;
    let loopOffset = 0;
    const loop = (now: number) => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(loop);
      const elapsed = now - startedAt - loopOffset;
      // Tutti i frame "scaduti" passano dalla pipeline (i filtri vedono il tempo reale).
      while (this.running && this.frames[index].timestamp - base <= elapsed) {
        const f = this.frames[index];
        const ts = f.timestamp - base + loopOffset;
        this.fps.tick(ts);
        onFrame({ ...f, timestamp: ts }, null);
        index += 1;
        if (index >= this.frames.length) {
          index = 0;
          loopOffset += duration;
          break;
        }
      }
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  metrics(): SourceMetrics {
    return { fps: this.fps.fps, inferenceMs: 0, delegate: 'replay' };
  }
}
