import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { FrameInfo } from './components/CameraView';
import HUD from './components/HUD';
import { resetSpeech, speak } from './feedback/speech';
import { FEEDBACK } from './engine/plankRules';

// Lazy: il chunk con MediaPipe (~WASM+modello via CDN) si carica solo al click "Inizia".
const CameraView = lazy(() => import('./components/CameraView'));
const DebugView = lazy(() => import('./components/DebugView'));

type Phase = 'idle' | 'active' | 'error';

interface HudState {
  score: number;
  message: string;
  isCorrect: boolean;
  plankSeconds: number;
  inferenceMs: number;
  frameSkip: number;
}

const INITIAL_HUD: HudState = {
  score: 0,
  message: 'In attesa della posa…',
  isCorrect: false,
  plankSeconds: 0,
  inferenceMs: 0,
  frameSkip: 1,
};

/** L'HUD (stato React) si aggiorna al massimo 2 volte al secondo. */
const HUD_INTERVAL_MS = 500;

const isDebug = new URLSearchParams(window.location.search).has('debug');

export default function App() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const latestFrame = useRef<FrameInfo | null>(null);
  const plankSeconds = useRef(0);
  const wasCorrect = useRef(false);

  const onFrame = useCallback((info: FrameInfo) => {
    latestFrame.current = info;
  }, []);

  const onError = useCallback((message: string) => {
    setError(message);
    setPhase('error');
  }, []);

  useEffect(() => {
    if (phase !== 'active') return;
    const timer = setInterval(() => {
      const frame = latestFrame.current;
      if (!frame) return;
      const { result, metrics } = frame;

      if (result.isCorrect) {
        plankSeconds.current += HUD_INTERVAL_MS / 1000;
        // Elogio solo alla transizione errato→corretto (mai in loop).
        if (!wasCorrect.current) speak(FEEDBACK.correct);
      } else if (result.overallScore > 0) {
        speak(result.audioFeedback);
      }
      wasCorrect.current = result.isCorrect;

      setHud({
        score: result.overallScore,
        message: result.audioFeedback,
        isCorrect: result.isCorrect,
        plankSeconds: plankSeconds.current,
        inferenceMs: metrics.inferenceMs,
        frameSkip: metrics.frameSkip,
      });
    }, HUD_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [phase]);

  const start = () => {
    plankSeconds.current = 0;
    wasCorrect.current = false;
    latestFrame.current = null;
    resetSpeech();
    setHud(INITIAL_HUD);
    setPhase('active');
  };

  const stop = () => {
    resetSpeech();
    setPhase('idle');
  };

  return (
    <main className="app">
      <header className="topbar">
        <h1>CleanRep</h1>
        <span className="tagline">Live AR Fitness Trainer — Plank{isDebug ? ' · DEBUG' : ''}</span>
      </header>

      {phase === 'idle' && (
        <section className="idle">
          <p>
            Posiziona il dispositivo in modo da essere ripreso <strong>di lato</strong>, a corpo
            intero. Lo scheletro diventa <span className="ok">verde</span> quando la postura è
            corretta e <span className="ko">rosso</span> sui punti da correggere.
          </p>
          <button className="cta" onClick={start}>
            Inizia allenamento
          </button>
          <p className="hint">
            Consigli: camera a ~50 cm da terra, tutto il corpo nell'inquadratura, ambiente ben
            illuminato e senza controluce.
          </p>
          <p className="hint">
            Tutto gira in locale nel tuo browser: nessun video lascia il dispositivo.
          </p>
        </section>
      )}

      {phase === 'error' && (
        <section className="idle">
          <p className="ko">{error}</p>
          <button className="cta" onClick={start}>
            Riprova
          </button>
        </section>
      )}

      {phase === 'active' && (
        <>
          <Suspense fallback={<div className="loading">Caricamento modello AI…</div>}>
            {isDebug ? (
              <DebugView onFrame={onFrame} />
            ) : (
              <CameraView onFrame={onFrame} onError={onError} />
            )}
          </Suspense>
          <HUD {...hud} />
          <button className="stop" onClick={stop}>
            Termina sessione
          </button>
        </>
      )}
    </main>
  );
}
