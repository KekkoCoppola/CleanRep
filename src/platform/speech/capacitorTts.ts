import { TextToSpeech } from '@capacitor-community/text-to-speech';
import type { SpeechOutput } from './types';

/**
 * Voce nativa Android (TextToSpeech di sistema) per l'APK: nella WebView
 * `speechSynthesis` è assente o inaffidabile.
 */
export class CapacitorTtsOutput implements SpeechOutput {
  private speaking = false;
  /** Ogni nuova frase invalida la fine di quelle precedenti (stop/interruzioni). */
  private generation = 0;

  speak(text: string, options: { interrupt?: boolean } = {}): void {
    if (!text) return;
    if (this.speaking && !options.interrupt) return;
    const gen = ++this.generation;
    this.speaking = true;
    const run = async () => {
      if (options.interrupt) await TextToSpeech.stop().catch(() => undefined);
      await TextToSpeech.speak({ text, lang: 'it-IT', rate: 1.0, pitch: 1.0, volume: 1.0, category: 'playback' });
    };
    run()
      .catch((err) => console.warn('[TTS] errore sintesi vocale', err))
      .finally(() => {
        if (gen === this.generation) this.speaking = false;
      });
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  cancel(): void {
    this.generation += 1;
    this.speaking = false;
    void TextToSpeech.stop().catch(() => undefined);
  }
}
