export interface WorkoutCardData {
  id: string;
  number: number;
  progress: number;
  title: string;
  schedule: string;
}

export interface MetricCardData {
  value: string | number;
  unit: string;
  label: string;
  subtitle: string;
}

export interface MonthHeatmapData {
  month: string;
  // Griglia di punti: array di boolean (true = giorno attivo/bianco, false = inattivo)
  // 5 righe x 7 colonne = 35 punti
  activeIndices: number[];
}

export interface VolumeData {
  value: string;
  unit: string;
  label: string;
  subtitle: string;
}

export interface WorkoutsPageData {
  workout1: WorkoutCardData;
  bodyWeight: MetricCardData;
  heatmapMonths: MonthHeatmapData[];
  workout2: WorkoutCardData;
  volumeLifted: VolumeData;
}

export const MOCK_WORKOUTS_PAGE: WorkoutsPageData = {
  workout1: {
    id: 'chest-tricep',
    number: 1,
    progress: 0.72,
    title: 'Chest + tricep',
    schedule: 'Fridays',
  },
  bodyWeight: {
    value: '190',
    unit: 'lbs',
    label: 'Body weight',
    subtitle: '31 min ago',
  },
  heatmapMonths: [
    {
      month: 'Jan',
      // Punti attivi (corrispondenti al mockup: un punto a sinistra, uno centrale in basso, uno in alto a destra)
      activeIndices: [8, 18, 23],
    },
    {
      month: 'Feb',
      // Punti attivi del mese di Febbraio nel mockup
      activeIndices: [9, 17, 23],
    },
    {
      month: 'Mar',
      // Punti attivi del mese di Marzo nel mockup
      activeIndices: [8],
    },
  ],
  workout2: {
    id: 'back-bicep-legs',
    number: 2,
    progress: 0.46,
    title: 'Back + bicep + legs',
    schedule: 'Mondays',
  },
  volumeLifted: {
    value: '3.200',
    unit: 'lbs',
    label: 'Volume lifted',
    subtitle: 'Last 7 days',
  },
};
