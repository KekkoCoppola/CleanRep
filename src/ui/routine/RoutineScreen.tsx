import { useMemo, useRef, useState } from 'react';
import {
  PRESET_EXERCISES,
  type MuscleTarget,
  type PresetExercise,
  type Routine,
  type RoutineExercise,
} from './RoutineTypes';
import { clearAllRoutines, deleteRoutine, loadRoutines, saveRoutine } from './RoutineStorage';
import RoutineHeader from './RoutineHeader';
import MuscleVolumeCard from './MuscleVolumeCard';
import { ExerciseCustomizationGraphic } from './AnatomyGraphic';
import { PlayCircleIcon, SearchIcon } from '../components/Icons';
import './routine.css';

interface Props {
  onStartWorkout?: (routineId?: string) => void;
}

type Step = 'list' | 'create' | 'select-exercise' | 'customize-exercise';

export default function RoutineScreen({ onStartWorkout }: Props) {
  // Lista routine salvate (inizia vuota al primo avvio)
  const [routines, setRoutines] = useState<Routine[]>(() => loadRoutines());

  // Step corrente del workflow
  const [step, setStep] = useState<Step>('list');

  // Stato per la routine in fase di creazione
  const [routineName, setRoutineName] = useState('Chest day');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('Chest day');
  const [createdExercises, setCreatedExercises] = useState<RoutineExercise[]>([]);

  // Ricerca e selezione esercizio
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<PresetExercise>(PRESET_EXERCISES[2]); // Dumbbell Incline di default

  // Campi personalizzazione esercizio
  const [customSets, setCustomSets] = useState('3');
  const [customReps, setCustomReps] = useState('8-12');
  const [customNotes, setCustomNotes] = useState('');

  // Riferimento al container per auto-scroll fluido
  const containerRef = useRef<HTMLDivElement>(null);

  // Calcolo dinamico durata in base ai sets
  const calculatedDuration = useMemo(() => {
    if (createdExercises.length === 0) return 0;
    // Circa 3-4 minuti a set incluso recupero e riscaldamento
    const totalSets = createdExercises.reduce((acc, ex) => acc + ex.sets, 0);
    return Math.max(20, Math.min(90, totalSets * 4 + 10));
  }, [createdExercises]);

  // Calcolo dinamico dei volumi muscolari coinvolti
  const muscleVolumes = useMemo(() => {
    // Distretti default presenti nel mockup (Front delts, Chest, Side delts)
    const defaultMuscles: MuscleTarget[] = ['front-delts', 'chest', 'side-delts'];
    const map: Record<MuscleTarget, number> = {
      'front-delts': 0,
      chest: 0,
      'side-delts': 0,
      triceps: 0,
      biceps: 0,
      lats: 0,
      traps: 0,
      abs: 0,
      legs: 0,
    };

    createdExercises.forEach((ex) => {
      ex.primaryMuscles.forEach((m) => {
        map[m] = (map[m] || 0) + ex.sets;
      });
    });

    return defaultMuscles.map((m) => {
      let displayName = 'Chest';
      if (m === 'front-delts') displayName = 'Front delts';
      if (m === 'side-delts') displayName = 'Side delts';

      return {
        muscle: m,
        displayName,
        sets: map[m],
      };
    });
  }, [createdExercises]);

  // Filtro esercizi nella barra di ricerca
  const filteredExercises = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return PRESET_EXERCISES;
    return PRESET_EXERCISES.filter((ex) =>
      ex.name.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Avvio flusso creazione nuova routine
  const handleStartCreate = () => {
    setRoutineName('Chest day');
    setTempName('Chest day');
    setCreatedExercises([]);
    setStep('create');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Apertura schermata selezione esercizio
  const handleOpenAddExercise = () => {
    setSearchQuery('');
    setStep('select-exercise');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Selezione esercizio per personalizzazione
  const handleSelectPreset = (preset: PresetExercise) => {
    setSelectedPreset(preset);
    setCustomSets(String(preset.defaultSets));
    setCustomReps(preset.defaultReps);
    setCustomNotes(preset.defaultNotes || '');
    setStep('customize-exercise');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Conferma aggiunta esercizio con sets e reps personalizzati
  const handleConfirmAddExercise = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const setsNumber = Math.max(1, parseInt(customSets, 10) || 3);

    const newEx: RoutineExercise = {
      id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      exerciseId: selectedPreset.id,
      name: selectedPreset.name,
      sets: setsNumber,
      reps: customReps || selectedPreset.defaultReps,
      notes: customNotes,
      primaryMuscles: selectedPreset.primaryMuscles,
    };

    setCreatedExercises((prev) => [...prev, newEx]);
    setStep('create');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Salvataggio definitivo della routine e passaggio alla schermata routine con routine
  const handleSaveRoutine = () => {
    if (createdExercises.length === 0) return;

    const newRoutine: Routine = {
      id: `routine-${Date.now()}`,
      name: routineName || 'Chest Day',
      estimatedMinutes: calculatedDuration > 0 ? calculatedDuration : 60,
      exercises: createdExercises,
      createdAt: Date.now(),
    };

    const updated = saveRoutine(newRoutine);
    setRoutines(updated);
    setStep('list');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Cancellazione singola routine (supporto per test)
  const handleDeleteRoutine = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteRoutine(id);
    setRoutines(updated);
  };

  // Reset completo per testare lo stato iniziale vuoto
  const handleResetForTesting = () => {
    clearAllRoutines();
    setRoutines([]);
    setStep('list');
  };

  // Gestione Focus per evitare che la tastiera mobile copra gli input
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 280);
  };

  return (
    <div className="routine-screen-container" ref={containerRef}>
      {/* 1. Header con logo CleanRep e navigazione */}
      <RoutineHeader
        step={step}
        routineName={routineName}
        durationMinutes={calculatedDuration}
        selectedExerciseName={selectedPreset ? (selectedPreset.name.includes('Incline') ? 'Dumbell Incline' : selectedPreset.name) : 'Personalizza'}
        onBack={() => {
          if (step === 'customize-exercise') setStep('select-exercise');
          else if (step === 'select-exercise') setStep('create');
          else if (step === 'create') setStep('list');
        }}
        onEditName={() => setIsEditingName(true)}
      />

      {/* Modal rapido per modifica nome routine */}
      {isEditingName && (
        <div className="routine-edit-name-modal" role="dialog" aria-modal="true">
          <div className="routine-edit-name-content">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Nome della Routine</h3>
            <input
              type="text"
              className="routine-form-input"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              placeholder="es. Chest day, Leg day..."
              autoFocus
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="secondary"
                style={{ padding: '8px 16px', borderRadius: '12px' }}
                onClick={() => setIsEditingName(false)}
              >
                Annulla
              </button>
              <button
                type="button"
                className="cta"
                style={{ padding: '8px 20px', borderRadius: '12px' }}
                onClick={() => {
                  if (tempName.trim()) setRoutineName(tempName.trim());
                  setIsEditingName(false);
                }}
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------
          SCHERMATA 1 & 5: Lista Routine (Vuota o con Routine)
         ------------------------------------------------------------------ */}
      {step === 'list' && (
        <div className="routine-list-screen">
          {routines.length === 0 ? (
            /* Schermata routine (vuota).png */
            <div className="routine-empty-state-container">
              <p className="routine-empty-hint">
                Nessuna routine creata. Premi <strong>+ Crea</strong> in basso a destra per iniziare il tuo primo piano.
              </p>
            </div>
          ) : (
            /* Schermata routine (con routine).png */
            <div className="routine-cards-list">
              {routines.map((routine) => (
                <div
                  key={routine.id}
                  className="routine-saved-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => onStartWorkout?.(routine.id)}
                  title="Tocca per avviare il workout"
                >
                  <div className="routine-card-main-info">
                    <div className="routine-card-title">{routine.name}</div>
                    <div className="routine-card-duration">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>{routine.estimatedMinutes} min</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      className="routine-card-play-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartWorkout?.(routine.id);
                      }}
                      aria-label="Avvia allenamento"
                    >
                      <PlayCircleIcon size={34} />
                    </button>

                    <button
                      type="button"
                      className="routine-header-back-btn"
                      style={{ width: '28px', height: '28px', opacity: 0.4 }}
                      onClick={(e) => handleDeleteRoutine(routine.id, e)}
                      title="Elimina routine"
                      aria-label="Elimina routine"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}

              {/* Tasto discreto di reset per test rapidi dello stato vuoto */}
              <div style={{ textAlign: 'center', marginTop: '30px' }}>
                <button
                  type="button"
                  onClick={handleResetForTesting}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#494c5b',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Resetta routine (test stato vuoto)
                </button>
              </div>
            </div>
          )}

          {/* Floating Action Button "+ Crea" presente sia in stato vuoto che pieno */}
          <button
            type="button"
            className="routine-floating-create-btn"
            onClick={handleStartCreate}
            aria-label="Crea una nuova routine"
          >
            + Crea
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------
          SCHERMATA 2: Creazione Routine (Creazione Routine.png)
         ------------------------------------------------------------------ */}
      {step === 'create' && (
        <div className="routine-create-screen">
          {/* Carosello Volumetrico Muscoli (Front delts, Chest, Side delts...) */}
          <div className="routine-muscle-carousel" aria-label="Impatto muscolare della routine">
            {muscleVolumes.map((item) => (
              <MuscleVolumeCard
                key={item.muscle}
                muscle={item.muscle}
                displayName={item.displayName}
                sets={item.sets}
                maxTarget={18}
                trend="Growing"
              />
            ))}
          </div>

          {/* Lista Esercizi Aggiunti */}
          {createdExercises.length > 0 && (
            <div className="routine-create-exercises-list">
              {createdExercises.map((ex) => (
                <div key={ex.id} className="routine-exercise-item-pill">
                  <span className="routine-exercise-name">{ex.name}</span>
                  <span className="routine-exercise-sets-tag">{ex.sets} sets</span>
                </div>
              ))}
            </div>
          )}

          {/* Tasto "+ aggiungi esercizio" */}
          <button
            type="button"
            className="routine-add-exercise-trigger-btn"
            onClick={handleOpenAddExercise}
          >
            + aggiungi esercizio
          </button>

          {/* Tasto "Salva" (appare solo quando ci sono esercizi) */}
          {createdExercises.length > 0 && (
            <div className="routine-save-action-wrapper">
              <button
                type="button"
                className="routine-save-btn"
                onClick={handleSaveRoutine}
              >
                Salva
              </button>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------
          SCHERMATA 3: Aggiunta Esercizio (Aggiunta esercizio.png)
         ------------------------------------------------------------------ */}
      {step === 'select-exercise' && (
        <div className="routine-select-exercise-screen">
          {/* Barra di Ricerca Pillola */}
          <div className="routine-search-bar">
            <input
              type="text"
              className="routine-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca esercizio…"
              autoFocus
              onFocus={handleInputFocus}
            />
            <SearchIcon size={20} className="routine-search-icon" />
          </div>

          {/* Lista Esercizi Selezionabili */}
          <div className="routine-exercises-preset-list">
            {filteredExercises.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="routine-preset-item-card"
                onClick={() => handleSelectPreset(preset)}
              >
                <span className="routine-preset-item-title">{preset.name}</span>
              </button>
            ))}

            {filteredExercises.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px', color: '#686b7c' }}>
                Nessun esercizio trovato per "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------
          SCHERMATA 4: Personalizzazione Esercizio (Personalizzazione esercizio.png)
         ------------------------------------------------------------------ */}
      {step === 'customize-exercise' && (
        <div className="routine-customize-screen">
          {/* Grafica Esercizio Panca Inclinata */}
          <ExerciseCustomizationGraphic />

          {/* Form Personalizzazione Campi */}
          <form className="routine-customize-form" onSubmit={handleConfirmAddExercise}>
            <div className="routine-form-field">
              <label className="routine-form-label" htmlFor="field-sets">
                Numero di sets
              </label>
              <input
                id="field-sets"
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min={1}
                max={20}
                className="routine-form-input"
                value={customSets}
                onChange={(e) => setCustomSets(e.target.value)}
                onFocus={handleInputFocus}
                required
              />
            </div>

            <div className="routine-form-field">
              <label className="routine-form-label" htmlFor="field-reps">
                Numero di reps per ogni set
              </label>
              <input
                id="field-reps"
                type="text"
                className="routine-form-input"
                value={customReps}
                onChange={(e) => setCustomReps(e.target.value)}
                onFocus={handleInputFocus}
                placeholder="es. 10 o 8-12"
                required
              />
            </div>

            <div className="routine-form-field">
              <label className="routine-form-label" htmlFor="field-notes">
                Note aggiuntive
              </label>
              <input
                id="field-notes"
                type="text"
                className="routine-form-input"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                onFocus={handleInputFocus}
                placeholder="es. RPE 8, pausa 90s..."
              />
            </div>

            {/* Tasto Pillola Bianco "Aggiungi" */}
            <div className="routine-customize-add-btn-wrapper">
              <button
                type="submit"
                className="routine-customize-add-btn"
              >
                Aggiungi
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
