interface IconProps {
  className?: string;
  size?: number;
  color?: string;
}

/**
 * Icona Sliders / Tuning presente nell'header e nelle card del mockup.
 */
export function SlidersIcon({ className = '', size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="14" y1="3" x2="14" y2="11" />
      <line x1="4" y1="17" x2="20" y2="17" />
      <line x1="9" y1="13" x2="9" y2="21" />
    </svg>
  );
}

/**
 * Icona Più (+) per l'header e per la card in basso.
 */
export function PlusIcon({ className = '', size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/**
 * Icona Grid (4 riquadri 2x2 arrotondati) per la prima tab della navbar.
 */
export function GridNavIcon({ className = '', size = 22, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
    </svg>
  );
}

/**
 * Icona Calendario (precedente tab).
 */
export function CalendarNavIcon({ className = '', size = 22, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="17" rx="3" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

/**
 * Icona Routine / Scheda (checklist su clipboard) fedele al mockup del secondo tab navbar.
 */
export function RoutineNavIcon({ className = '', size = 22, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1.5" strokeWidth="2" />
      <line x1="8" y1="10" x2="16" y2="10" strokeWidth="2" />
      <line x1="8" y1="14" x2="16" y2="14" strokeWidth="2" />
      <line x1="8" y1="18" x2="13" y2="18" strokeWidth="2" />
    </svg>
  );
}

/**
 * Icona Play Circolare con bordo bianco per la card routine nel mockup.
 */
export function PlayCircleIcon({ className = '', size = 32, color = '#ffffff' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="14" stroke={color} strokeWidth="2" fill="none" />
      <polygon points="13,10 22,16 13,22" fill={color} />
    </svg>
  );
}

/**
 * Icona Matita per modifica nome routine.
 */
export function EditPencilIcon({ className = '', size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

/**
 * Icona Orologio per durata routine (es. 60 min).
 */
export function ClockIcon({ className = '', size = 15, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

/**
 * Icona Lente di Ingrandimento per barra ricerca esercizio.
 */
export function SearchIcon({ className = '', size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

/**
 * Icona Grafico a Barre per la terza tab della navbar.
 */
export function ChartNavIcon({ className = '', size = 22, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

/**
 * Icona Videocamera per la quarta tab della navbar (Live Cam Workout).
 * Richiesta esplicita dell'utente in sostituzione del messaggio.
 */
export function VideoCameraNavIcon({ className = '', size = 22, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="3" />
    </svg>
  );
}

/**
 * Icona Torna Indietro / Esci.
 */
export function ArrowLeftIcon({ className = '', size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

/**
 * Icona Manubrio / Pesi per la selezione "Palestra".
 */
export function DumbbellIcon({ className = '', size = 22, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="8" width="3" height="8" rx="1" />
      <rect x="5" y="6" width="3" height="12" rx="1" />
      <line x1="8" y1="12" x2="16" y2="12" strokeWidth="2.6" />
      <rect x="16" y="6" width="3" height="12" rx="1" />
      <rect x="19" y="8" width="3" height="8" rx="1" />
    </svg>
  );
}

/**
 * Icona Casa per la selezione "In casa".
 */
export function HomeIcon({ className = '', size = 22, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 10.5L12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9.5z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

/**
 * Icona Scheda / Checklist per "Sì, ho già una mia scheda".
 */
export function ClipboardCheckIcon({ className = '', size = 22, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <polyline points="9 13 11 15 15 10" />
    </svg>
  );
}

/**
 * Icona Bersaglio / Target per "No, parto da zero".
 */
export function TargetIcon({ className = '', size = 22, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

interface ProgressRingProps {
  number: number | string;
  progress: number; // Valore tra 0 e 1 (es. 0.75)
  size?: number;
  strokeWidth?: number;
}

/**
 * Componente Progress Ring circolare identico a quello nelle card del mockup.
 * Ha una pista scura di sfondo, l'arco bianco di progresso e il numero grande al centro.
 */
export function ProgressRing({ number, progress, size = 48, strokeWidth = 3 }: ProgressRingProps) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  const strokeDashoffset = circumference - clamped * circumference;

  return (
    <div
      className="progress-ring-container"
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={size}
        height={size}
        style={{
          transform: 'rotate(-90deg)',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        {/* Cerchio di sfondo (track) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--track-bg, #282a35)"
          strokeWidth={strokeWidth}
        />
        {/* Arco bianco di progresso */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent-white, #ffffff)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="progress-ring-number">{number}</span>
    </div>
  );
}
