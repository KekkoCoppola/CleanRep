import type { JointName, Side } from '../../types/contracts';
import type { Vec2 } from '../geometry/vector';

/** Landmark grezzo MediaPipe (x,y normalizzati sul frame, y verso il basso; z relativa alle anche, negativa = più vicino). */
export interface RawLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

/** Una posa grezza come esce dal modello: 33 landmark + (opzionali) coordinate mondo in metri. */
export interface RawPose {
  landmarks: RawLandmark[];
  worldLandmarks?: RawLandmark[];
}

/**
 * Unico input del core: un frame analizzato. Prodotto dalla camera live, da un
 * file video o da una registrazione (replay) — il core non sa quale.
 */
export interface RawPoseFrame {
  /** Millisecondi monotoni (performance.now o tempo di registrazione). */
  timestamp: number;
  /** Dimensioni in pixel del frame analizzato. */
  width: number;
  height: number;
  /** Tutte le pose rilevate (il subject lock sceglie quella giusta). */
  poses: RawPose[];
  /** Luminosità media del frame 0–1, se misurata. */
  brightness?: number;
  /** Direzione della gravità nel piano immagine (vettore unitario), se nota dal sensore. */
  down?: Vec2 | null;
  /** Telefono appoggiato quasi orizzontale: la gravità nel piano immagine non è affidabile. */
  phoneFlat?: boolean;
}

/** tracked = misurato ora; held = ultimo valore buono tenuto per poco; lost = non affidabile. */
export type JointState = 'tracked' | 'held' | 'lost';

export interface StableJoint {
  /** Coordinate normalizzate (come MediaPipe), già filtrate. */
  x: number;
  y: number;
  z: number;
  /** 0–1: visibilità del modello ridotta se il giunto è tenuto o sospetto. */
  confidence: number;
  state: JointState;
}

/** Riquadro in coordinate normalizzate. */
export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type QualityIssue =
  | 'NO_PERSON'
  | 'LOW_CONFIDENCE'
  | 'CLIPPED'
  | 'TOO_FAR'
  | 'LOW_LIGHT'
  | 'PHONE_FLAT';

export interface PoseQuality {
  /** 0–1. */
  score: number;
  issues: QualityIssue[];
  /** true se la posa NON è abbastanza affidabile per giudicare la tecnica. */
  blocking: boolean;
}

/** Output dello stabilizer: la posa del soggetto agganciato, filtrata e validata. */
export interface StablePose {
  timestamp: number;
  /** Larghezza/altezza del frame: serve per passare allo spazio isotropo. */
  aspect: number;
  /** Id del soggetto seguito; null se nessuno. */
  subjectId: number | null;
  /** true dopo che il soggetto è stato visto stabilmente (aggancio confermato). */
  locked: boolean;
  joints: Partial<Record<JointName, StableJoint>>;
  /** Lato del corpo rivolto verso la camera (ripresa laterale). */
  nearSide: Side | null;
  bbox: BBox | null;
  /** Riquadri delle altre persone ignorate (debug). */
  otherBoxes: BBox[];
  quality: PoseQuality;
  /** Gravità usata per la geometria (default: giù nell'immagine). */
  down: Vec2;
  /** Correzioni applicate in questo frame (debug/metriche). */
  corrections: { swaps: string[]; rejected: JointName[] };
}
