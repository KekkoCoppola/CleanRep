/**
 * Opzioni del detector, separate da detector.ts: così la schermata iniziale
 * non importa @mediapipe/tasks-vision (caricata solo al click "Inizia").
 */
export type PoseModel = 'lite' | 'full' | 'heavy';

export interface DetectorOptions {
  /**
   * "full" di default: "lite" perde spesso le pose orizzontali a terra (plank);
   * "heavy" è più preciso ma nel browser gira ~5fps su un telefono medio.
   */
  model: PoseModel;
  /** >1 per vedere anche le altre persone: il subject lock sceglie quella giusta. */
  numPoses: number;
}

export const DEFAULT_DETECTOR: DetectorOptions = { model: 'full', numPoses: 2 };
