import { useEffect, useRef } from 'react';
import type { EvaluationResult, JointName, PoseSnapshot } from '../../types/contracts';
import { LocalPlankEvaluator } from '../../exercises/plank/evaluator';
import { drawSkeleton } from '../render/skeletonRenderer';
import type { FrameInfo } from './CameraView';
import plankCorrect from '../../exercises/plank/fixtures/plank-correct.json';
import plankHipSag from '../../exercises/plank/fixtures/plank-hip-sag.json';
import plankHipPike from '../../exercises/plank/fixtures/plank-hip-pike.json';

interface Props {
  onFrame: (info: FrameInfo) => void;
}

const FIXTURES: Array<{ label: string; snapshot: PoseSnapshot }> = [
  { label: 'plank-correct', snapshot: plankCorrect as unknown as PoseSnapshot },
  { label: 'plank-hip-sag', snapshot: plankHipSag as unknown as PoseSnapshot },
  { label: 'plank-hip-pike', snapshot: plankHipPike as unknown as PoseSnapshot },
];

const WIDTH = 640;
const HEIGHT = 480;
/** Ogni fixture resta in scena 4s; le regole girano a 10Hz come nel flusso reale. */
const FIXTURE_MS = 4000;
const TICK_MS = 100;

/** Modalità debug (?debug): riproduce i fixture in loop senza webcam né MediaPipe. */
export default function DebugView({ onFrame }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const evaluator = new LocalPlankEvaluator();
    const startedAt = Date.now();

    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const fixture = FIXTURES[Math.floor(elapsed / FIXTURE_MS) % FIXTURES.length];
      const snapshot: PoseSnapshot = { ...fixture.snapshot, timestamp: Date.now() };
      const evalStart = performance.now();
      const result: EvaluationResult = evaluator.evaluate(snapshot);
      const evalMs = performance.now() - evalStart;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0b1220';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        drawSkeleton(
          ctx,
          snapshot.landmarks,
          new Set<JointName>(result.jointsToColorRed),
          WIDTH,
          HEIGHT,
        );
      }
      if (labelRef.current) labelRef.current.textContent = `DEBUG · ${fixture.label}`;
      onFrame({ result, metrics: { inferenceMs: evalMs, frameSkip: 1 } });
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [onFrame]);

  return (
    <div className="stage">
      <canvas ref={canvasRef} className="overlay-static" />
      <div ref={labelRef} className="debug-label" />
    </div>
  );
}
