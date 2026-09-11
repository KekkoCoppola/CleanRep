import { useEffect, useRef, useState } from 'react';
import type { Sex } from '../../core/analysis/holdReport';
import { formatClock } from '../../core/analysis/holdReport';
import type { HoldExerciseDefinition } from '../../core/exercise/types';
import type { DetectorOptions } from '../../platform/pose/detectorOptions';
import { analyzeVideo, type AnalysisProgress, type VideoAnalysisResult } from '../analysis/analyzeVideo';

interface Props {
  file: File;
  exercise: HoldExerciseDefinition;
  detector: DetectorOptions;
  sex?: Sex;
  onDone: (result: VideoAnalysisResult) => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

/** Analisi in corso: anteprima del frame analizzato con lo scheletro e avanzamento. */
export default function VideoAnalysisView({ file, exercise, detector, sex, onDone, onError, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));

    const controller = new AbortController();
    let lastUi = 0;
    analyzeVideo({
      file,
      preview: canvas,
      exercise,
      detector,
      sex,
      signal: controller.signal,
      onProgress: (p) => {
        const now = performance.now();
        if (now - lastUi < 120) return;
        lastUi = now;
        setProgress(p);
      },
    })
      .then((result) => {
        if (!controller.signal.aborted) onDone(result);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) return;
        onError(err instanceof Error ? err.message : String(err));
      });
    return () => controller.abort();
  }, [file, exercise, detector, sex, onDone, onError]);

  const percent = progress && progress.fraction > 0 ? Math.round(progress.fraction * 100) : null;
  return (
    <section className="analysis">
      <div className="analysis-head">
        <strong>Analisi del video…</strong>
        <span className="hint">{file.name}</span>
      </div>
      <div className="stage analysis-stage">
        <canvas ref={canvasRef} className="stage-canvas" />
      </div>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? 0}>
        <div className="progress-bar" style={{ transform: `scaleX(${(percent ?? 0) / 100})` }} />
      </div>
      <div className="hint">
        {progress
          ? `${formatClock(progress.mediaTimeMs)}${Number.isFinite(progress.durationMs) ? ` / ${formatClock(progress.durationMs)}` : ''}${
              percent !== null ? ` · ${percent}%` : ''
            }`
          : 'Caricamento del video e del modello AI…'}
      </div>
      <p className="hint">L’analisi avviene tutta sul dispositivo: il video non viene caricato da nessuna parte.</p>
      <button className="secondary" onClick={onCancel}>
        Annulla
      </button>
    </section>
  );
}
