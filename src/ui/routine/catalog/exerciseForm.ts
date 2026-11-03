import { DEFAULT_REPS, DEFAULT_SETS, MAX_SETS, type CatalogExercise } from '../RoutineTypes';

/** Valori grezzi dei campi della schermata "Personalizzazione esercizio". */
export interface ExerciseFormInput {
  sets: string;
  reps: string;
  notes: string;
}

/**
 * Campo vuoto o non valido → valore del placeholder; sets oltre MAX_SETS → MAX_SETS.
 * La nota esempio generica non viene mai salvata.
 */
export function resolveExerciseForm(
  input: ExerciseFormInput,
  exercise: Pick<CatalogExercise, 'notesPlaceholder'>,
): { sets: number; reps: string; notes: string } {
  const sets = parseInt(input.sets, 10);
  return {
    sets: sets >= 1 ? Math.min(sets, MAX_SETS) : DEFAULT_SETS,
    reps: input.reps.trim() || DEFAULT_REPS,
    notes: input.notes.trim() || (exercise.notesPlaceholder ?? ''),
  };
}
