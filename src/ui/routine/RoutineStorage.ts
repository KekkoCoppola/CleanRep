import type { Routine } from './RoutineTypes';

const STORAGE_KEY = 'cleanrep_routines_v1';

/**
 * Carica le routine salvate nel localStorage.
 * Di default inizia con lista vuota come richiesto per il workflow:
 * "Si inizia con la schermata routine vuota (Schermata routine (vuota).png )"
 */
export function loadRoutines(): Routine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Salva una nuova routine o aggiorna una esistente
 */
export function saveRoutine(routine: Routine): Routine[] {
  const current = loadRoutines();
  const index = current.findIndex((r) => r.id === routine.id);
  let updated: Routine[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = routine;
  } else {
    updated = [routine, ...current];
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Errore salvataggio routine in localStorage:', err);
  }
  return updated;
}

/**
 * Elimina una routine per ID
 */
export function deleteRoutine(id: string): Routine[] {
  const current = loadRoutines();
  const updated = current.filter((r) => r.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Errore eliminazione routine:', err);
  }
  return updated;
}

/**
 * Reset completo (utile per tornare allo stato vuoto iniziale di test)
 */
export function clearAllRoutines(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
