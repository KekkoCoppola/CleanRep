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

export interface PresetExercise {
  id: string;
  name: string;
  primaryMuscles: MuscleTarget[];
  defaultSets: number;
  defaultReps: string;
  defaultNotes?: string;
  illustrationUrl?: string;
}

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

/**
 * Catalogo preset esercizi basato sui mockup e sui principali movimenti di forza
 */
export const PRESET_EXERCISES: PresetExercise[] = [
  {
    id: 'barbell-bench-press',
    name: 'Barbell Bench Press',
    primaryMuscles: ['chest', 'front-delts', 'triceps'],
    defaultSets: 5,
    defaultReps: '8-10',
    defaultNotes: 'Piedi saldi, arco fisiologico, fermo al petto 1s',
  },
  {
    id: 'barbell-military-press',
    name: 'Barbell Military Press',
    primaryMuscles: ['front-delts', 'triceps'],
    defaultSets: 3,
    defaultReps: '6-8',
    defaultNotes: 'Glutei e addome contratti, traiettoria verticale',
  },
  {
    id: 'dumbbell-incline-press',
    name: 'Dumbbell Incline Press',
    primaryMuscles: ['chest', 'front-delts'],
    defaultSets: 3,
    defaultReps: '8-12',
    defaultNotes: 'Inclinazione panca 30°, focus porzione clavicolare',
    illustrationUrl: 'assets/incline_press_illustration_raw.png',
  },
  {
    id: 'dumbbell-lateral-raise',
    name: 'Dumbbell Lateral Raise',
    primaryMuscles: ['side-delts'],
    defaultSets: 4,
    defaultReps: '12-15',
    defaultNotes: 'Gomiti leggermente flessi, nessun slancio col busto',
  },
  {
    id: 'incline-dumbbell-fly',
    name: 'Incline Dumbbell Fly',
    primaryMuscles: ['chest'],
    defaultSets: 3,
    defaultReps: '10-12',
    defaultNotes: 'Apertura controllata, enfasi sullo stretch pettorale',
  },
  {
    id: 'cable-triceps-pushdown',
    name: 'Cable Triceps Pushdown',
    primaryMuscles: ['triceps'],
    defaultSets: 3,
    defaultReps: '12',
    defaultNotes: 'Gomiti serrati ai fianchi, contrazione di picco',
  },
  {
    id: 'barbell-squat',
    name: 'Barbell Squat',
    primaryMuscles: ['legs'],
    defaultSets: 4,
    defaultReps: '6-8',
    defaultNotes: 'Accosciata sotto al parallelo, petto aperto',
  },
  {
    id: 'lat-pulldown',
    name: 'Lat Pulldown',
    primaryMuscles: ['lats', 'biceps'],
    defaultSets: 4,
    defaultReps: '8-10',
    defaultNotes: 'Tirata al petto, deprimere le scapole',
  },
];

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
