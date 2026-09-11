/**
 * Lettura frame per frame di un file video, per l'analisi offline.
 *
 * Strategia principale: riproduzione (muta) accelerata + requestVideoFrameCallback.
 * La decodifica resta sequenziale (veloce anche su telefono) e la velocità si
 * adatta al tempo di elaborazione, per ottenere ~sampleFps campioni per secondo
 * di video. Senza requestVideoFrameCallback si ripiega sul seek frame per frame.
 */

export interface VideoFrameLoopOptions {
  /** Frame da analizzare per secondo di video. */
  sampleFps: number;
  signal?: AbortSignal;
  /** Chiamata per ogni campione: il frame corrente del <video> è quello a `mediaTimeMs`. */
  onFrame(mediaTimeMs: number): void;
}

export class AnalysisAbortedError extends Error {
  constructor() {
    super('Analisi annullata');
    this.name = 'AbortError';
  }
}

export async function loadVideo(video: HTMLVideoElement, src: string): Promise<void> {
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error('Formato video non supportato da questo dispositivo.'));
    video.src = src;
  });
  if (!video.videoWidth || !video.videoHeight) throw new Error('Il file non contiene una traccia video leggibile.');
}

/** Durata in ms, NaN se il file non la dichiara (alcuni WebM). */
export function videoDurationMs(video: HTMLVideoElement): number {
  return Number.isFinite(video.duration) ? video.duration * 1000 : NaN;
}

export function iterateVideoFrames(video: HTMLVideoElement, options: VideoFrameLoopOptions): Promise<void> {
  if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) return playbackLoop(video, options);
  return seekLoop(video, options);
}

function playbackLoop(video: HTMLVideoElement, { sampleFps, signal, onFrame }: VideoFrameLoopOptions): Promise<void> {
  const step = 1000 / sampleFps;
  return new Promise<void>((resolve, reject) => {
    let done = false;
    let next = 0;
    let avgCost = 0;
    let samples = 0;
    const finish = (err?: unknown) => {
      if (done) return;
      done = true;
      video.pause();
      video.removeEventListener('ended', onEnded);
      signal?.removeEventListener('abort', onAbort);
      if (err) reject(err);
      else resolve();
    };
    const onEnded = () => finish();
    const onAbort = () => finish(new AnalysisAbortedError());
    if (signal?.aborted) return finish(new AnalysisAbortedError());
    signal?.addEventListener('abort', onAbort);
    video.addEventListener('ended', onEnded);

    const onVideoFrame: VideoFrameRequestCallback = (_now, meta) => {
      if (done) return;
      const t = meta.mediaTime * 1000;
      if (t + 0.5 >= next) {
        const started = performance.now();
        try {
          onFrame(t);
        } catch (err) {
          finish(err);
          return;
        }
        const cost = performance.now() - started;
        avgCost = avgCost ? 0.8 * avgCost + 0.2 * cost : cost;
        next = t + step;
        samples += 1;
        if (samples % 5 === 0) {
          // Tra due campioni passano step/rate ms reali: devono bastare per elaborare.
          const rate = Math.min(4, Math.max(0.25, (0.8 * step) / Math.max(avgCost, 1)));
          video.playbackRate = Math.round(rate * 4) / 4;
        }
      }
      video.requestVideoFrameCallback(onVideoFrame);
    };

    video.currentTime = 0;
    video.playbackRate = 1;
    video.requestVideoFrameCallback(onVideoFrame);
    video.play().catch(finish);
  });
}

async function seekLoop(video: HTMLVideoElement, { sampleFps, signal, onFrame }: VideoFrameLoopOptions): Promise<void> {
  const durationMs = videoDurationMs(video);
  if (!Number.isFinite(durationMs)) throw new Error('Durata del video sconosciuta: impossibile analizzarlo.');
  const step = 1000 / sampleFps;
  for (let t = 0; t <= durationMs; t += step) {
    if (signal?.aborted) throw new AnalysisAbortedError();
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = t / 1000;
    });
    onFrame(t);
  }
}
