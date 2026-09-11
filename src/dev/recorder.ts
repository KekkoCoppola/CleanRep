import type { RawLandmark, RawPoseFrame } from '../core/tracking/types';

/** Formato dei file di registrazione (input del replay e dei test di regressione). */
export interface RecordedSession {
  version: 1;
  exercise: string;
  /** ISO 8601 UTC, es. "2026-09-11T10:00:00.000Z". */
  recordedAt: string;
  userAgent: string;
  frames: RawPoseFrame[];
}

const round = (v: number) => Math.round(v * 1e4) / 1e4;
const roundLandmarks = (list: RawLandmark[] | undefined) =>
  list?.map((l) => ({ x: round(l.x), y: round(l.y), z: round(l.z), visibility: round(l.visibility) }));

/**
 * Registra i frame GREZZI (prima di ogni filtro) di una sessione reale:
 * rigiocandoli con `?debug` → "Registrazione" si ottiene esattamente la stessa
 * pipeline, così ogni problema visto dal vivo diventa riproducibile e testabile.
 */
export class SessionRecorder {
  private frames: RawPoseFrame[] = [];

  constructor(private readonly exercise: string) {}

  push(frame: RawPoseFrame): void {
    this.frames.push({
      ...frame,
      timestamp: Math.round(frame.timestamp),
      poses: frame.poses.map((p) => ({
        landmarks: roundLandmarks(p.landmarks)!,
        worldLandmarks: roundLandmarks(p.worldLandmarks),
      })),
    });
  }

  get size(): number {
    return this.frames.length;
  }

  toJSON(): RecordedSession {
    return {
      version: 1,
      exercise: this.exercise,
      recordedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      frames: this.frames,
    };
  }

  /** Scarica la registrazione come file JSON (strumento di sviluppo, browser desktop). */
  download(): void {
    const blob = new Blob([JSON.stringify(this.toJSON())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cleanrep-${this.exercise.toLowerCase()}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function loadRecordedSession(file: File): Promise<RawPoseFrame[]> {
  const data = JSON.parse(await file.text()) as Partial<RecordedSession>;
  if (data.version !== 1 || !Array.isArray(data.frames)) throw new Error('File di registrazione non valido');
  return data.frames;
}
