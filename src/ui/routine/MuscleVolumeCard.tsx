import type { MuscleTarget } from './RoutineTypes';
import { MuscleTorsoGraphic } from './AnatomyGraphic';

interface Props {
  muscle: MuscleTarget;
  displayName: string;
  sets: number;
  maxTarget?: number;
  trend?: 'Growing' | 'Optimal' | 'Maintenance';
}

/**
 * Card carosello impatto muscolare fedele a Creazione Routine.png:
 * Mostra la sagoma anatomica con il muscolo illuminato,
 * il nome del distretto (es. Front delts / Chest),
 * il badge con freccia "↑ Growing",
 * e la barra a 18 pallini con il delta dei sets (+6).
 */
export default function MuscleVolumeCard({
  muscle,
  displayName,
  sets,
  maxTarget = 18,
  trend = 'Growing',
}: Props) {
  const activeDots = Math.min(sets, maxTarget);
  const totalDots = maxTarget;

  return (
    <div className="muscle-volume-card" tabIndex={0} aria-label={`${displayName}: ${sets} sets, trend ${trend}`}>
      {/* Sagoma muscolare con distretto illuminato */}
      <div className="muscle-card-torso-container">
        <MuscleTorsoGraphic highlight={muscle} size={50} />
      </div>

      {/* Nome Distretto Muscolare */}
      <div className="muscle-card-name">{displayName}</div>

      {/* Trend badge con freccia su */}
      <div className="muscle-card-trend">
        <span className="trend-arrow-circle">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="6 11 12 5 18 11" />
          </svg>
        </span>
        <span className="trend-label">{trend}</span>
      </div>

      {/* Scala volumetrica a 18 pallini */}
      <div className="muscle-card-meter">
        <div className="meter-dots-row">
          {Array.from({ length: totalDots }).map((_, i) => (
            <span
              key={i}
              className={`meter-dot ${i < activeDots ? 'active' : ''}`}
            />
          ))}
        </div>

        {/* Indicatori numerici 0, +X, 18 */}
        <div className="meter-labels-row">
          <span className="meter-min">0</span>
          <span className="meter-current">{sets > 0 ? `+${sets}` : '0'}</span>
          <span className="meter-max">{totalDots}</span>
        </div>
      </div>
    </div>
  );
}
