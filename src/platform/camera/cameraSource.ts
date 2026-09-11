export type CameraFacing = 'user' | 'environment';

export interface OpenCamera {
  stream: MediaStream;
  /** Camera frontale: l'immagine va mostrata specchiata (come uno specchio). */
  mirrored: boolean;
  facing: CameraFacing;
}

/**
 * Apre la camera richiesta. Nessun vincolo di proporzioni: il telefono in
 * verticale dà frame verticali e l'overlay li gestisce (viewport "contain").
 * La risoluzione è l'input dell'inferenza (il modello lavora a 256px): 640px bastano.
 */
export async function openCamera(facing: CameraFacing): Promise<OpenCamera> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: facing }, width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  const track = stream.getVideoTracks()[0];
  const actual = (track?.getSettings().facingMode as CameraFacing | undefined) ?? facing;
  return { stream, mirrored: actual === 'user', facing: actual };
}

export function stopStream(stream: MediaStream | undefined): void {
  stream?.getTracks().forEach((t) => t.stop());
}

export function cameraErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError') return 'Permesso fotocamera negato: consentilo per allenarti.';
    if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') return 'Nessuna fotocamera disponibile.';
    if (err.name === 'NotReadableError') return 'La fotocamera è usata da un’altra app.';
  }
  return `Errore di inizializzazione: ${err instanceof Error ? err.message : String(err)}`;
}
