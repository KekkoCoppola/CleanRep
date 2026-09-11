import type { ExerciseMessages } from '../../core/exercise/types';

/**
 * Frasi del plank. `issues`: voce (imperativa, ≤ 8 parole, una correzione per
 * frase). `labels`/`advice`: testo del report video, dalla rubrica di valutazione.
 */
export const PLANK_MESSAGES: ExerciseMessages = {
  setup: ['Mettiti in posizione di plank', 'Scendi in plank quando sei pronto'],
  lowConfidence: ['Mettiti di lato alla camera'],
  issues: {
    hipSag: ['Alza il bacino', 'Bacino più alto, stringi gli addominali'],
    hipPike: ['Abbassa il bacino', 'Bacino giù, corpo in linea'],
    kneesBent: ['Distendi le gambe', 'Ginocchia tese'],
    elbowsUnderShoulders: ['Porta i gomiti sotto le spalle'],
    handsUnderShoulders: ['Porta le mani sotto le spalle'],
    headUp: ['Non guardare avanti, sguardo a terra'],
    headDrop: ['Collo in linea con la schiena'],
  },
  good: ['Ottima posizione, mantieni'],
  variantNames: { FOREARM: 'avambracci', HIGH: 'braccia tese' },
  labels: {
    hipSag: 'Bacino che cede (iperlordosi lombare)',
    hipPike: 'Bacino troppo alto (piking)',
    kneesBent: 'Ginocchia piegate',
    elbowsUnderShoulders: 'Gomiti non allineati sotto le spalle',
    handsUnderShoulders: 'Mani non allineate sotto le spalle',
    headUp: 'Collo in iperestensione (sguardo in avanti)',
    headDrop: 'Testa che cade verso il pavimento',
    feetSliding: 'Piedi che scivolano indietro',
    instability: 'Oscillazioni del corpo',
  },
  advice: {
    hipSag:
      'contrai addominali e glutei portando il bacino in leggera retroversione: deve restare sulla linea spalle–caviglie. Il cedimento scarica il peso sulle vertebre lombari (L4-S1).',
    hipPike:
      'abbassa il bacino fino alla linea spalle–caviglie: sollevarlo accorcia la leva e sposta il lavoro dagli addominali ai flessori dell’anca.',
    kneesBent: 'tieni le ginocchia completamente distese contraendo i quadricipiti.',
    elbowsUnderShoulders:
      'porta i gomiti esattamente sotto le spalle, con braccio e avambraccio a 90°: gomiti avanzati trasformano il plank in una leva lunga non voluta.',
    handsUnderShoulders: 'porta le mani esattamente sotto le spalle, braccia tese e verticali.',
    headUp:
      'non fissare l’orizzonte o il cronometro: sguardo al pavimento tra le mani, collo lungo e mento leggermente retratto.',
    headDrop: 'non lasciar cadere la testa: mantienila in linea con la schiena, sguardo al pavimento tra le mani.',
    feetSliding:
      'appoggiati sulle punte (teste metatarsali) con le caviglie a circa 90°, su una superficie che non scivoli.',
    instability: 'riduci la durata della tenuta: le oscillazioni sono un segnale di fatica e di cedimento imminente.',
  },
  parts: {
    hipSag: 'bacino',
    hipPike: 'bacino',
    kneesBent: 'ginocchia',
    elbowsUnderShoulders: 'gomiti',
    handsUnderShoulders: 'mani',
    headUp: 'testa e collo',
    headDrop: 'testa e collo',
  },
};
