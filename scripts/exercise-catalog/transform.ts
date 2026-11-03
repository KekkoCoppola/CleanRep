/**
 * Logica pura che trasforma lo snapshot ExerciseDB nel catalogo dell'app.
 * Eseguita da Node con il type-stripping nativo: import con estensione .ts
 * e `import type` per i tipi.
 */
import type { CatalogExercise, MuscleTarget } from '../../src/ui/routine/RoutineTypes.ts';

/** Campi dello snapshot ExerciseDB V1 usati dal catalogo. */
export interface RawExercise {
  exerciseId: string;
  name: string;
  gifUrl: string;
  targetMuscles: string[];
  equipments: string[];
}

/** targetMuscles ExerciseDB → gruppo MuscleTarget (null = nessun gruppo, es. cardio). */
const MUSCLE_GROUPS: Record<string, MuscleTarget | null> = {
  pectorals: 'chest',
  'serratus anterior': 'chest',
  triceps: 'triceps',
  biceps: 'biceps',
  forearms: 'biceps',
  'latissimus dorsi': 'lats',
  'upper back': 'traps',
  trapezius: 'traps',
  'levator scapulae': 'traps',
  abdominals: 'abs',
  'erector spinae': 'abs',
  glutes: 'legs',
  quadriceps: 'legs',
  hamstrings: 'legs',
  calves: 'legs',
  abductors: 'legs',
  adductors: 'legs',
  'cardiovascular system': null,
};

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** ExerciseDB non distingue i deltoidi: si deduce la porzione dal nome (posteriore prima di laterale). */
function deltoidTarget(nameEn: string): MuscleTarget {
  const name = nameEn.toLowerCase();
  if (/\brear\b|reverse fl(y|ies)|face pull/.test(name)) return 'traps';
  if (/lateral|\bside\b|upright row/.test(name)) return 'side-delts';
  return 'front-delts';
}

export function mapMuscles(targetMuscles: string[], nameEn: string): MuscleTarget[] {
  const out: MuscleTarget[] = [];
  for (const muscle of targetMuscles) {
    const group = muscle === 'deltoids' ? deltoidTarget(nameEn) : MUSCLE_GROUPS[muscle];
    if (group && !out.includes(group)) out.push(group);
  }
  return out;
}

/** ExerciseDB ha molti nomi tutti minuscoli: iniziali maiuscole solo in quel caso. */
export function toDisplayCase(name: string): string {
  if (name !== name.toLowerCase()) return name;
  return name.replace(/(^|[\s(-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function dedupeByName(raw: RawExercise[]): RawExercise[] {
  const seen = new Set<string>();
  return raw.filter((exercise) => {
    const key = normalizeName(exercise.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildCatalog(
  raw: RawExercise[],
  namesIt: Record<string, string>,
  legacyNotes: Record<string, string>,
): CatalogExercise[] {
  return dedupeByName(raw)
    .map((exercise) => {
      const nameEn = toDisplayCase(exercise.name);
      const entry: CatalogExercise = {
        id: exercise.exerciseId,
        name: namesIt[exercise.exerciseId]?.trim() || nameEn,
        nameEn,
        gifUrl: exercise.gifUrl,
        primaryMuscles: mapMuscles(exercise.targetMuscles, exercise.name),
        equipment: exercise.equipments,
      };
      const note = legacyNotes[normalizeName(exercise.name)];
      if (note) entry.notesPlaceholder = note;
      return entry;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));
}
