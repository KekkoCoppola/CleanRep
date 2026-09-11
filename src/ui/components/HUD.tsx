interface Props {
  score: number;
  message: string;
  isCorrect: boolean;
  plankSeconds: number;
  inferenceMs: number;
  frameSkip: number;
}

export default function HUD({
  score,
  message,
  isCorrect,
  plankSeconds,
  inferenceMs,
  frameSkip,
}: Props) {
  return (
    <div className="hud">
      <div className={`hud-score ${isCorrect ? 'ok' : 'ko'}`}>
        <span className="hud-score-value">{score}</span>
        <span className="hud-score-max">/10</span>
      </div>
      <div className="hud-center">
        <div className={`hud-message ${isCorrect ? 'ok' : 'ko'}`}>{message}</div>
        <div className="hud-timer">Plank: {plankSeconds.toFixed(1)}s</div>
      </div>
      <div className="hud-perf" title="Tempo medio di inferenza per frame">
        {inferenceMs.toFixed(1)} ms{frameSkip > 1 ? ' · eco' : ''}
      </div>
    </div>
  );
}
