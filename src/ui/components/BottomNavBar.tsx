import {
  ChartNavIcon,
  GridNavIcon,
  RoutineNavIcon,
  VideoCameraNavIcon,
} from './Icons';

export type NavTab = 'dashboard' | 'routine' | 'analytics' | 'calendar';

interface Props {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onStartLiveCam: () => void;
}

/**
 * Docked bottom navigation bar fedele al mockup:
 * 4 icone ad alto contrasto con blur di sfondo.
 * La seconda icona è la Scheda/Routine (checklist su clipboard) richiesta esplicitamente.
 * La quarta icona è la videocamera che avvia l'allenamento live AR con MediaPipe.
 */
export default function BottomNavBar({ activeTab, onSelectTab, onStartLiveCam }: Props) {
  const isRoutineActive = activeTab === 'routine' || activeTab === 'calendar';

  return (
    <nav className="bottom-navbar" aria-label="Navigazione principale">
      <div className="bottom-navbar-content">
        <button
          type="button"
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => onSelectTab('dashboard')}
          aria-label="Workouts Dashboard"
          aria-current={activeTab === 'dashboard' ? 'page' : undefined}
        >
          <GridNavIcon size={24} />
        </button>

        <button
          type="button"
          className={`nav-item ${isRoutineActive ? 'active' : ''}`}
          onClick={() => onSelectTab('routine')}
          aria-label="Routine e schede di allenamento"
          aria-current={isRoutineActive ? 'page' : undefined}
        >
          <RoutineNavIcon size={24} />
        </button>

        <button
          type="button"
          className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => onSelectTab('analytics')}
          aria-label="Statistiche e carichi"
          aria-current={activeTab === 'analytics' ? 'page' : undefined}
        >
          <ChartNavIcon size={24} />
        </button>

        <button
          type="button"
          className="nav-item live-cam-nav-item"
          onClick={onStartLiveCam}
          aria-label="Avvia Live Cam Workout"
          title="Inizia allenamento con fotocamera live"
        >
          <VideoCameraNavIcon size={25} />
        </button>
      </div>
    </nav>
  );
}
