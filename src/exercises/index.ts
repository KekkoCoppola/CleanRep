import type { ExerciseType } from '../types/contracts';
import type { ExerciseDefinition } from '../core/exercise/types';
import { PLANK } from './plank/definition';

/**
 * Registro degli esercizi. Per aggiungerne uno: nuova cartella in
 * src/exercises/<nome>/ con una ExerciseDefinition, poi registrarla qui
 * (e aggiungere l'id a ExerciseType in src/types/contracts.ts).
 */
export const EXERCISES: Record<ExerciseType, ExerciseDefinition> = {
  PLANK,
};

export const DEFAULT_EXERCISE: ExerciseType = 'PLANK';
