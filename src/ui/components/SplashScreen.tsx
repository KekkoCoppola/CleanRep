import { useEffect, useState, type CSSProperties } from 'react';

interface Props {
  onDone: () => void;
}

const LOGO_R = `${import.meta.env.BASE_URL}assets/logo/CleanRep_R.svg`;
const PREFIX = 'Clean';
const SUFFIX = 'ep';

/** Attesa massima di logo e font prima di far partire comunque l'animazione. */
const ASSET_WAIT_MS = 600;
/** Durata della sequenza: la R "flette", le lettere escono, la barra si riempie. */
const PLAY_MS = 2300;
/** Durata della dissolvenza finale (allineata alla transizione CSS di .splash). */
const EXIT_MS = 450;

type Stage = 'waiting' | 'playing' | 'leaving';

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Splash di avvio con il logo in versione scritta "CleanRep".
 * Riprende la R con il bicipite dello splash nativo Android (stessa posizione
 * centrale), la fa "flettere" come in una ripetizione e poi ne fa uscire le
 * lettere: "Clean" verso sinistra, "ep" verso destra. Un tocco salta l'intro.
 */
export default function SplashScreen({ onDone }: Props) {
  const [logoReady, setLogoReady] = useState(false);
  const [stage, setStage] = useState<Stage>('waiting');

  // Parte quando logo e font sono pronti, per non animare un'immagine vuota o
  // un font di fallback; dopo ASSET_WAIT_MS parte comunque.
  useEffect(() => {
    const timer = setTimeout(() => setStage((s) => (s === 'waiting' ? 'playing' : s)), ASSET_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!logoReady) return;
    let cancelled = false;
    void (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (!cancelled) setStage((s) => (s === 'waiting' ? 'playing' : s));
    });
    return () => {
      cancelled = true;
    };
  }, [logoReady]);

  useEffect(() => {
    if (stage === 'playing') {
      const timer = setTimeout(() => setStage('leaving'), prefersReducedMotion() ? 700 : PLAY_MS);
      return () => clearTimeout(timer);
    }
    if (stage === 'leaving') {
      const timer = setTimeout(onDone, EXIT_MS);
      return () => clearTimeout(timer);
    }
  }, [stage, onDone]);

  return (
    <div className={`splash splash--${stage}`} role="img" aria-label="CleanRep" onClick={() => setStage('leaving')}>
      <div className="splash-inner">
        <div className="splash-wordmark">
          <span className="splash-part splash-part--prefix" aria-hidden="true">
            {[...PREFIX].map((ch, i) => (
              // Le lettere di "Clean" escono dalla R: la più vicina (n) per prima.
              <span key={i} className="splash-letter" style={{ '--i': PREFIX.length - 1 - i } as CSSProperties}>
                {ch}
              </span>
            ))}
          </span>
          <img
            src={LOGO_R}
            alt=""
            className="splash-r"
            onLoad={() => setLogoReady(true)}
            onError={() => setLogoReady(true)}
          />
          <span className="splash-part splash-part--suffix" aria-hidden="true">
            {[...SUFFIX].map((ch, i) => (
              <span key={i} className="splash-letter" style={{ '--i': i } as CSSProperties}>
                {ch}
              </span>
            ))}
          </span>
        </div>
        <div className="splash-rep-bar" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
