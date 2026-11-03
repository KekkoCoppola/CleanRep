import { describe, expect, it } from 'vitest';
import {
  buildCatalog,
  dedupeByName,
  mapMuscles,
  normalizeName,
  toDisplayCase,
  type RawExercise,
} from '../scripts/exercise-catalog/transform.ts';

const raw = (exerciseId: string, name: string, targetMuscles: string[] = ['pectorals']): RawExercise => ({
  exerciseId,
  name,
  gifUrl: `https://static.exercisedb.dev/media/${exerciseId}.gif`,
  targetMuscles,
  equipments: ['dumbbell'],
});

describe('normalizeName', () => {
  it('minuscole, punteggiatura e spazi ridotti a un solo spazio', () => {
    expect(normalizeName('Dumbbell Incline Bench-Press (V. 2)')).toBe('dumbbell incline bench press v 2');
  });
});

describe('mapMuscles', () => {
  it('deltoide posteriore → traps anche se il nome contiene "lateral"', () => {
    expect(mapMuscles(['deltoids'], 'dumbbell lying rear lateral raise')).toEqual(['traps']);
    expect(mapMuscles(['deltoids'], 'cable face pull')).toEqual(['traps']);
  });

  it('deltoide laterale da "lateral" / "upright row"', () => {
    expect(mapMuscles(['deltoids'], 'dumbbell lateral raise')).toEqual(['side-delts']);
    expect(mapMuscles(['deltoids'], 'barbell upright row')).toEqual(['side-delts']);
  });

  it('altri deltoidi → front-delts', () => {
    expect(mapMuscles(['deltoids'], 'dumbbell shoulder press')).toEqual(['front-delts']);
  });

  it('raggruppa i muscoli ExerciseDB senza duplicati', () => {
    expect(mapMuscles(['pectorals', 'serratus anterior'], 'x')).toEqual(['chest']);
    expect(mapMuscles(['forearms'], 'x')).toEqual(['biceps']);
    expect(mapMuscles(['erector spinae'], 'x')).toEqual(['abs']);
    expect(mapMuscles(['upper back', 'levator scapulae'], 'x')).toEqual(['traps']);
    expect(mapMuscles(['glutes', 'calves', 'adductors'], 'x')).toEqual(['legs']);
  });

  it('cardio → nessun muscolo', () => {
    expect(mapMuscles(['cardiovascular system'], 'x')).toEqual([]);
  });
});

describe('toDisplayCase', () => {
  it('nomi tutti minuscoli → iniziali maiuscole (anche dopo "(" e "-")', () => {
    expect(toDisplayCase('cable pushdown (with rope attachment)')).toBe('Cable Pushdown (With Rope Attachment)');
    expect(toDisplayCase('one-arm row')).toBe('One-Arm Row');
  });

  it('nomi già con maiuscole restano invariati', () => {
    expect(toDisplayCase('EZ-Bar Curl')).toBe('EZ-Bar Curl');
  });
});

describe('dedupeByName', () => {
  it('tiene la prima occorrenza tra nomi uguali a meno di maiuscole', () => {
    const out = dedupeByName([
      raw('B3Rxp6L', 'Dumbbell Incline Bench Press'),
      raw('ns0SIbU', 'dumbbell incline bench press'),
      raw('DsgkuIt', 'dumbbell lateral raise', ['deltoids']),
    ]);
    expect(out.map((e) => e.exerciseId)).toEqual(['B3Rxp6L', 'DsgkuIt']);
  });
});

describe('buildCatalog', () => {
  const source = [
    raw('DsgkuIt', 'dumbbell lateral raise', ['deltoids']),
    raw('B3Rxp6L', 'Dumbbell Incline Bench Press'),
    raw('ns0SIbU', 'dumbbell incline bench press'),
    raw('CARDIO1', 'jog in place', ['cardiovascular system']),
  ];
  const namesIt = { DsgkuIt: 'Alzate laterali con manubri', B3Rxp6L: 'Panca inclinata con manubri' };
  const notes = { 'dumbbell incline bench press': 'Inclinazione panca 30°' };
  const catalog = buildCatalog(source, namesIt, notes);

  it('deduplica e ordina per nome italiano', () => {
    expect(catalog.map((e) => e.id)).toEqual(['DsgkuIt', 'CARDIO1', 'B3Rxp6L']);
  });

  it('usa il nome italiano se presente, altrimenti il nome inglese in display case', () => {
    expect(catalog.find((e) => e.id === 'CARDIO1')).toMatchObject({ name: 'Jog In Place', nameEn: 'Jog In Place' });
    expect(catalog.find((e) => e.id === 'DsgkuIt')).toMatchObject({
      name: 'Alzate laterali con manubri',
      nameEn: 'Dumbbell Lateral Raise',
      primaryMuscles: ['side-delts'],
      equipment: ['dumbbell'],
      gifUrl: 'https://static.exercisedb.dev/media/DsgkuIt.gif',
    });
  });

  it('nota dell\'ex preset come notesPlaceholder, campo assente altrimenti', () => {
    expect(catalog.find((e) => e.id === 'B3Rxp6L')?.notesPlaceholder).toBe('Inclinazione panca 30°');
    expect(catalog.find((e) => e.id === 'DsgkuIt')).not.toHaveProperty('notesPlaceholder');
  });

  it('esercizio cardio senza muscoli', () => {
    expect(catalog.find((e) => e.id === 'CARDIO1')?.primaryMuscles).toEqual([]);
  });
});
