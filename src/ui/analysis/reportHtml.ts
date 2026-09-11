import { formatDuration, type HoldReport } from '../../core/analysis/holdReport';

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * Report autonomo (un solo file HTML con gli screenshot incorporati): si apre
 * in qualunque browser e si può inviare via chat o email senza allegati separati.
 */
export function buildReportHtml(report: HoldReport, images: Record<string, string>, fileName: string): string {
  const date = new Date().toLocaleString('it-IT');
  const summary = report.summary
    .split('\n')
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('\n');
  const shots = report.snapshots
    .filter((s) => images[s.key])
    .map(
      (s) =>
        `<figure><img src="${images[s.key]}" alt="${escapeHtml(s.caption)}"><figcaption>${escapeHtml(s.caption)}</figcaption></figure>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>CleanRep · Report ${escapeHtml(report.exercise)}</title>
<style>
body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#0b1220;color:#e2e8f0;margin:0;padding:20px;line-height:1.5}
main{max-width:860px;margin:0 auto}
h1{font-size:1.4rem;margin:0 0 4px}.meta{color:#94a3b8;font-size:.85rem;margin-bottom:16px}
.stats{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0}.stat{background:#111a2e;border-radius:10px;padding:10px 14px}
.stat b{display:block;font-size:1.2rem}.stat span{color:#94a3b8;font-size:.8rem}
p{margin:6px 0}figure{margin:16px 0;background:#111a2e;border-radius:10px;overflow:hidden}
img{width:100%;display:block}figcaption{padding:8px 12px;color:#94a3b8;font-size:.85rem}
</style></head><body><main>
<h1>CleanRep · ${escapeHtml(report.exercise)}${report.variantName ? ` (${escapeHtml(report.variantName)})` : ''}</h1>
<div class="meta">${escapeHtml(fileName)} · analizzato il ${escapeHtml(date)}</div>
<div class="stats">
<div class="stat"><b>${formatDuration(report.protocol.validHoldMs)}</b><span>tempo valido</span></div>
<div class="stat"><b>${formatDuration(report.inPositionMs)}</b><span>in posizione</span></div>
<div class="stat"><b>${report.issues.length}</b><span>aspetti da migliorare</span></div>
</div>
${summary}
${shots}
</main></body></html>`;
}
