import { useState } from 'react';
import { formatDuration } from '../../core/analysis/holdReport';
import { copyText, shareFile } from '../../platform/share/shareReport';
import type { VideoAnalysisResult } from '../analysis/analyzeVideo';
import { buildReportHtml } from '../analysis/reportHtml';

interface Props {
  result: VideoAnalysisResult;
  onNew: () => void;
}

/** Esito dell'analisi video: testo breve su cosa migliorare + screenshot con lo scheletro. */
export default function ReportView({ result, onNew }: Props) {
  const { report, images, fileName } = result;
  const [status, setStatus] = useState('');
  const [zoom, setZoom] = useState<string | null>(null);
  const rating = report.ratings.length === 1 ? report.ratings[0] : null;
  const shots = report.snapshots.filter((s) => images[s.key]);

  const share = async () => {
    setStatus('');
    try {
      const outcome = await shareFile({
        fileName: `cleanrep-report-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.html`,
        content: buildReportHtml(report, images, fileName),
        mimeType: 'text/html',
        title: `CleanRep · report ${report.exercise}`,
        text: report.summary.split('\n').slice(0, 2).join(' '),
      });
      if (outcome === 'downloaded') setStatus('Report scaricato (file HTML con testo e immagini).');
    } catch (err) {
      setStatus(`Condivisione non riuscita: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const copy = async () => setStatus((await copyText(report.summary)) ? 'Testo copiato.' : 'Impossibile copiare il testo.');

  return (
    <section className="report">
      <div className="report-head">
        <h2>
          Report · {report.exercise}
          {report.variantName ? ` (${report.variantName})` : ''}
        </h2>
        <span className="hint">{fileName}</span>
      </div>

      <div className="stats">
        <div className="stat">
          <b>{formatDuration(report.protocol.validHoldMs)}</b>
          <span>tempo valido</span>
        </div>
        <div className="stat">
          <b>{formatDuration(report.inPositionMs)}</b>
          <span>in posizione</span>
        </div>
        {rating && (
          <div className="stat">
            <b>
              {rating.atLeast ? '≥ ' : ''}
              {rating.band.label}
            </b>
            <span>livello</span>
          </div>
        )}
        <div className={`stat ${report.issues.length ? 'ko' : 'ok'}`}>
          <b>{report.issues.length}</b>
          <span>da migliorare</span>
        </div>
      </div>

      <div className="report-text">
        {report.summary.split('\n').map((line, i) => (
          <p key={i} className={/^\d+\./.test(line) ? 'report-item' : line === 'Da migliorare:' ? 'report-title' : ''}>
            {line}
          </p>
        ))}
      </div>

      {shots.length > 0 && (
        <div className="gallery">
          {shots.map((s) => (
            <figure key={s.key} onClick={() => setZoom(images[s.key])}>
              <img src={images[s.key]} alt={s.caption} />
              <figcaption>{s.caption}</figcaption>
            </figure>
          ))}
        </div>
      )}

      <div className="controls">
        <button className="cta" onClick={share}>
          Condividi report
        </button>
        <button className="secondary" onClick={copy}>
          Copia testo
        </button>
        <button className="secondary" onClick={onNew}>
          Analizza un altro video
        </button>
      </div>
      {status && <p className="hint">{status}</p>}

      {zoom && (
        <div className="zoom" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" />
        </div>
      )}
    </section>
  );
}
