import type { SpeechOutput } from './types';
import { WebSpeechOutput } from './webSpeech';

export type { SpeechOutput } from './types';

let instance: SpeechOutput | null = null;

/** Uscita vocale della piattaforma corrente (singleton). */
export function getSpeechOutput(): SpeechOutput {
  instance ??= new WebSpeechOutput();
  return instance;
}
