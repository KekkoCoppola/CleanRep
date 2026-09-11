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
import WorkoutsDashboard from './components/WorkoutsDashboard';
import BottomNavBar, { type NavTab } from './components/BottomNavBar';
import { ArrowLeftIcon } from './components/Icons';
import OnboardingWizard from './components/OnboardingWizard';
import { isOnboardingCompleted } from '../platform/profile/userProfile';

// Lazy loading dei moduli pesanti (MediaPipe, analisi video, report)
const StageView = lazy(() => import('./components/StageView'));
const VideoAnalysisView = lazy(() => import('./components/VideoAnalysisView'));
const ReportView = lazy(() => import('./components/ReportView'));

type Phase = 'idle' | 'active' | 'analyzing' | 'report' | 'error';
type SourceKind = 'camera' | 'video' | 'recording' | 'demo';

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
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(() => {
    if (params.has('onboarding')) return false;
    return isOnboardingCompleted();
  });
  const [error, setError] = useState('');
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [facing, setFacing] = useState<CameraFacing>('user');
  const [sourceKind, setSourceKind] = useState<SourceKind>('camera');
  const [file, setFile] = useState<File | null>(null);
  const [replayFrames, setReplayFrames] = useState<RawPoseFrame[] | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [sex, setSex] = useState<Sex | ''>('');
  const [analysis, setAnalysis] = useState<VideoAnalysisResult | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
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

  /**
   * Avvia l'allenamento con fotocamera live in tempo reale (Live Cam Workout).
   * Invocato cliccando sull'icona della videocamera nella navbar o sulle card workout.
   */
  const startLiveCam = (_routineId?: string) => {
    setError('');
    setSourceKind('camera');
    latest.current = null;
    setHud(INITIAL_HUD);
    setPhase('active');
  };

  /**
   * Avvio modalità debug / demo se configurata
   */
  const startWithSource = async (kind: SourceKind) => {
    setError('');
    setSourceKind(kind);
    try {
      if (kind === 'demo') setReplayFrames(demoSession());
      if (kind === 'recording') {
        if (!file) throw new Error('Seleziona un file di registrazione (.json)');
        setReplayFrames(await loadRecordedSession(file));
      }
      if (kind === 'video' && !file) throw new Error('Seleziona un file video');
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
    setShowVideoModal(false);
    setPhase('analyzing');
  };

  const backHome = () => {
    setPhase('idle');
    setActiveTab('dashboard');
  };

  if (!hasCompletedOnboarding) {
    return (
      <main className="app">
        <OnboardingWizard
          onComplete={(_profile) => {
            setHasCompletedOnboarding(true);
          }}
        />
      </main>
    );
  }

  const isHome = phase === 'idle' || phase === 'error';

  return (
    <main className="app">
      {/* Visualizzazione Dashboard Home (Mockup) */}
      {isHome && (
        <>
          {error && <div className="error-box">{error}</div>}

          <WorkoutsDashboard
            onStartLiveWorkout={startLiveCam}
            onOpenVideoAnalysis={() => setShowVideoModal(true)}
            onOpenOnboarding={() => setHasCompletedOnboarding(false)}
          />

          {/* Modal Caricamento Video per Analisi */}
          {showVideoModal && (
            <div className="video-analysis-modal" role="dialog" aria-modal="true">
              <div className="video-analysis-modal-content">
                <h3>Analizza un video</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Carica un video di lato per verificare la tecnica, il tempo valido e le correzioni.
                </p>
                <label className="file-pick">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                  />
                  <span>{videoFile ? videoFile.name : 'Tocca per scegliere un video…'}</span>
                </label>
                <label className="field">
                  <span>Valori di riferimento:</span>
                  <select value={sex} onChange={(e) => setSex(e.target.value as Sex | '')}>
                    <option value="">Tutti</option>
                    <option value="male">Uomo</option>
                    <option value="female">Donna</option>
                  </select>
                </label>
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button
                    className="cta"
                    style={{ flex: 1 }}
                    onClick={startAnalysis}
                    disabled={!videoFile}
                  >
                    Avvia analisi
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setShowVideoModal(false)}
                  >
                    Chiudi
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modalità Sorgente Debug (visibile solo se URL ha ?debug) */}
          {isDebug && (
            <div style={{ padding: '0 16px 80px 16px' }}>
              <fieldset className="dev-source">
                <legend>Sorgente avanzata (debug)</legend>
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
                <button
                  className="secondary"
                  style={{ marginTop: '8px' }}
                  onClick={() => startWithSource(sourceKind)}
                >
                  Avvia sorgente debug
                </button>
              </fieldset>
            </div>
          )}

          {/* Bottom Docked Navbar con Icona Videocamera */}
          <BottomNavBar
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            onStartLiveCam={() => startLiveCam()}
          />
        </>
      )}

      {/* Fase 2: Allenamento Live AR con MediaPipe e HUD */}
      {phase === 'active' && source && (
        <div className="live-workout-container">
          <header className="live-workout-topbar">
            <button className="live-exit-btn" onClick={backHome} aria-label="Termina sessione">
              <ArrowLeftIcon size={18} />
              <span>Termina</span>
            </button>
            <div className="live-exercise-pill">CleanRep · {exercise.name}</div>
            {sourceKind === 'camera' && (
              <button
                className="live-flip-btn"
                onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
                aria-label="Cambia fotocamera"
              >
                {facing === 'user' ? 'Posteriore' : 'Frontale'}
              </button>
            )}
          </header>

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
        </div>
      )}

      {/* Fase 3: Analisi Video in corso */}
      {phase === 'analyzing' && videoFile && (
        <Suspense fallback={<div className="loading">Caricamento motore AI…</div>}>
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

      {/* Fase 4: Report Analisi Video */}
      {phase === 'report' && analysis && (
        <Suspense fallback={<div className="loading">Caricamento report…</div>}>
          <ReportView result={analysis} onNew={backHome} />
        </Suspense>
      )}
    </main>
  );
}
