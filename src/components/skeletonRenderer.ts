import type { JointName, LandmarkPoint } from '../types/contracts';
import { SKELETON_CONNECTIONS } from '../pose/landmarks';

const GREEN = '#22c55e';
const RED = '#ef4444';
// Allineata alla soglia del rule engine: il lato semi-occluso ma valutabile va disegnato.
const MIN_VISIBILITY = 0.3;

/**
 * Disegna lo scheletro AR sul canvas (coordinate normalizzate → pixel).
 * Un segmento è rosso se tocca almeno un joint segnalato in redJoints.
 */
export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: Partial<Record<JointName, LandmarkPoint>>,
  redJoints: ReadonlySet<JointName>,
  width: number,
  height: number,
): void {
  ctx.lineWidth = Math.max(3, width / 160);
  ctx.lineCap = 'round';

  for (const [a, b] of SKELETON_CONNECTIONS) {
    const pa = landmarks[a];
    const pb = landmarks[b];
    if (!pa || !pb || pa.visibility < MIN_VISIBILITY || pb.visibility < MIN_VISIBILITY) continue;
    ctx.strokeStyle = redJoints.has(a) || redJoints.has(b) ? RED : GREEN;
    ctx.beginPath();
    ctx.moveTo(pa.x * width, pa.y * height);
    ctx.lineTo(pb.x * width, pb.y * height);
    ctx.stroke();
  }

  const radius = Math.max(4, width / 130);
  for (const [name, lm] of Object.entries(landmarks) as Array<[JointName, LandmarkPoint]>) {
    if (lm.visibility < MIN_VISIBILITY) continue;
    ctx.fillStyle = redJoints.has(name) ? RED : GREEN;
    ctx.beginPath();
    ctx.arc(lm.x * width, lm.y * height, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
