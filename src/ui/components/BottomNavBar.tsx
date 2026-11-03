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
  /** Sessione live in corso: la navbar resta sotto la fotocamera, con l'icona cam attiva. */
  liveActive?: boolean;
}

/**
 * Docked bottom navigation bar fedele al mockup:
 * 4 icone ad alto contrasto con blur di sfondo.
 * La seconda icona è la Scheda/Routine (checklist su clipboard) richiesta esplicitamente.
 * La quarta icona è la videocamera che avvia l'allenamento live AR con MediaPipe.
 */
export default function BottomNavBar({ activeTab, onSelectTab, onStartLiveCam, liveActive = false }: Props) {
  const isDashboardActive = !liveActive && activeTab === 'dashboard';
  const isRoutineActive = !liveActive && (activeTab === 'routine' || activeTab === 'calendar');
  const isAnalyticsActive = !liveActive && activeTab === 'analytics';

  return (
    <nav className={`bottom-navbar ${liveActive ? 'bottom-navbar--live' : ''}`} aria-label="Navigazione principale">
      <div className="bottom-navbar-content">
        <button
          type="button"
          className={`nav-item ${isDashboardActive ? 'active' : ''}`}
          onClick={() => onSelectTab('dashboard')}
          aria-label="Workouts Dashboard"
          aria-current={isDashboardActive ? 'page' : undefined}
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
          className={`nav-item ${isAnalyticsActive ? 'active' : ''}`}
          onClick={() => onSelectTab('analytics')}
          aria-label="Statistiche e carichi"
          aria-current={isAnalyticsActive ? 'page' : undefined}
        >
          <ChartNavIcon size={24} />
        </button>

        <button
          type="button"
          className={`nav-item live-cam-nav-item ${liveActive ? 'active' : ''}`}
          onClick={onStartLiveCam}
          aria-current={liveActive ? 'page' : undefined}
          aria-label="Avvia Live Cam Workout"
          title="Inizia allenamento con fotocamera live"
        >
          <VideoCameraNavIcon size={25} />
        </button>
      </div>
    </nav>
  );
}
