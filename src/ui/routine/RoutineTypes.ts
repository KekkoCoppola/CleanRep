export type MuscleTarget =
  | 'front-delts'
  | 'chest'
  | 'side-delts'
  | 'triceps'
  | 'biceps'
  | 'lats'
  | 'traps'
  | 'abs'
  | 'legs';

/**
 * Esercizio del catalogo generato da ExerciseDB (scripts/build-exercise-catalog.ts).
 */
export interface CatalogExercise {
  /** exerciseId ExerciseDB */
  id: string;
  /** Nome italiano da palestra (fallback: nameEn) */
  name: string;
  nameEn: string;
  gifUrl: string;
  primaryMuscles: MuscleTarget[];
  equipment: string[];
  /** Nota italiana degli ex preset, mostrata come placeholder */
  notesPlaceholder?: string;
}

/** Valori usati come placeholder nel form e salvati se il campo resta vuoto. */
export const DEFAULT_SETS = 3;
export const DEFAULT_REPS = '8-12';
/** Solo esempio visivo: non viene mai salvato. */
export const DEFAULT_NOTES_PLACEHOLDER = 'es. RPE 8, pausa 90s...';

export interface RoutineExercise {
  id: string;
  exerciseId: string;
  name: string;
  sets: number;
  reps: string;
  notes: string;
  primaryMuscles: MuscleTarget[];
}

export interface Routine {
  id: string;
  name: string;
  estimatedMinutes: number;
  exercises: RoutineExercise[];
  createdAt: number;
}

export interface MuscleVolumeStats {
  muscle: MuscleTarget;
  displayName: string;
  sets: number;
  targetMax: number; // 18 nel mockup
  trend: 'Growing' | 'Optimal' | 'Maintenance';
}

export const MUSCLE_DISPLAY_NAMES: Record<MuscleTarget, string> = {
  'front-delts': 'Front delts',
  chest: 'Chest',
  'side-delts': 'Side delts',
  triceps: 'Triceps',
  biceps: 'Biceps',
  lats: 'Lats',
  traps: 'Traps',
  abs: 'Abs',
  legs: 'Legs',
};
