import type { JointName } from '../../types/contracts';
import { dist, toIso, type Vec2 } from '../geometry/vector';
import type { JointMap } from './candidate';

/**
 * Catene di giunti che MediaPipe può etichettare invertite (sinistra↔destra),
 * tipico della ripresa laterale sugli arti inferiori: le due gambe si
 * sovrappongono e il modello "salta" da un'etichetta all'altra.
 */
const CHAINS: Record<string, string[]> = {
  arms: ['ELBOW', 'WRIST'],
  legs: ['KNEE', 'ANKLE', 'HEEL', 'FOOT_INDEX'],
  torso: ['SHOULDER', 'HIP', 'EAR'],
};

const MIN_VISIBILITY = 0.3;
/** Lo scambio deve ridurre il costo almeno di questo fattore… */
const SWAP_RATIO = 0.6;
/** …e di almeno questa frazione di torso per coppia (niente scambi su differenze di rumore). */
const MIN_GAIN_TORSO = 0.1;

function swapKeys(map: JointMap, a: JointName, b: JointName): void {
  const tmp = map[a];
  if (map[b]) map[a] = map[b];
  else delete map[a];
  if (tmp) map[b] = tmp;
  else delete map[b];
}

/**
 * Confronta, catena per catena, il costo di mantenere le etichette con quello
 * di scambiarle rispetto alle posizioni precedenti (già stabilizzate). Se lo
 * scambio spiega molto meglio il movimento, lo applica (in place, anche sui
 * landmark mondo). Ritorna le catene scambiate.
 */
export function correctSideSwaps(
  joints: JointMap,
  world: JointMap | null,
  previous: Partial<Record<JointName, Vec2>>,
  aspect: number,
  torsoLength: number,
): string[] {
  const swapped: string[] = [];
  const scale = Math.max(torsoLength, 0.05);
  for (const [chain, parts] of Object.entries(CHAINS)) {
    let keep = 0;
    let swap = 0;
    let pairs = 0;
    for (const part of parts) {
      const l = joints[`LEFT_${part}` as JointName];
      const r = joints[`RIGHT_${part}` as JointName];
      const pl = previous[`LEFT_${part}` as JointName];
      const pr = previous[`RIGHT_${part}` as JointName];
      if (!l || !r || !pl || !pr) continue;
      if (l.visibility < MIN_VISIBILITY || r.visibility < MIN_VISIBILITY) continue;
      const li = toIso(l, aspect);
      const ri = toIso(r, aspect);
      keep += dist(li, pl) + dist(ri, pr);
      swap += dist(li, pr) + dist(ri, pl);
      pairs += 1;
    }
    if (pairs === 0) continue;
    if (swap < keep * SWAP_RATIO && (keep - swap) / pairs > MIN_GAIN_TORSO * scale) {
      for (const part of parts) {
        const a = `LEFT_${part}` as JointName;
        const b = `RIGHT_${part}` as JointName;
        swapKeys(joints, a, b);
        if (world) swapKeys(world, a, b);
      }
      swapped.push(chain);
    }
  }
  return swapped;
}
