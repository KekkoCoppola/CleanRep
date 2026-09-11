import { useState } from 'react';
import { MOCK_WORKOUTS_PAGE, type WorkoutsPageData } from '../mockData/workoutsMockData';
import { PlusIcon, ProgressRing, SlidersIcon } from './Icons';
import GymmyHero, { type DayMode } from './GymmyHero';
import DayHeader from './DayHeader';
import { getUserProfile } from '../../platform/profile/userProfile';

interface Props {
  data?: WorkoutsPageData;
  onStartLiveWorkout: (routineId?: string) => void;
  onOpenVideoAnalysis: () => void;
  onOpenOnboarding?: () => void;
  initialMode?: DayMode;
}

export default function WorkoutsDashboard({
  data = MOCK_WORKOUTS_PAGE,
  onStartLiveWorkout,
  onOpenVideoAnalysis,
  onOpenOnboarding,
  initialMode = 'rest',
}: Props) {
  const [dayMode, setDayMode] = useState<DayMode>(initialMode);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const profile = getUserProfile();

  const toggleDayMode = () => {
    setDayMode((prev) => (prev === 'rest' ? 'workout' : 'rest'));
  };

  return (
    <div className="workouts-screen">
      {/* 1. Header Fisso in Alto (Sticky: REST DAY / WORKOUT DAY) */}
      <DayHeader mode={dayMode} onToggleMode={toggleDayMode} />

      {/* Menu rapido azioni contestuali */}
      {showActionMenu && (
        <div className="quick-actions-sheet">
          <div className="quick-actions-title">Azioni rapide</div>
          <button
            type="button"
            className="quick-action-btn primary"
            onClick={() => {
              setShowActionMenu(false);
              onStartLiveWorkout('live-free');
            }}
          >
            Avvia Live Cam Workout
          </button>
          <button
            type="button"
            className="quick-action-btn"
            onClick={() => {
              setShowActionMenu(false);
              onOpenVideoAnalysis();
            }}
          >
            Carica e analizza file video
          </button>
          <button
            type="button"
            className="quick-action-btn"
            onClick={() => {
              setShowActionMenu(false);
              toggleDayMode();
            }}
          >
            Passa a modalità {dayMode === 'rest' ? 'Workout Day' : 'Rest Day'}
          </button>
          <button
            type="button"
            className="quick-action-btn"
            onClick={() => {
              setShowActionMenu(false);
              onOpenOnboarding?.();
            }}
          >
            Configurazione iniziale (Onboarding)
          </button>
          <button
            type="button"
            className="quick-action-btn cancel"
            onClick={() => setShowActionMenu(false)}
          >
            Annulla
          </button>
        </div>
      )}

      {/* 2. Scroll Area con Gymmy Mascot in cima e i Widget sottostanti */}
      <div className="workouts-scroll-area">
        {/* Mascotte Gymmy: visibile all'inizio, scorre via durante lo scroll */}
        <GymmyHero mode={dayMode} onToggleMode={toggleDayMode} />

        {/* Sezione Intestazione Workouts */}
        <div className="workouts-section-header">
          <h2 className="workouts-title">Workouts</h2>
          <div className="workouts-header-actions">
            <button
              type="button"
              className="header-icon-btn"
              aria-label="Filtri e opzioni"
              onClick={() => setShowActionMenu((prev) => !prev)}
            >
              <SlidersIcon size={20} />
            </button>
            <button
              type="button"
              className="header-icon-btn"
              aria-label="Aggiungi allenamento o analizza video"
              onClick={() => setShowActionMenu((prev) => !prev)}
            >
              <PlusIcon size={20} />
            </button>
          </div>
        </div>

        {/* Row 1: Workout 1 e Peso Corporeo */}
        <div className="workouts-top-grid">
          {/* Card 1: Chest + tricep */}
          <div
            className="card workout-card"
            onClick={() => onStartLiveWorkout(data.workout1.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onStartLiveWorkout(data.workout1.id)}
          >
            <div className="card-top-row">
              <ProgressRing
                number={data.workout1.number}
                progress={data.workout1.progress}
                size={54}
                strokeWidth={3.5}
              />
              <button
                type="button"
                className="card-tune-btn"
                aria-label="Dettagli allenamento"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartLiveWorkout(data.workout1.id);
                }}
              >
                <SlidersIcon size={17} />
              </button>
            </div>
            <div className="card-bottom-info">
              <h3 className="card-title">{data.workout1.title}</h3>
              <span className="card-subtitle">{data.workout1.schedule}</span>
            </div>
          </div>

          {/* Card 2: Body Weight */}
          <div
            className="card metric-card"
            onClick={() => onOpenOnboarding?.()}
            role="button"
            tabIndex={0}
            title="Tocca per modificare profilo e parametri"
          >
            <div className="card-top-row right-only">
              <button
                type="button"
                className="card-tune-btn"
                aria-label="Opzioni peso corporeo"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenOnboarding?.();
                }}
              >
                <SlidersIcon size={17} />
              </button>
            </div>
            <div className="card-hero-metric">
              <span className="hero-metric-val">
                {profile?.weight ? profile.weight : data.bodyWeight.value}
              </span>
              <span className="hero-metric-unit">
                {profile?.weightUnit ? profile.weightUnit : data.bodyWeight.unit}
              </span>
            </div>
            <div className="card-bottom-info">
              <h3 className="card-title">{data.bodyWeight.label}</h3>
              <span className="card-subtitle">
                {profile?.weight ? 'Profilo attivo' : data.bodyWeight.subtitle}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Activity Heatmap & Workout 2 */}
        <div className="card heatmap-workout-card">
          {/* Top: 3 Months Activity Dot Heatmap */}
          <div className="heatmap-container">
            {data.heatmapMonths.map((m) => (
              <div key={m.month} className="heatmap-month-column">
                <span className="heatmap-month-name">{m.month}</span>
                <div className="dot-matrix-grid">
                  {Array.from({ length: 35 }).map((_, idx) => {
                    const isActive = m.activeIndices.includes(idx);
                    return (
                      <span
                        key={idx}
                        className={`dot-indicator ${isActive ? 'active' : ''}`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom: Workout 2 Section */}
          <div
            className="heatmap-workout-bottom"
            onClick={() => onStartLiveWorkout(data.workout2.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onStartLiveWorkout(data.workout2.id)}
          >
            <div className="heatmap-workout-left">
              <ProgressRing
                number={data.workout2.number}
                progress={data.workout2.progress}
                size={54}
                strokeWidth={3.5}
              />
              <div className="heatmap-workout-titles">
                <h3 className="card-title">{data.workout2.title}</h3>
                <span className="card-subtitle">{data.workout2.schedule}</span>
              </div>
            </div>
            <button
              type="button"
              className="card-tune-btn"
              aria-label="Dettagli allenamento 2"
              onClick={(e) => {
                e.stopPropagation();
                onStartLiveWorkout(data.workout2.id);
              }}
            >
              <SlidersIcon size={17} />
            </button>
          </div>
        </div>

        {/* Card 4: Volume Lifted (Horizontal Split) */}
        <div className="card volume-split-card">
          <div className="volume-left-section">
            <h3 className="card-title">{data.volumeLifted.label}</h3>
            <span className="card-subtitle">{data.volumeLifted.subtitle}</span>
          </div>

          <div className="volume-right-section">
            <div className="card-hero-metric volume-metric">
              <span className="hero-metric-val">{data.volumeLifted.value}</span>
              <span className="hero-metric-unit">{data.volumeLifted.unit}</span>
            </div>
            <button
              type="button"
              className="card-tune-btn"
              aria-label="Dettagli volume"
            >
              <SlidersIcon size={17} />
            </button>
          </div>
        </div>

        {/* Card 5: Bottom Peek Card (+) */}
        <div
          className="card bottom-peek-card"
          onClick={() => setShowActionMenu(true)}
          role="button"
          tabIndex={0}
        >
          <div className="peek-plus-icon">
            <PlusIcon size={46} color="#353744" />
          </div>
        </div>
      </div>
    </div>
  );
}
