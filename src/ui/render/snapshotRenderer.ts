import type { JointName, Side } from '../../types/contracts';
import type { SnapshotRequest } from '../../core/analysis/holdReport';
import type { PipelineOutput } from '../../core/pipeline';
import type { RawPoseFrame, StablePose } from '../../core/tracking/types';
import { drawFrameImage, drawSkeleton } from './skeletonRenderer';
import { containViewport, project, type Viewport } from './viewport';

const MAX_SIDE = 960;

function nearJoint(pose: StablePose, part: string) {
  const sides: Side[] = pose.nearSide === 'RIGHT' ? ['RIGHT', 'LEFT'] : ['LEFT', 'RIGHT'];
  for (const side of sides) {
    const j = pose.joints[`${side}_${part}` as JointName];
    if (j && j.state !== 'lost') return j;
  }
  return undefined;
}

/** Asse ideale (spalla → caviglia, prolungato): rispetto a questa linea si misurano bacino e testa. */
function drawAxis(ctx: CanvasRenderingContext2D, vp: Viewport, pose: StablePose, unit: number): void {
  const s = nearJoint(pose, 'SHOULDER');
  const a = nearJoint(pose, 'ANKLE');
  if (!s || !a) return;
  const ps = project(vp, s.x, s.y);
  const pa = project(vp, a.x, a.y);
  const dx = pa.x - ps.x;
  const dy = pa.y - ps.y;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = Math.max(1.5, unit * 0.6);
  ctx.setLineDash([unit * 2.5, unit * 2]);
  ctx.beginPath();
  ctx.moveTo(ps.x - dx * 0.18, ps.y - dy * 0.18);
  ctx.lineTo(pa.x + dx * 0.08, pa.y + dy * 0.08);
  ctx.stroke();
  ctx.restore();
}

/** Disegna scheletro + frame per l'anteprima dell'analisi. */
export function drawAnalysisPreview(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  frame: RawPoseFrame,
  out: PipelineOutput,
): void {
  const canvas = ctx.canvas;
  const vp = containViewport(frame.width, frame.height, canvas.width, canvas.height, false);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawFrameImage(ctx, image, vp);
  drawSkeleton(ctx, vp, out.pose, out.state);
}

/**
 * Screenshot del report: frame del video + scheletro classico dell'app, con in
 * rosso SOLO i punti del difetto documentato, l'asse ideale tratteggiato e una
 * didascalia (difetto · istante · misura). Ritorna un data URL JPEG.
 */
export function renderSnapshot(
  image: CanvasImageSource,
  frame: RawPoseFrame,
  out: PipelineOutput,
  req: SnapshotRequest,
): string {
  const scale = Math.min(1, MAX_SIDE / Math.max(frame.width, frame.height));
  const w = Math.round(frame.width * scale);
  const h = Math.round(frame.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const vp = containViewport(frame.width, frame.height, w, h, false);
  drawFrameImage(ctx, image, vp);

  const unit = Math.max(2, Math.min(w, h) / 110);
  drawAxis(ctx, vp, out.pose, unit);
  const state = {
    ...out.state,
    phase: 'HOLDING' as const,
    result: { ...out.state.result, jointsToColorRed: req.joints },
  };
  drawSkeleton(ctx, vp, out.pose, state);

  // Cerchio attorno ai punti da correggere.
  ctx.save();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = unit * 0.8;
  for (const name of req.joints) {
    const j = out.pose.joints[name];
    if (!j || j.state === 'lost') continue;
    const p = project(vp, j.x, j.y);
    ctx.beginPath();
    ctx.arc(p.x, p.y, unit * 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Didascalia.
  const font = Math.max(13, Math.round(Math.min(w, h) / 26));
  const band = Math.round(font * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
  ctx.fillRect(0, h - band, w, band);
  ctx.fillStyle = req.issueId ? '#ef4444' : '#22c55e';
  ctx.beginPath();
  ctx.arc(font, h - band / 2, font * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${font}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(req.caption, font * 1.8, h - band / 2, w - font * 2.4);

  return canvas.toDataURL('image/jpeg', 0.85);
}
