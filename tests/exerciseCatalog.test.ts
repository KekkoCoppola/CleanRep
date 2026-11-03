import { describe, expect, it } from 'vitest';
import { loadExerciseCatalog, searchExercises } from '../src/ui/routine/catalog/exerciseCatalog';
import { resolveExerciseForm } from '../src/ui/routine/catalog/exerciseForm';
import { MUSCLE_DISPLAY_NAMES, type CatalogExercise } from '../src/ui/routine/RoutineTypes';
import { LEGACY_PRESET_NOTES } from '../scripts/exercise-catalog/legacyPresetNotes.ts';
import { normalizeName } from '../scripts/exercise-catalog/transform.ts';

const EXERCISE_CATALOG = await loadExerciseCatalog();

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

  it('si carica su richiesta una sola volta (stessa istanza)', async () => {
    expect(await loadExerciseCatalog()).toBe(EXERCISE_CATALOG);
  });

  it('ogni muscolo è un MuscleTarget valido', () => {
    const valid = new Set(Object.keys(MUSCLE_DISPLAY_NAMES));
    const invalid = EXERCISE_CATALOG.flatMap((e) => e.primaryMuscles.filter((m) => !valid.has(m)).map((m) => `${e.id}:${m}`));
    expect(invalid).toEqual([]);
  });

  it('ogni nota degli ex preset finisce su esattamente un esercizio', () => {
    for (const key of Object.keys(LEGACY_PRESET_NOTES)) {
      const matches = EXERCISE_CATALOG.filter((e) => normalizeName(e.nameEn) === key);
      expect(matches.map((e) => e.notesPlaceholder), key).toEqual([LEGACY_PRESET_NOTES[key]]);
    }
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

  it('ignora trattini e punteggiatura nei nomi inglesi', () => {
    const named = [
      exercise('Trazioni alla sbarra', 'Pull-Up'),
      exercise('Curl con bilanciere EZ', 'EZ-Bar Curl'),
      exercise('Rematore al T-bar', 'T-Bar Row'),
    ];
    expect(searchExercises(named, 'pull up').map((e) => e.nameEn)).toEqual(['Pull-Up']);
    expect(searchExercises(named, 'ez bar').map((e) => e.nameEn)).toEqual(['EZ-Bar Curl']);
    expect(searchExercises(named, 'pullup').map((e) => e.nameEn)).toEqual(['Pull-Up']);
    expect(searchExercises(named, 'tbar').map((e) => e.nameEn)).toEqual(['T-Bar Row']);
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

  it('sets oltre il massimo → 20', () => {
    expect(resolveExerciseForm({ sets: '25', reps: '', notes: '' }, {}).sets).toBe(20);
  });

  it('valori inseriti vengono rispettati (trim)', () => {
    expect(resolveExerciseForm({ sets: '5', reps: '10', notes: ' RPE 8 ' }, {})).toEqual({ sets: 5, reps: '10', notes: 'RPE 8' });
  });

  it('nota vuota → nota dell\'ex preset se presente', () => {
    expect(resolveExerciseForm({ sets: '', reps: '', notes: '' }, { notesPlaceholder: 'Fermo al petto' }).notes).toBe('Fermo al petto');
  });
});
