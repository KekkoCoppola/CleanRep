import { useState } from 'react';
import {
  DEFAULT_USER_PROFILE,
  saveUserProfile,
  type UserProfile,
} from '../../platform/profile/userProfile';
import {
  ArrowLeftIcon,
  ClipboardCheckIcon,
  DumbbellIcon,
  HomeIcon,
  TargetIcon,
} from './Icons';

interface Props {
  onComplete: (profile: UserProfile) => void;
}

export default function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState<number>(1);
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward');

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState<number | ''>(DEFAULT_USER_PROFILE.age ?? 28);
  const [weight, setWeight] = useState<number | ''>(DEFAULT_USER_PROFILE.weight ?? 75);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [workoutDays, setWorkoutDays] = useState<number>(3);
  const [workoutLocation, setWorkoutLocation] = useState<'gym' | 'home'>('gym');
  const [hasRoutine, setHasRoutine] = useState<boolean | null>(null);

  // Navigazione
  const nextStep = () => {
    if (step < 4) {
      setSlideDirection('forward');
      setStep((prev) => prev + 1);
    } else {
      // Salva e completa
      const profile: UserProfile = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        age: typeof age === 'number' ? age : null,
        weight: typeof weight === 'number' ? weight : null,
        weightUnit,
        workoutDaysPerWeek: workoutDays,
        workoutLocation,
        hasRoutine,
      };
      saveUserProfile(profile);
      onComplete(profile);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setSlideDirection('backward');
      setStep((prev) => prev - 1);
    }
  };

  // Validazione step per abilitare il pulsante "Continua"
  const canContinue = (): boolean => {
    switch (step) {
      case 1:
        return firstName.trim().length > 0;
      case 2:
        return typeof age === 'number' && age > 0 && typeof weight === 'number' && weight > 0;
      case 3:
        return workoutDays > 0;
      case 4:
        return hasRoutine !== null;
      default:
        return true;
    }
  };

  return (
    <div className="onboarding-screen">
      {/* Top Bar con tasto indietro */}
      <header className="onboarding-header">
        {step > 1 ? (
          <button
            type="button"
            className="onboarding-back-btn"
            onClick={prevStep}
            aria-label="Torna al passaggio precedente"
          >
            <ArrowLeftIcon size={20} />
          </button>
        ) : (
          <div className="onboarding-back-spacer" />
        )}

        {/* Logo CleanRep 'R' centrato */}
        <div className="onboarding-logo-wrapper">
          <img
            src={`${import.meta.env.BASE_URL}assets/logo/CleanRep_R.svg`}
            alt="CleanRep Logo"
            className="onboarding-logo"
          />
        </div>

        <div className="onboarding-back-spacer" />
      </header>

      {/* Contenuto dinamico animato con transizione */}
      <div className={`onboarding-step-body slide-${slideDirection}`} key={step}>
        {/* Step 1: Nome e Cognome */}
        {step === 1 && (
          <div className="onboarding-step-card">
            <h1 className="onboarding-title">Come ti chiami?</h1>
            <p className="onboarding-subtitle">Piacere di conoscerti! Personalizzeremo la tua esperienza.</p>

            <div className="onboarding-inputs-group">
              <div className="onboarding-field">
                <input
                  type="text"
                  className="onboarding-pill-input"
                  placeholder="Nome"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="onboarding-field">
                <input
                  type="text"
                  className="onboarding-pill-input"
                  placeholder="Cognome (facoltativo)"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Età e Peso */}
        {step === 2 && (
          <div className="onboarding-step-card">
            <h1 className="onboarding-title">Quanti anni hai e quanto pesi?</h1>
            <p className="onboarding-subtitle">I tuoi dati sono al sicuro. Servono solo a calibrare i carichi ideali.</p>

            <div className="onboarding-inputs-group">
              <div className="onboarding-field-row">
                <label className="onboarding-label">Età</label>
                <div className="onboarding-input-with-badge">
                  <input
                    type="number"
                    className="onboarding-pill-input"
                    placeholder="28"
                    min={10}
                    max={120}
                    value={age === '' ? '' : age}
                    onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                    autoFocus
                  />
                  <span className="onboarding-unit-badge">anni</span>
                </div>
              </div>

              <div className="onboarding-field-row">
                <div className="onboarding-label-row">
                  <label className="onboarding-label">Peso</label>
                  <div className="onboarding-unit-toggle">
                    <button
                      type="button"
                      className={`unit-toggle-btn ${weightUnit === 'kg' ? 'active' : ''}`}
                      onClick={() => setWeightUnit('kg')}
                    >
                      kg
                    </button>
                    <button
                      type="button"
                      className={`unit-toggle-btn ${weightUnit === 'lbs' ? 'active' : ''}`}
                      onClick={() => setWeightUnit('lbs')}
                    >
                      lbs
                    </button>
                  </div>
                </div>
                <div className="onboarding-input-with-badge">
                  <input
                    type="number"
                    className="onboarding-pill-input"
                    placeholder={weightUnit === 'kg' ? '75' : '165'}
                    min={20}
                    max={300}
                    value={weight === '' ? '' : weight}
                    onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                  <span className="onboarding-unit-badge">{weightUnit}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Frequenza e Luogo */}
        {step === 3 && (
          <div className="onboarding-step-card">
            <h1 className="onboarding-title">Quanto e dove ti alleni?</h1>
            <p className="onboarding-subtitle">Nessun vincolo: adatteremo le sessioni ai tuoi ritmi e spazi.</p>

            <div className="onboarding-inputs-group">
              <div className="onboarding-field-section">
                <span className="onboarding-section-label">Giorni a settimana:</span>
                <div className="onboarding-chips-row">
                  {[1, 2, 3, 4, 5, 6, 7].map((days) => (
                    <button
                      key={days}
                      type="button"
                      className={`onboarding-chip ${workoutDays === days ? 'active' : ''}`}
                      onClick={() => setWorkoutDays(days)}
                    >
                      {days}
                    </button>
                  ))}
                </div>
              </div>

              <div className="onboarding-field-section">
                <span className="onboarding-section-label">Luogo di allenamento:</span>
                <div className="onboarding-options-vertical">
                  <button
                    type="button"
                    className={`onboarding-option-pill ${workoutLocation === 'gym' ? 'active' : ''}`}
                    onClick={() => setWorkoutLocation('gym')}
                  >
                    <div className="option-icon-wrapper">
                      <DumbbellIcon size={22} />
                    </div>
                    <div className="option-texts">
                      <span className="option-title">Palestra</span>
                      <span className="option-desc">Con manubri, bilancieri e macchine</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`onboarding-option-pill ${workoutLocation === 'home' ? 'active' : ''}`}
                    onClick={() => setWorkoutLocation('home')}
                  >
                    <div className="option-icon-wrapper">
                      <HomeIcon size={22} />
                    </div>
                    <div className="option-texts">
                      <span className="option-title">In casa</span>
                      <span className="option-desc">A corpo libero o con piccoli attrezzi</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Routine Sì / No */}
        {step === 4 && (
          <div className="onboarding-step-card">
            <h1 className="onboarding-title">Hai già una routine?</h1>
            <p className="onboarding-subtitle">Nessuna pressione: puoi iniziare da zero o seguire la tua scheda.</p>

            <div className="onboarding-inputs-group">
              <div className="onboarding-options-vertical">
                <button
                  type="button"
                  className={`onboarding-option-pill ${hasRoutine === true ? 'active' : ''}`}
                  onClick={() => setHasRoutine(true)}
                >
                  <div className="option-icon-wrapper">
                    <ClipboardCheckIcon size={22} />
                  </div>
                  <div className="option-texts">
                    <span className="option-title">Sì, ho già una mia scheda</span>
                    <span className="option-desc">La seguiremo insieme con la fotocamera AI</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`onboarding-option-pill ${hasRoutine === false ? 'active' : ''}`}
                  onClick={() => setHasRoutine(false)}
                >
                  <div className="option-icon-wrapper">
                    <TargetIcon size={22} />
                  </div>
                  <div className="option-texts">
                    <span className="option-title">No, parto da zero</span>
                    <span className="option-desc">Ti guideremo passo dopo passo, al tuo ritmo</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer fisso: testo rassicurante + indicatore a 4 trattini + Continua */}
      <footer className="onboarding-footer">
        <p className="onboarding-disclaimer">
          Le tue scelte non limiteranno l'accesso a nessuna funzionalità.
        </p>

        {/* Indicatore a 4 trattini orizzontali */}
        <div className="onboarding-steps-indicator" aria-label={`Passaggio ${step} di 4`}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`onboarding-step-dash ${i === step ? 'active' : i < step ? 'completed' : ''}`}
            />
          ))}
        </div>

        {/* Pulsante primario Continua / Inizia */}
        <button
          type="button"
          className="onboarding-continue-btn"
          disabled={!canContinue()}
          onClick={nextStep}
        >
          {step === 4 ? 'Inizia il tuo percorso' : 'Continua'}
        </button>
      </footer>
    </div>
  );
}
