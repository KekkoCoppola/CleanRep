import type { DayMode } from './GymmyHero';

interface Props {
  mode: DayMode;
  onToggleMode?: () => void;
}

/**
 * Header fisso in alto con il titolo stilizzato "Rest Day" / "Workout Day".
 * Utilizza l'iconico logo 'R' con il bicipite integrato nella parola.
 * Rimane fisso (sticky) in cima alla schermata durante lo scroll.
 */
export default function DayHeader({ mode, onToggleMode }: Props) {
  const isRest = mode === 'rest';

  return (
    <header className="day-sticky-header">
      <button
        type="button"
        className="day-title-btn"
        onClick={onToggleMode}
        title="Tocca per cambiare modalità (Rest / Workout)"
      >
        {isRest ? (
          <div className="day-title-text rest">
            <img
              src={`${import.meta.env.BASE_URL}assets/logo/CleanRep_R.svg`}
              alt="R"
              className="cleanrep-inline-r"
            />
            <span className="title-suffix">est Day</span>
          </div>
        ) : (
          <div className="day-title-text workout">
            <span className="title-prefix">Wo</span>
            <img
              src={`${import.meta.env.BASE_URL}assets/logo/CleanRep_R.svg`}
              alt="R"
              className="cleanrep-inline-r workout-r"
            />
            <span className="title-suffix">kout Day</span>
          </div>
        )}
      </button>
    </header>
  );
}
