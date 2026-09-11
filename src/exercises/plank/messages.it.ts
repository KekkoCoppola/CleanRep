import type { ExerciseMessages } from '../../core/exercise/types';

/** Frasi del plank: imperative, concrete, ≤ 8 parole, una correzione per frase. */
export const PLANK_MESSAGES: ExerciseMessages = {
  setup: ['Mettiti in posizione di plank', 'Scendi in plank quando sei pronto'],
  lowConfidence: ['Mettiti di lato alla camera'],
  issues: {
    hipSag: ['Alza il bacino', 'Bacino più alto, stringi gli addominali'],
    hipPike: ['Abbassa il bacino', 'Bacino giù, corpo in linea'],
    kneesBent: ['Distendi le gambe', 'Ginocchia tese'],
    elbowsUnderShoulders: ['Porta i gomiti sotto le spalle'],
    handsUnderShoulders: ['Porta le mani sotto le spalle'],
    headAlignment: ['Collo in linea, guarda a terra'],
  },
  good: ['Ottima posizione, mantieni'],
  variantNames: { FOREARM: 'avambracci', HIGH: 'braccia tese' },
};
