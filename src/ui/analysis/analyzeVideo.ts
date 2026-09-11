import { HoldReportBuilder, type HoldReport, type Sex } from '../../core/analysis/holdReport';
import type { HoldExerciseDefinition } from '../../core/exercise/types';
import { TrainingPipeline } from '../../core/pipeline';
import type { RawPoseFrame } from '../../core/tracking/types';
import { BrightnessProbe } from '../../platform/frameSource';
import { getDetector } from '../../platform/pose/detector';
import type { DetectorOptions } from '../../platform/pose/detectorOptions';
import { iterateVideoFrames, loadVideo, videoDurationMs } from '../../platform/video/videoFrames';
import { drawAnalysisPreview, renderSnapshot } from '../render/snapshotRenderer';

/** Campioni analizzati per secondo di video: per un esercizio statico 10 bastano e avanzano. */
const SAMPLE_FPS = 10;

export interface AnalysisProgress {
  /** 0–1 (0 se la durata del video è sconosciuta). */
  fraction: number;
  mediaTimeMs: number;
  durationMs: number;
}

export interface VideoAnalysisResult {
  report: HoldReport;
  /** Screenshot per chiave (data URL JPEG). */
  images: Record<string, string>;
  fileName: string;
}

export interface AnalyzeVideoParams {
  file: File;
  /** Canvas su cui mostrare l'avanzamento (frame + scheletro). */
  preview: HTMLCanvasElement | null;
  exercise: HoldExerciseDefinition;
  detector: DetectorOptions;
  sex?: Sex;
  signal?: AbortSignal;
  onProgress?: (progress: AnalysisProgress) => void;
}

/**
 * Analisi di un video registrato con la STESSA pipeline del live (stabilizer,
 * regole, sessione), più il report secondo il protocollo del test da campo.
 */
export async function analyzeVideo(params: AnalyzeVideoParams): Promise<VideoAnalysisResult> {
  const { file, preview, exercise, detector, sex, signal, onProgress } = params;
  const url = URL.createObjectURL(file);
  // <video> dedicato, nel DOM ma invisibile (requestVideoFrameCallback richiede che sia renderizzato).
  const video = document.createElement('video');
  video.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;';
  document.body.appendChild(video);
  try {
    await loadVideo(video, url);
    const durationMs = videoDurationMs(video);
    const poseDetector = await getDetector(detector);
    const pipeline = new TrainingPipeline(exercise);
    const builder = new HoldReportBuilder(exercise, { durationMs: Number.isFinite(durationMs) ? durationMs : 0, sex });
    const images: Record<string, string> = {};
    const probe = new BrightnessProbe();
    const previewCtx = preview?.getContext('2d') ?? null;
    let lastT = 0;

    await iterateVideoFrames(video, {
      sampleFps: SAMPLE_FPS,
      signal,
      onFrame: (t) => {
        lastT = t;
        const frame: RawPoseFrame = {
          timestamp: t,
          width: video.videoWidth,
          height: video.videoHeight,
          poses: poseDetector.detect(video, t),
          brightness: probe.sample(video, t),
        };
        const out = pipeline.process(frame);
        const request = builder.add(out);
        if (request) images[request.key] = renderSnapshot(video, frame, out, request);
        if (previewCtx) drawAnalysisPreview(previewCtx, video, frame, out);
        onProgress?.({
          fraction: Number.isFinite(durationMs) && durationMs > 0 ? Math.min(1, t / durationMs) : 0,
          mediaTimeMs: t,
          durationMs,
        });
      },
    });

    const report = builder.finish(Number.isFinite(durationMs) ? durationMs : lastT);
    return { report, images, fileName: file.name };
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
    URL.revokeObjectURL(url);
  }
}
