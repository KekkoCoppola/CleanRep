import type { MuscleTarget } from './RoutineTypes';

interface TorsoProps {
  highlight?: MuscleTarget;
  size?: number;
  className?: string;
}

/**
 * Sagoma anatomica vettoriale ultra-nitida fedele al mockup:
 * Torso maschile stilizzato con il gruppo muscolare target evidenziato in bianco ad alto contrasto.
 */
export function MuscleTorsoGraphic({ highlight = 'chest', size = 52, className = '' }: TorsoProps) {
  const isDelts = highlight === 'front-delts';
  const isChest = highlight === 'chest';
  const isSideDelts = highlight === 'side-delts';
  const isAbs = highlight === 'abs';
  const isTriceps = highlight === 'triceps';
  const isLats = highlight === 'lats';
  const isTraps = highlight === 'traps';

  const baseFill = '#383b48';
  const highlightFill = '#ffffff';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={`muscle-torso-svg ${className}`}
      aria-hidden="true"
    >
      {/* Collo & Trapezi */}
      <path
        d="M26 12 L38 12 L36 20 L28 20 Z"
        fill={isTraps ? highlightFill : baseFill}
      />
      <path
        d="M22 18 L26 12 L28 20 L20 23 Z"
        fill={isTraps ? highlightFill : baseFill}
      />
      <path
        d="M42 18 L38 12 L36 20 L44 23 Z"
        fill={isTraps ? highlightFill : baseFill}
      />

      {/* Front Delts (Spalle anteriori) */}
      <path
        d="M12 25 C12 19, 16 16, 21 17 C23 19, 24 23, 23 26 C21 28, 16 30, 12 25 Z"
        fill={isDelts ? highlightFill : baseFill}
      />
      <path
        d="M52 25 C52 19, 48 16, 43 17 C41 19, 40 23, 41 26 C43 28, 48 30, 52 25 Z"
        fill={isDelts ? highlightFill : baseFill}
      />

      {/* Side Delts (Spalle laterali) */}
      <path
        d="M8 29 C8 24, 11 22, 13 25 C12 30, 10 35, 7 38 C6 35, 7 31, 8 29 Z"
        fill={isSideDelts ? highlightFill : baseFill}
      />
      <path
        d="M56 29 C56 24, 53 22, 51 25 C52 30, 54 35, 57 38 C58 35, 57 31, 56 29 Z"
        fill={isSideDelts ? highlightFill : baseFill}
      />

      {/* Braccia / Bicipiti / Tricipiti */}
      <path
        d="M9 36 C11 32, 14 31, 15 36 C16 41, 13 46, 10 48 C8 45, 8 40, 9 36 Z"
        fill={isTriceps ? highlightFill : baseFill}
      />
      <path
        d="M55 36 C53 32, 50 31, 49 36 C48 41, 51 46, 54 48 C56 45, 56 40, 55 36 Z"
        fill={isTriceps ? highlightFill : baseFill}
      />

      {/* Pettorali (Chest) - Sinistro & Destro */}
      <path
        d="M22 22 C26 21, 31 22, 31 24 C31 29, 28 32, 22 32 C17 32, 16 27, 18 24 C19 23, 20 22, 22 22 Z"
        fill={isChest ? highlightFill : baseFill}
      />
      <path
        d="M42 22 C38 21, 33 22, 33 24 C33 29, 36 32, 42 32 C47 32, 48 27, 46 24 C45 23, 44 22, 42 22 Z"
        fill={isChest ? highlightFill : baseFill}
      />

      {/* Dorsali (Lats) */}
      <path
        d="M17 34 C19 33, 21 34, 21 37 C20 42, 17 46, 15 48 C15 44, 16 38, 17 34 Z"
        fill={isLats ? highlightFill : baseFill}
      />
      <path
        d="M47 34 C45 33, 43 34, 43 37 C44 42, 47 46, 49 48 C49 44, 48 38, 47 34 Z"
        fill={isLats ? highlightFill : baseFill}
      />

      {/* Addominali (Abs 6-pack) */}
      <rect x="24" y="34" width="7" height="4" rx="1.5" fill={isAbs ? highlightFill : baseFill} />
      <rect x="33" y="34" width="7" height="4" rx="1.5" fill={isAbs ? highlightFill : baseFill} />
      <rect x="24" y="39" width="7" height="4" rx="1.5" fill={isAbs ? highlightFill : baseFill} />
      <rect x="33" y="39" width="7" height="4" rx="1.5" fill={isAbs ? highlightFill : baseFill} />
      <rect x="25" y="44" width="6" height="5" rx="1.5" fill={isAbs ? highlightFill : baseFill} />
      <rect x="33" y="44" width="6" height="5" rx="1.5" fill={isAbs ? highlightFill : baseFill} />
    </svg>
  );
}

interface ExerciseIllustrationProps {
  exerciseName?: string;
  className?: string;
}

/**
 * Grafica dell'atleta su panca inclinata identica a Personalizzazione esercizio.png
 */
export function ExerciseCustomizationGraphic({ className = '' }: ExerciseIllustrationProps) {
  return (
    <div className={`exercise-customization-graphic-wrapper ${className}`}>
      <img
        src={`${import.meta.env.BASE_URL}assets/incline_press_illustration_raw.png`}
        alt="Esecuzione esercizio panca inclinata"
        className="exercise-incline-graphic-img"
      />
    </div>
  );
}
