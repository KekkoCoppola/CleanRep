import type { CatalogExercise } from '../RoutineTypes';
import catalog from './exercises.json';

/**
 * Catalogo esercizi generato da ExerciseDB (npm run catalog).
 * Il JSON è prodotto da buildCatalog tipizzato: il cast recupera i literal di MuscleTarget.
 */
export const EXERCISE_CATALOG = catalog as CatalogExercise[];

/** Minuscole, senza accenti, punteggiatura ("Pull-Up", "EZ-Bar") ridotta a spazi singoli. */
function normalizeQuery(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

interface SearchKey {
  /** Nome italiano e inglese normalizzati; il separatore impedisce match a cavallo dei due. */
  spaced: string;
  /** Come `spaced` ma senza spazi, per query come "pushup" o "tbar". */
  compact: string;
}

/** Chiavi calcolate una volta per esercizio, non a ogni tasto premuto. */
const searchKeys = new WeakMap<CatalogExercise, SearchKey>();

function searchKey(exercise: CatalogExercise): SearchKey {
  let key = searchKeys.get(exercise);
  if (!key) {
    const it = normalizeQuery(exercise.name);
    const en = normalizeQuery(exercise.nameEn);
    key = { spaced: `${it}|${en}`, compact: `${it.replace(/ /g, '')}|${en.replace(/ /g, '')}` };
    searchKeys.set(exercise, key);
  }
  return key;
}

/** Cerca sia nel nome italiano sia in quello inglese; query vuota → catalogo intero. */
export function searchExercises(exercises: CatalogExercise[], query: string): CatalogExercise[] {
  const q = normalizeQuery(query);
  if (!q) return exercises;
  const compactQuery = q.replace(/ /g, '');
  return exercises.filter((exercise) => {
    const key = searchKey(exercise);
    return key.spaced.includes(q) || key.compact.includes(compactQuery);
  });
}
