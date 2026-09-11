import type { SessionPhase } from '../../types/contracts';

export interface HudState {
  phase: SessionPhase;
  score: number;
  message: string;
  isCorrect: boolean;
  holdSeconds: number;
  correctSeconds: number;
  variantName: string | null;
  fps: number;
  inferenceMs: number;
}

export const INITIAL_HUD: HudState = {
  phase: 'NO_SUBJECT',
  score: 0,
  message: 'Avvio della fotocamera…',
  isCorrect: false,
  holdSeconds: 0,
  correctSeconds: 0,
  variantName: null,
  fps: 0,
  inferenceMs: 0,
};

const PHASE_LABEL: Record<SessionPhase, string> = {
  NO_SUBJECT: 'Nessuno inquadrato',
  SETUP: 'Preparazione',
  HOLDING: 'In posizione',
  PAUSED: 'Pausa',
};

export default function HUD(h: HudState) {
  const holding = h.phase === 'HOLDING';
  const tone = holding ? (h.isCorrect ? 'ok' : 'ko') : 'neutral';
  return (
    <div className="hud">
      <div className={`hud-score ${tone}`}>
        <span className="hud-score-value">{holding ? h.score : '–'}</span>
        <span className="hud-score-max">/10</span>
      </div>
      <div className="hud-center">
        <div className="hud-phase">
          {PHASE_LABEL[h.phase]}
          {holding && h.variantName ? ` · ${h.variantName}` : ''}
        </div>
        <div className={`hud-message ${tone}`}>{h.message}</div>
        <div className="hud-timer">
          Tempo {h.holdSeconds.toFixed(0)}s · forma corretta {h.correctSeconds.toFixed(0)}s
        </div>
      </div>
      <div className="hud-perf" title="Frame analizzati al secondo · tempo medio di inferenza">
        {h.fps.toFixed(0)} fps
        <br />
        {h.inferenceMs.toFixed(0)} ms
      </div>
    </div>
  );
}
