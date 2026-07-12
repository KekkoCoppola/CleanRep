import { useEffect, useRef } from 'react';
import type { EvaluationResult, JointName, PoseSnapshot } from '../types/contracts';
import type { PoseModel, TrackerMetrics } from '../pose/poseTracker';
import { PoseTracker } from '../pose/poseTracker';
import { LocalPlankEvaluator } from '../engine/evaluator';
import { drawSkeleton } from './skeletonRenderer';

export interface FrameInfo {
  result: EvaluationResult;
  metrics: TrackerMetrics;
}

interface Props {
  onFrame: (info: FrameInfo) => void;
  onError: (message: string) => void;
}

/** Le regole girano a ~10Hz (1 valutazione ogni EVAL_EVERY snapshot). */
const EVAL_EVERY = 3;

/**
 * Webcam + overlay scheletro. Tutto il loop di disegno è imperativo,
 * fuori dal ciclo di render React: nessun re-render per frame.
 */
export default function CameraView({ onFrame, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const evaluator = new LocalPlankEvaluator();
    const tracker = new PoseTracker();
    let stream: MediaStream | undefined;
    let disposed = false;
    let frameIndex = 0;
    let lastResult: EvaluationResult | undefined;
    let redSet = new Set<JointName>();

    const handleSnapshot = (snapshot: PoseSnapshot, metrics: TrackerMetrics) => {
      frameIndex += 1;
      if (!lastResult || frameIndex % EVAL_EVERY === 0) {
        lastResult = evaluator.evaluate(snapshot);
        redSet = new Set(lastResult.jointsToColorRed);
        onFrame({ result: lastResult, metrics });
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawSkeleton(ctx, snapshot.landmarks, redSet, canvas.width, canvas.height);
    };

    (async () => {
      try {
        // Risoluzione contenuta: è l'input dell'inferenza, non il rendering.
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
        if (disposed) return;
        video.srcObject = stream;
        await video.play();
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const model: PoseModel =
          new URLSearchParams(window.location.search).get('model') === 'lite' ? 'lite' : 'full';
        await tracker.init(model);
        if (disposed) return;
        tracker.start(video, handleSnapshot);
      } catch (err) {
        onError(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Permesso webcam negato: consentilo per allenarti.'
            : `Errore di inizializzazione: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    })();

    return () => {
      disposed = true;
      tracker.dispose();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onFrame, onError]);

  return (
    <div className="stage">
      <video ref={videoRef} className="mirrored" playsInline muted />
      <canvas ref={canvasRef} className="overlay mirrored" />
    </div>
  );
}
