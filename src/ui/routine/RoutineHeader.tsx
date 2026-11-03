import { ArrowLeftIcon, ClockIcon, EditPencilIcon } from '../components/Icons';

interface Props {
  step: 'list' | 'create' | 'select-exercise' | 'customize-exercise';
  routineName?: string;
  durationMinutes?: number;
  selectedExerciseName?: string;
  onBack?: () => void;
  onEditName?: () => void;
}

/**
 * Header fisso in alto fedele al 100% ai mockup:
 * Mostra sempre la scritta "Routine" con l'iconica lettera "R" di CleanRep,
 * e a seconda dello step mostra il sottotitolo o i dettagli (nome routine, durata, matita edit, freccia indietro).
 */
export default function RoutineHeader({
  step,
  routineName = 'Chest day',
  durationMinutes = 0,
  selectedExerciseName = "Dumbell Incline",
  onBack,
  onEditName,
}: Props) {
  const showBack = step !== 'list';

  return (
    <header className="routine-header">
      {/* Freccia Indietro (quando non siamo nella lista principale) */}
      {showBack && onBack && (
        <button
          type="button"
          className="routine-header-back-btn"
          onClick={onBack}
          aria-label="Torna indietro"
        >
          <ArrowLeftIcon size={20} />
        </button>
      )}

      {/* Logo Routine con la 'R' di CleanRep */}
      <div className="routine-brand-row">
        <img
          src={`${import.meta.env.BASE_URL}assets/logo/CleanRep_R.svg`}
          alt="R"
          className="cleanrep-inline-r routine-brand-r"
        />
        <span className="routine-brand-text">outine</span>
      </div>

      {/* Sottotitoli contestuali allo step */}
      {step === 'create' && (
        <div className="routine-sub-details">
          <button
            type="button"
            className="routine-title-edit-btn"
            onClick={onEditName}
            title="Tocca per modificare il nome della routine"
          >
            <span className="routine-current-name">{routineName}</span>
            <EditPencilIcon size={14} className="routine-pencil-icon" />
          </button>

          <div className="routine-duration-badge">
            <ClockIcon size={13} />
            <span>{durationMinutes > 0 ? `${durationMinutes} min` : '0 min'}</span>
          </div>
        </div>
      )}

      {step === 'select-exercise' && (
        <div className="routine-step-subtitle">Scegli l'esercizio</div>
      )}

      {step === 'customize-exercise' && (
        <div className="routine-step-subtitle">{selectedExerciseName}</div>
      )}
    </header>
  );
}
