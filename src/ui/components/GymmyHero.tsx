export type DayMode = 'rest' | 'workout';

interface Props {
  mode: DayMode;
  onToggleMode?: () => void;
}

/**
 * Componente Mascot Gymmy per la Hero Section della Home.
 * Mostra:
 * - In "rest": Gymmy che dorme nel letto con Zzz fluttuanti e bagliore soft
 * - In "workout": Gymmy che fa squat con il bilanciere e gocce di sudore
 */
export default function GymmyHero({ mode, onToggleMode }: Props) {
  const isRest = mode === 'rest';

  return (
    <div
      className="gymmy-hero-container"
      onClick={onToggleMode}
      role="button"
      title="Tocca per alternare tra Rest Day e Workout Day"
    >
      {/* Mascotte Gymmy */}
      <div className="gymmy-character-wrap">
        {isRest ? (
          <div className="gymmy-rest-wrapper">
            {/* Animazione Zzz sonno */}
            <div className="gymmy-zzz-container" aria-hidden="true">
              <span className="zzz-letter z3">Z</span>
              <span className="zzz-letter z2">Z</span>
              <span className="zzz-letter z1">z</span>
            </div>
            <img
              src={`${import.meta.env.BASE_URL}assets/gymmy/gymmy-rest.png`}
              alt="Gymmy riposa (Rest Day)"
              className="gymmy-img gymmy-rest-img"
              loading="eager"
            />
          </div>
        ) : (
          <div className="gymmy-workout-wrapper">
            <img
              src={`${import.meta.env.BASE_URL}assets/gymmy/gymmy-workout.png`}
              alt="Gymmy squat con bilanciere (Workout Day)"
              className="gymmy-img gymmy-workout-img"
              loading="eager"
            />
          </div>
        )}
      </div>

    </div>
  );
}
