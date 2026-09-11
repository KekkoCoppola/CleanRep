import { Capacitor } from '@capacitor/core';
import { CapacitorTtsOutput } from './capacitorTts';
import type { SpeechOutput } from './types';
import { WebSpeechOutput } from './webSpeech';

export type { SpeechOutput } from './types';

let instance: SpeechOutput | null = null;

/** Uscita vocale della piattaforma corrente (singleton): TTS nativo nell'APK, Web Speech nel browser. */
export function getSpeechOutput(): SpeechOutput {
  instance ??= Capacitor.isNativePlatform() ? new CapacitorTtsOutput() : new WebSpeechOutput();
  return instance;
}
