/**
 * Regressione su sessioni REALI registrate con `?record`.
 * Ogni file tests/sessions/<nome>.<atteso>.json diventa un test; <atteso> è:
 * - correct   → deve andare in posizione e non ricevere alcuna correzione vocale
 * - standing  → non deve mai risultare "in posizione"
 * - <ruleId>  → (es. hipSag) la regola deve scattare e la correzione deve essere detta
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TrainingPipeline } from '../src/core/pipeline';
import type { RecordedSession } from '../src/dev/recorder';
import { EXERCISES } from '../src/exercises';

const dir = join(__dirname, 'sessions');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

describe.skipIf(files.length === 0)('Sessioni registrate', () => {
  for (const file of files) {
    const expectation = file.split('.').slice(-2, -1)[0];
    it(`${file}`, () => {
      const session = JSON.parse(readFileSync(join(dir, file), 'utf8')) as RecordedSession;
      const exercise = EXERCISES[session.exercise as keyof typeof EXERCISES];
      expect(exercise, `esercizio sconosciuto ${session.exercise}`).toBeDefined();
      const pipeline = new TrainingPipeline(exercise);
      const outputs = session.frames.map((f) => pipeline.process(f));
      const spoken = outputs.flatMap((o) => (o.utterance ? [o.utterance.key] : []));
      const holding = outputs.filter((o) => o.state.phase === 'HOLDING');

      if (expectation === 'standing') {
        expect(holding.length).toBe(0);
      } else if (expectation === 'correct') {
        expect(holding.length).toBeGreaterThan(0);
        expect(spoken.filter((k) => k.startsWith('issue:'))).toEqual([]);
      } else {
        expect(holding.length).toBeGreaterThan(0);
        expect(spoken).toContain(`issue:${expectation}`);
      }
    });
  }
});

it('la cartella delle sessioni esiste', () => {
  expect(Array.isArray(files)).toBe(true);
});
