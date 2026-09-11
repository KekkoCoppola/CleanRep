import type { PipelineOutput } from '../../core/pipeline';
import type { BBox } from '../../core/tracking/types';
import type { SourceMetrics } from '../../platform/frameSource';
import { project, type Viewport } from './viewport';

function drawBox(ctx: CanvasRenderingContext2D, vp: Viewport, b: BBox, color: string, dash: number[]): void {
  const p1 = project(vp, b.minX, b.minY);
  const p2 = project(vp, b.maxX, b.maxY);
  ctx.strokeStyle = color;
  ctx.setLineDash(dash);
  ctx.lineWidth = 2;
  ctx.strokeRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y), Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
}

/** Overlay diagnostico (`?debug`): tutto ciò che serve per capire perché l'app ha deciso qualcosa. */
export function drawDebug(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  out: PipelineOutput,
  metrics: SourceMetrics,
  lastUtterance: string | null,
): void {
  const { pose, state } = out;
  ctx.save();
  if (pose.bbox) drawBox(ctx, vp, pose.bbox, '#38bdf8', []);
  for (const b of pose.otherBoxes) drawBox(ctx, vp, b, '#94a3b8', [6, 6]);
  ctx.setLineDash([]);

  const lines = [
    `fase ${state.phase}${state.variant ? ` · ${state.variant}` : ''}${state.inPosition ? ' · in posizione' : ''}`,
    `soggetto #${pose.subjectId ?? '-'} ${pose.locked ? 'agganciato' : 'in aggancio'} · lato ${pose.nearSide ?? '-'} · altri ${pose.otherBoxes.length}`,
    `qualità ${(pose.quality.score * 100).toFixed(0)}%${pose.quality.blocking ? ' BLOCCANTE' : ''} ${pose.quality.issues.join(' ')}`,
    `regole ${state.issues.map((i) => i.id).join(' ') || 'ok'}${state.skippedRules.length ? ` · saltate ${state.skippedRules.join(' ')}` : ''}`,
    `correzioni swap[${pose.corrections.swaps.join(' ')}] rifiutati[${pose.corrections.rejected.join(' ')}]`,
    `tempo ${(state.holdMs / 1000).toFixed(1)}s · corretto ${(state.correctMs / 1000).toFixed(1)}s · conf ${(state.result.confidence * 100).toFixed(0)}%`,
    `${metrics.fps.toFixed(0)} fps · inferenza ${metrics.inferenceMs.toFixed(1)} ms · ${metrics.delegate}`,
    `voce: ${lastUtterance ?? '-'}`,
  ];
  const size = Math.max(11, Math.round(Math.min(ctx.canvas.width, ctx.canvas.height) / 42));
  ctx.font = `${size}px ui-monospace, monospace`;
  const lineH = size * 1.35;
  const width = Math.max(...lines.map((l) => ctx.measureText(l).width)) + size;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(8, 8, width, lines.length * lineH + size * 0.6);
  ctx.fillStyle = '#e2e8f0';
  lines.forEach((l, i) => ctx.fillText(l, 8 + size / 2, 8 + size * 0.3 + (i + 1) * lineH - size * 0.3));
  ctx.restore();
}
