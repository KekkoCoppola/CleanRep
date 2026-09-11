/** Uscita vocale: Web Speech nel browser, TTS nativo nell'APK. */
export interface SpeechOutput {
  /** `interrupt`: interrompe la frase in corso (solo cambi di fase); altrimenti se sta parlando la frase viene scartata. */
  speak(text: string, options?: { interrupt?: boolean }): void;
  isSpeaking(): boolean;
  cancel(): void;
}
