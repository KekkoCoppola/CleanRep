import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_EXERCISE, EXERCISES } from '../exercises';
import { demoSession } from '../dev/synthetic';
import { loadRecordedSession } from '../dev/recorder';
import type { Sex } from '../core/analysis/holdReport';
import type { CameraFacing } from '../platform/camera/cameraSource';
import { DEFAULT_DETECTOR, type DetectorOptions, type PoseModel } from '../platform/pose/detectorOptions';
import type { RawPoseFrame } from '../core/tracking/types';
import HUD, { INITIAL_HUD, type HudState } from './components/HUD';
import type { SourceSpec, StageInfo } from './components/StageView';
import type { VideoAnalysisResult } from './analysis/analyzeVideo';

// Lazy: il chunk con MediaPipe si carica solo quando serve (live o analisi video).
const StageView = lazy(() => import('./components/StageView'));
const VideoAnalysisView = lazy(() => import('./components/VideoAnalysisView'));
const ReportView = lazy(() => import('./components/ReportView'));

type Phase = 'idle' | 'active' | 'analyzing' | 'report' | 'error';
type SourceKind = 'camera' | 'video' | 'recording' | 'demo';

/** L'HUD (stato React) si aggiorna 4 volte al secondo; il disegno va a frame rate pieno. */
const HUD_INTERVAL_MS = 250;

const params = new URLSearchParams(window.location.search);
const isDebug = params.has('debug');
const isRecord = params.has('record');
const MODELS: PoseModel[] = ['lite', 'full', 'heavy'];
const DETECTOR: DetectorOptions = {
  model: MODELS.includes(params.get('model') as PoseModel) ? (params.get('model') as PoseModel) : DEFAULT_DETECTOR.model,
  numPoses: Math.min(4, Math.max(1, Number(params.get('poses')) || DEFAULT_DETECTOR.numPoses)),
};

export default function App() {
  const exercise = EXERCISES[DEFAULT_EXERCISE];
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [facing, setFacing] = useState<CameraFacing>('user');
  const [sourceKind, setSourceKind] = useState<SourceKind>('camera');
  const [file, setFile] = useState<File | null>(null);
  const [replayFrames, setReplayFrames] = useState<RawPoseFrame[] | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [sex, setSex] = useState<Sex | ''>('');
  const [analysis, setAnalysis] = useState<VideoAnalysisResult | null>(null);
  const latest = useRef<StageInfo | null>(null);

  const onInfo = useCallback((info: StageInfo) => {
    latest.current = info;
  }, []);

  const onError = useCallback((message: string) => {
    setError(message);
    setPhase('error');
  }, []);

  const onAnalysisDone = useCallback((result: VideoAnalysisResult) => {
    setAnalysis(result);
    setPhase('report');
  }, []);

  const source = useMemo<SourceSpec | null>(() => {
    if (sourceKind === 'camera') return { kind: 'camera', facing };
    if (sourceKind === 'video') return file ? { kind: 'video', file } : null;
    return replayFrames ? { kind: 'replay', frames: replayFrames } : null;
  }, [sourceKind, facing, file, replayFrames]);

  useEffect(() => {
    if (phase !== 'active') return;
    const timer = setInterval(() => {
      const info = latest.current;
      if (!info) return;
      const { state } = info.output;
      setHud({
        phase: state.phase,
        score: state.result.overallScore,
        message: state.result.audioFeedback,
        isCorrect: state.result.isCorrect,
        holdSeconds: state.holdMs / 1000,
        correctSeconds: state.correctMs / 1000,
        variantName: state.variant ? (exercise.messages.variantNames?.[state.variant] ?? state.variant) : null,
        fps: info.metrics.fps,
        inferenceMs: info.metrics.inferenceMs,
      });
    }, HUD_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [phase, exercise]);

  const start = async () => {
    setError('');
    try {
      if (sourceKind === 'demo') setReplayFrames(demoSession());
      if (sourceKind === 'recording') {
        if (!file) throw new Error('Seleziona un file di registrazione (.json)');
        setReplayFrames(await loadRecordedSession(file));
      }
      if (sourceKind === 'video' && !file) throw new Error('Seleziona un file video');
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      return;
    }
    latest.current = null;
    setHud(INITIAL_HUD);
    setPhase('active');
  };

  const startAnalysis = () => {
    if (!videoFile) return;
    setError('');
    setAnalysis(null);
    setPhase('analyzing');
  };

  const backHome = () => setPhase('idle');

  const home = phase === 'idle' || phase === 'error';

  return (
    <main className="app">
      <header className="topbar">
        <img className="brand-logo" src={`${import.meta.env.BASE_URL}icon-512.png`} alt="" width={32} height={32} />
        <h1>CleanRep</h1>
        <span className="tagline">
          {exercise.name}
          {isDebug ? ' · DEBUG' : ''}
          {isRecord ? ' · REC' : ''}
        </span>
      </header>

      {home && (
        <section className="home">
          {phase === 'error' && <p className="ko error-box">{error}</p>}

          <div className="mode-card">
            <h2>Allenamento live</h2>
            <p>
              Appoggia il telefono a terra in verticale e mettiti <strong>di lato</strong>, a corpo intero
              nell’inquadratura. Lo scheletro diventa <span className="ok">verde</span> quando la postura è
              corretta e <span className="ko">rosso</span> sui punti da correggere; la voce ti corregge.
            </p>
            {isDebug && (
              <fieldset className="dev-source">
                <legend>Sorgente (debug)</legend>
                {(
                  [
                    ['camera', 'Fotocamera'],
                    ['video', 'File video'],
                    ['recording', 'Registrazione .json'],
                    ['demo', 'Demo sintetica'],
                  ] as Array<[SourceKind, string]>
                ).map(([kind, label]) => (
                  <label key={kind}>
                    <input
                      type="radio"
                      name="source"
                      checked={sourceKind === kind}
                      onChange={() => {
                        setSourceKind(kind);
                        setFile(null);
                      }}
                    />
                    {label}
                  </label>
                ))}
                {(sourceKind === 'video' || sourceKind === 'recording') && (
                  <input
                    type="file"
                    accept={sourceKind === 'video' ? 'video/*' : 'application/json,.json'}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                )}
              </fieldset>
            )}
            <button className="cta" onClick={start}>
              Inizia allenamento
            </button>
          </div>

          <div className="mode-card">
            <h2>Analizza un video</h2>
            <p>
              Carica un video del tuo plank ripreso <strong>di lato</strong>: ricevi un breve report su cosa migliorare,
              il tempo valido fino al cedimento tecnico e le immagini dei momenti da correggere.
            </p>
            <label className="file-pick">
              <input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} />
              <span>{videoFile ? videoFile.name : 'Scegli un video…'}</span>
            </label>
            <label className="field">
              <span>Valori di riferimento</span>
              <select value={sex} onChange={(e) => setSex(e.target.value as Sex | '')}>
                <option value="">Uomini e donne</option>
                <option value="male">Uomo</option>
                <option value="female">Donna</option>
              </select>
            </label>
            <button className="cta" onClick={startAnalysis} disabled={!videoFile}>
              Analizza video
            </button>
          </div>

          <p className="hint">
            Consigli: telefono a ~50 cm da terra e a 2–3 metri, tutto il corpo visibile dalla testa ai piedi, luce
            frontale e nessun controluce, possibilmente nessun’altra persona nell’inquadratura.
          </p>
          <p className="hint">Tutto gira in locale sul dispositivo: nessun video lascia il telefono.</p>
        </section>
      )}

      {phase === 'active' && source && (
        <>
          <Suspense fallback={<div className="loading">Caricamento modello AI…</div>}>
            <StageView
              source={source}
              exercise={exercise}
              detector={DETECTOR}
              debug={isDebug}
              record={isRecord}
              onInfo={onInfo}
              onError={onError}
            />
          </Suspense>
          <HUD {...hud} />
          <div className="controls">
            {sourceKind === 'camera' && (
              <button className="secondary" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}>
                {facing === 'user' ? 'Usa camera posteriore' : 'Usa camera frontale'}
              </button>
            )}
            <button className="secondary" onClick={backHome}>
              Termina sessione
            </button>
          </div>
        </>
      )}

      {phase === 'analyzing' && videoFile && (
        <Suspense fallback={<div className="loading">Caricamento…</div>}>
          <VideoAnalysisView
            file={videoFile}
            exercise={exercise}
            detector={DETECTOR}
            sex={sex || undefined}
            onDone={onAnalysisDone}
            onError={onError}
            onCancel={backHome}
          />
        </Suspense>
      )}

      {phase === 'report' && analysis && (
        <Suspense fallback={<div className="loading">Caricamento…</div>}>
          <ReportView result={analysis} onNew={backHome} />
        </Suspense>
      )}
    </main>
  );
}
