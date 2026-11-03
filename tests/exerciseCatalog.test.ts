import { describe, expect, it } from 'vitest';
import { EXERCISE_CATALOG, searchExercises } from '../src/ui/routine/catalog/exerciseCatalog';
import { resolveExerciseForm } from '../src/ui/routine/catalog/exerciseForm';
import type { CatalogExercise } from '../src/ui/routine/RoutineTypes';

const exercise = (name: string, nameEn: string): CatalogExercise => ({
  id: nameEn,
  name,
  nameEn,
  gifUrl: 'https://static.exercisedb.dev/media/x.gif',
  primaryMuscles: [],
  equipment: [],
});

describe('EXERCISE_CATALOG', () => {
  it('contiene il catalogo ExerciseDB deduplicato', () => {
    expect(EXERCISE_CATALOG.length).toBeGreaterThan(1200);
    expect(new Set(EXERCISE_CATALOG.map((e) => e.id)).size).toBe(EXERCISE_CATALOG.length);
  });

  it('ogni esercizio punta a una GIF ExerciseDB', () => {
    expect(EXERCISE_CATALOG.every((e) => /^https:\/\/static\.exercisedb\.dev\/media\/\w+\.gif$/.test(e.gifUrl))).toBe(true);
  });
});

describe('searchExercises', () => {
  const fixture = [
    exercise('Alzate laterali con manubri', 'Dumbbell Lateral Raise'),
    exercise('Lat machine', 'Cable Pulldown'),
  ];

  it('ignora maiuscole e spazi extra', () => {
    expect(searchExercises(fixture, '  ALZATE   laterali ')).toHaveLength(1);
    expect(searchExercises(fixture, '  LAT MACHINE ')).toHaveLength(1);
  });

  it('ignora gli accenti', () => {
    expect(searchExercises(fixture, 'àlzate')).toHaveLength(1);
  });

  it('trova anche per nome inglese', () => {
    expect(searchExercises(fixture, 'lateral raise')).toHaveLength(1);
    expect(searchExercises(fixture, 'pulldown')).toHaveLength(1);
  });

  it('query vuota → catalogo intero, nessuna corrispondenza → lista vuota', () => {
    expect(searchExercises(fixture, '')).toBe(fixture);
    expect(searchExercises(fixture, '   ')).toBe(fixture);
    expect(searchExercises(fixture, 'squat')).toEqual([]);
  });
});

describe('resolveExerciseForm', () => {
  it('campi vuoti o solo spazi → 3 sets da 8-12, nessuna nota', () => {
    expect(resolveExerciseForm({ sets: '', reps: '  ', notes: '' }, {})).toEqual({ sets: 3, reps: '8-12', notes: '' });
  });

  it('sets non validi → 3', () => {
    expect(resolveExerciseForm({ sets: '0', reps: '', notes: '' }, {}).sets).toBe(3);
    expect(resolveExerciseForm({ sets: 'abc', reps: '', notes: '' }, {}).sets).toBe(3);
  });

  it('valori inseriti vengono rispettati (trim)', () => {
    expect(resolveExerciseForm({ sets: '5', reps: '10', notes: ' RPE 8 ' }, {})).toEqual({ sets: 5, reps: '10', notes: 'RPE 8' });
  });

  it('nota vuota → nota dell\'ex preset se presente', () => {
    expect(resolveExerciseForm({ sets: '', reps: '', notes: '' }, { notesPlaceholder: 'Fermo al petto' }).notes).toBe('Fermo al petto');
  });
});
