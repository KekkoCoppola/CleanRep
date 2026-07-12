/**
 * Feedback vocale via Web Speech API (locale, gratuito).
 * Throttling: pronuncia solo frasi diverse dall'ultima detta e mai
 * più di una ogni MIN_INTERVAL_MS — evita l'effetto pappagallo.
 */
const MIN_INTERVAL_MS = 4000;

let lastPhrase = '';
let lastSpokenAt = 0;

export function speak(phrase: string): void {
  if (!('speechSynthesis' in window) || !phrase) return;
  const now = Date.now();
  if (phrase === lastPhrase || now - lastSpokenAt < MIN_INTERVAL_MS) return;

  const utterance = new SpeechSynthesisUtterance(phrase);
  utterance.lang = 'it-IT';
  utterance.rate = 1.05;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);

  lastPhrase = phrase;
  lastSpokenAt = now;
}

export function resetSpeech(): void {
  lastPhrase = '';
  lastSpokenAt = 0;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}
