import { useState } from 'react';
import Gymmy3DViewer from './Gymmy3DViewer';

export type DayMode = 'rest' | 'workout';

interface Props {
  mode: DayMode;
  onToggleMode?: () => void;
}

/**
 * Componente Mascot Gymmy per la Hero Section della Home.
 * Include:
 * - Nuova Mascotte Gymmy (Lontra con fascia nera atletica e logo CleanRep)
 * - Visualizzatore 3D interattivo con rotazione touch e modello rigged predisposto ad animazioni
 * - Fallback / Switch rapido alle illustrazioni 2D ad alta risoluzione
 */
export default function GymmyHero({ mode, onToggleMode }: Props) {
  const [view3D, setView3D] = useState(false);
  const isRest = mode === 'rest';

  return (
    <div
      className="gymmy-hero-container"
      role="region"
      aria-label="Gymmy Mascot Hero"
    >
      {/* Controlli superiori: Toggle 3D / Modalità Giorno */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setView3D((v) => !v);
          }}
          style={{
            background: view3D ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 255, 255, 0.08)',
            border: view3D ? '1px solid #00e676' : '1px solid rgba(255, 255, 255, 0.15)',
            color: view3D ? '#00e676' : 'var(--text-muted, #9e9e9e)',
            borderRadius: '12px',
            padding: '3px 10px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          title="Alterna tra vista 3D interattiva e classica"
        >
          {view3D ? '★ 3D Model Attivo' : 'Passa a Gymmy 3D'}
        </button>
      </div>

      {/* Mascotte Gymmy */}
      <div
        className="gymmy-character-wrap"
        onClick={onToggleMode}
        role="button"
        title="Tocca per alternare tra Rest Day e Workout Day"
        style={{ cursor: 'pointer' }}
      >
        {view3D ? (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '320px', margin: '0 auto' }}
          >
            <Gymmy3DViewer mode={mode} />
            <div
              style={{
                textAlign: 'center',
                fontSize: '11px',
                color: 'var(--text-muted, #757575)',
                marginTop: '4px',
              }}
            >
              Trascina per ruotare Gymmy • Fascia CleanRep inclusa
            </div>
          </div>
        ) : isRest ? (
          <div className="gymmy-rest-wrapper">
            {/* Animazione Zzz sonno */}
            <div className="gymmy-zzz-container" aria-hidden="true">
              <span className="zzz-letter z3">Z</span>
              <span className="zzz-letter z2">Z</span>
              <span className="zzz-letter z1">z</span>
            </div>
            <img
              src={`${import.meta.env.BASE_URL}assets/gymmy/gymmy-rest.png`}
              alt="Gymmy la lontra riposa con fascia CleanRep (Rest Day)"
              className="gymmy-img gymmy-rest-img"
              loading="eager"
            />
          </div>
        ) : (
          <div className="gymmy-workout-wrapper">
            <img
              src={`${import.meta.env.BASE_URL}assets/gymmy/gymmy-workout.png`}
              alt="Gymmy la lontra esegue squat con fascia e logo CleanRep (Workout Day)"
              className="gymmy-img gymmy-workout-img"
              loading="eager"
            />
          </div>
        )}
      </div>
    </div>
  );
}
