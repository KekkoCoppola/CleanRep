import type { SpeechOutput } from './types';

/**
 * Voce via Web Speech API (browser). Sceglie esplicitamente una voce italiana
 * locale se disponibile: la voce di default del sistema può essere inglese e
 * leggere l'italiano in modo incomprensibile.
 */
export class WebSpeechOutput implements SpeechOutput {
  private voice: SpeechSynthesisVoice | null = null;
  private speaking = false;
  private readonly supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  constructor() {
    if (!this.supported) return;
    this.pickVoice();
    window.speechSynthesis.addEventListener('voiceschanged', () => this.pickVoice());
  }

  speak(text: string, options: { interrupt?: boolean } = {}): void {
    if (!this.supported || !text) return;
    const synth = window.speechSynthesis;
    if (options.interrupt) synth.cancel();
    else if (this.isSpeaking()) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'it-IT';
    if (this.voice) utterance.voice = this.voice;
    utterance.rate = 1.0;
    utterance.onend = utterance.onerror = () => {
      this.speaking = false;
    };
    this.speaking = true;
    synth.speak(utterance);
  }

  isSpeaking(): boolean {
    return this.supported && (this.speaking || window.speechSynthesis.speaking);
  }

  cancel(): void {
    if (!this.supported) return;
    this.speaking = false;
    window.speechSynthesis.cancel();
  }

  private pickVoice(): void {
    const italian = window.speechSynthesis
      .getVoices()
      .filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('it'));
    this.voice = italian.find((v) => v.localService) ?? italian[0] ?? null;
  }
}
