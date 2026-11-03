import type { CatalogExercise } from '../RoutineTypes';
import catalog from './exercises.json';

/**
 * Catalogo esercizi generato da ExerciseDB (npm run catalog).
 * Il JSON è prodotto da buildCatalog tipizzato: il cast recupera i literal di MuscleTarget.
 */
export const EXERCISE_CATALOG = catalog as CatalogExercise[];

/** Minuscole, senza accenti, spazi compressi. */
function normalizeQuery(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cerca sia nel nome italiano sia in quello inglese; query vuota → catalogo intero. */
export function searchExercises(exercises: CatalogExercise[], query: string): CatalogExercise[] {
  const q = normalizeQuery(query);
  if (!q) return exercises;
  return exercises.filter(
    (exercise) => normalizeQuery(exercise.name).includes(q) || normalizeQuery(exercise.nameEn).includes(q),
  );
}
