import { useEffect, useRef } from 'react';
import type { ExerciseDefinition } from '../../core/exercise/types';
import { TrainingPipeline, type PipelineOutput } from '../../core/pipeline';
import type { RawPoseFrame } from '../../core/tracking/types';
import { SessionRecorder } from '../../dev/recorder';
import { cameraErrorMessage, openCamera, stopStream, type CameraFacing } from '../../platform/camera/cameraSource';
import {
  ReplayFrameSource,
  VideoFrameSource,
  type FrameHandler,
  type FrameSource,
  type SourceMetrics,
} from '../../platform/frameSource';
import { getDetector, type DetectorOptions } from '../../platform/pose/detector';
import { GravitySensor } from '../../platform/sensors/gravity';
import { getSpeechOutput } from '../../platform/speech';
import { ScreenWakeLock } from '../../platform/wakeLock';
import { drawDebug } from '../render/debugRenderer';
import { drawFrameImage, drawSkeleton } from '../render/skeletonRenderer';
import { containViewport } from '../render/viewport';

export type SourceSpec =
  | { kind: 'camera'; facing: CameraFacing }
  | { kind: 'video'; file: File }
  | { kind: 'replay'; frames: RawPoseFrame[] };

export interface StageInfo {
  output: PipelineOutput;
  metrics: SourceMetrics;
  lastUtterance: string | null;
}

interface Props {
  source: SourceSpec;
  exercise: ExerciseDefinition;
  detector: DetectorOptions;
  debug: boolean;
  record: boolean;
  onInfo: (info: StageInfo) => void;
  onError: (message: string) => void;
}

/**
 * Palco dell'allenamento. Un solo canvas disegna, a ogni frame analizzato,
 * l'immagine di QUEL frame e lo scheletro calcolato su di esso con la stessa
 * viewport: allineamento esatto con qualsiasi proporzione e rotazione.
 * Loop imperativo fuori da React: nessun re-render per frame.
 */
export default function StageView({ source, exercise, detector, debug, record, onInfo, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const container = containerRef.current!;
    const canvas = canvasRef.current!;
    const video = videoRef.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pipeline = new TrainingPipeline(exercise);
    const speech = getSpeechOutput();
    const gravity = new GravitySensor();
    const wakeLock = new ScreenWakeLock();
    const recorder = record ? new SessionRecorder(exercise.id) : null;
    let frameSource: FrameSource | null = null;
    let stream: MediaStream | undefined;
    let objectUrl: string | undefined;
    let lastUtterance: string | null = null;
    let disposed = false;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const onFrame: FrameHandler = (frame, image) => {
      if (!frameSource) return;
      recorder?.push(frame);
      const output = pipeline.process(frame, speech.isSpeaking());
      if (output.utterance) {
        speech.speak(output.utterance.text, { interrupt: output.utterance.interrupt });
        lastUtterance = output.utterance.text;
      }
      const vp = containViewport(frame.width, frame.height, canvas.width, canvas.height, frameSource.mirrored);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (image) drawFrameImage(ctx, image, vp);
      drawSkeleton(ctx, vp, output.pose, output.state);
      const metrics = frameSource.metrics();
      if (debug) drawDebug(ctx, vp, output, metrics, lastUtterance);
      onInfo({ output, metrics, lastUtterance });
    };

    (async () => {
      try {
        gravity.start();
        void wakeLock.enable();
        if (source.kind === 'replay') {
          frameSource = new ReplayFrameSource(source.frames);
        } else {
          let mirrored = false;
          let front = false;
          if (source.kind === 'camera') {
            const cam = await openCamera(source.facing);
            if (disposed) {
              stopStream(cam.stream);
              return;
            }
            stream = cam.stream;
            video.srcObject = cam.stream;
            mirrored = cam.mirrored;
            front = cam.facing === 'user';
          } else {
            objectUrl = URL.createObjectURL(source.file);
            video.src = objectUrl;
            video.loop = true;
          }
          video.muted = true;
          await video.play();
          const poseDetector = await getDetector(detector);
          if (disposed) return;
          frameSource = new VideoFrameSource(
            video,
            poseDetector,
            mirrored,
            source.kind === 'camera' ? gravity : null,
            front,
          );
        }
        frameSource.start(onFrame);
      } catch (err) {
        if (!disposed) onError(cameraErrorMessage(err));
      }
    })();

    return () => {
      disposed = true;
      frameSource?.stop();
      observer.disconnect();
      gravity.stop();
      wakeLock.disable();
      speech.cancel();
      stopStream(stream);
      video.srcObject = null;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (recorder && recorder.size > 0) recorder.download();
    };
  }, [source, exercise, detector, debug, record, onInfo, onError]);

  return (
    <div className="stage" ref={containerRef}>
      <video ref={videoRef} className="source-video" playsInline muted />
      <canvas ref={canvasRef} className="stage-canvas" />
    </div>
  );
}
