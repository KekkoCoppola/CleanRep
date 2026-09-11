export interface UserProfile {
  firstName: string;
  lastName: string;
  age: number | null;
  weight: number | null; // in kg or lbs
  weightUnit: 'kg' | 'lbs';
  workoutDaysPerWeek: number;
  workoutLocation: 'gym' | 'home';
  hasRoutine: boolean | null;
  completedAt?: string;
}

const STORAGE_KEY = 'cleanrep_user_profile';
const ONBOARDING_KEY = 'cleanrep_onboarding_completed';

export const DEFAULT_USER_PROFILE: UserProfile = {
  firstName: '',
  lastName: '',
  age: 28,
  weight: 75,
  weightUnit: 'kg',
  workoutDaysPerWeek: 3,
  workoutLocation: 'gym',
  hasRoutine: false,
};

/**
 * Carica il profilo utente salvato in localStorage.
 */
export function getUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

/**
 * Salva il profilo utente in localStorage e marca l'onboarding come completato.
 */
export function saveUserProfile(profile: UserProfile): void {
  try {
    const dataToSave = {
      ...profile,
      completedAt: profile.completedAt ?? new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    localStorage.setItem(ONBOARDING_KEY, 'true');
  } catch (err) {
    console.warn('Impossibile salvare il profilo in localStorage:', err);
  }
}

/**
 * Controlla se l'onboarding è già stato completato.
 */
export function isOnboardingCompleted(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Reimposta l'onboarding (utile per test e sviluppo).
 */
export function resetOnboarding(): void {
  try {
    localStorage.removeItem(ONBOARDING_KEY);
  } catch (err) {
    console.warn('Errore nel reset dell\'onboarding:', err);
  }
}
