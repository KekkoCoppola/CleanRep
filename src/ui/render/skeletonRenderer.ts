import type { JointName } from '../../types/contracts';
import type { HoldSessionState } from '../../core/exercise/holdSession';
import { SKELETON_CONNECTIONS } from '../../core/pose/landmarks';
import type { StableJoint, StablePose } from '../../core/tracking/types';
import { project, type Viewport } from './viewport';

const GREEN = '#22c55e';
const RED = '#ef4444';
/** Scheletro "neutro": persona vista ma non giudicata (fuori posizione o posa non affidabile). */
const NEUTRAL = '#e2e8f0';

/** Disegna il frame analizzato con la stessa trasformazione usata per lo scheletro. */
export function drawFrameImage(ctx: CanvasRenderingContext2D, image: CanvasImageSource, vp: Viewport): void {
  ctx.save();
  if (vp.mirrored) {
    ctx.translate(vp.offsetX + vp.width, vp.offsetY);
    ctx.scale(-1, 1);
    ctx.drawImage(image, 0, 0, vp.width, vp.height);
  } else {
    ctx.drawImage(image, vp.offsetX, vp.offsetY, vp.width, vp.height);
  }
  ctx.restore();
}

/**
 * Scheletro della persona agganciata, dai dati STABILIZZATI (ciò che si vede
 * è ciò che viene giudicato):
 * - giunti persi non disegnati, giunti "tenuti" tratteggiati;
 * - lato lontano dalla camera semitrasparente (spesso stimato, non visto);
 * - verde/rosso solo in posizione, altrimenti neutro.
 */
export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  pose: StablePose,
  state: HoldSessionState,
): void {
  if (pose.subjectId === null || vp.scale === 0) return;
  const judging = state.phase === 'HOLDING';
  const red = new Set<JointName>(judging ? state.result.jointsToColorRed : []);
  const unit = Math.max(2, Math.min(vp.width, vp.height) / 110);
  const isFar = (name: JointName) =>
    pose.nearSide !== null && name.includes('_') && !name.startsWith(pose.nearSide);
  const colorOf = (names: JointName[]) => (names.some((n) => red.has(n)) ? RED : judging ? GREEN : NEUTRAL);

  ctx.save();
  ctx.lineCap = 'round';
  for (const [a, b] of SKELETON_CONNECTIONS) {
    const ja = pose.joints[a];
    const jb = pose.joints[b];
    if (!ja || !jb || ja.state === 'lost' || jb.state === 'lost') continue;
    const far = isFar(a) || isFar(b);
    const pa = project(vp, ja.x, ja.y);
    const pb = project(vp, jb.x, jb.y);
    ctx.globalAlpha = far ? 0.35 : 0.95;
    ctx.setLineDash(ja.state === 'held' || jb.state === 'held' ? [unit * 1.5, unit * 1.5] : []);
    ctx.lineWidth = far ? unit * 0.8 : unit * 1.4;
    ctx.strokeStyle = colorOf([a, b]);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const [name, j] of Object.entries(pose.joints) as Array<[JointName, StableJoint]>) {
    if (j.state === 'lost') continue;
    const far = isFar(name);
    const p = project(vp, j.x, j.y);
    ctx.globalAlpha = far ? 0.35 : 1;
    ctx.fillStyle = colorOf([name]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, far ? unit * 1.1 : unit * 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
