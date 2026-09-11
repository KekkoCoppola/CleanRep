import type { QualityIssue } from '../tracking/types';

/**
 * Frasi comuni a tutti gli esercizi (italiano, ≤ 8 parole, pronunciabili dal TTS).
 * Più varianti per chiave: il coach le alterna per non sembrare un disco rotto.
 */
export const COMMON_MESSAGES = {
  quality: {
    NO_PERSON: ['Non ti vedo, inquadra tutto il corpo'],
    CLIPPED: ['Fai entrare tutto il corpo nell’inquadratura'],
    LOW_CONFIDENCE: ['Non ti vedo bene, cambia posizione'],
    TOO_FAR: ['Avvicinati un po’ alla camera'],
    LOW_LIGHT: ['Troppo buio, aumenta la luce'],
    PHONE_FLAT: ['Metti il telefono in verticale'],
  } satisfies Record<QualityIssue, string[]>,
  holdStart: ['Posizione presa, tieni', 'Via, mantieni la posizione'],
  paused: ['Pausa, rimettiti in posizione'],
  praise: ['Bene, così', 'Ottimo, continua così'],
  milestone: (seconds: number) => `${seconds} secondi, continua così`,
} as const;
