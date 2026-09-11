import { describe, expect, it } from 'vitest';
import type { PoseSnapshot } from '../src/types/contracts';
import { FEEDBACK, computePlankAngles, evaluatePlank } from '../src/exercises/plank/rules';
import { LocalPlankEvaluator } from '../src/exercises/plank/evaluator';
import plankCorrectJson from '../src/exercises/plank/fixtures/plank-correct.json';
import plankHipSagJson from '../src/exercises/plank/fixtures/plank-hip-sag.json';
import plankHipPikeJson from '../src/exercises/plank/fixtures/plank-hip-pike.json';

const plankCorrect = plankCorrectJson as unknown as PoseSnapshot;
const plankHipSag = plankHipSagJson as unknown as PoseSnapshot;
const plankHipPike = plankHipPikeJson as unknown as PoseSnapshot;

describe('computePlankAngles', () => {
  it('calcola una linea del corpo quasi piatta per il plank corretto', () => {
    const angles = computePlankAngles(plankCorrect.landmarks);
    expect(angles).toBeDefined();
    expect(angles!.bodyLine).toBeGreaterThan(170);
  });

  it('funziona anche con il lato lontano dalla camera occluso (ripresa di lato)', () => {
    const landmarks = structuredClone(plankCorrect.landmarks);
    for (const name of Object.keys(landmarks) as Array<keyof typeof landmarks>) {
      if (name.startsWith('RIGHT_')) landmarks[name]!.visibility = 0.15;
    }
    const angles = computePlankAngles(landmarks);
    expect(angles).toBeDefined();
    expect(angles!.bodyLine).toBeGreaterThan(170);
  });

  it('ritorna undefined solo se NESSUN lato è utilizzabile', () => {
    const landmarks = structuredClone(plankCorrect.landmarks);
    landmarks.LEFT_HIP!.visibility = 0.2;
    landmarks.RIGHT_HIP!.visibility = 0.2;
    expect(computePlankAngles(landmarks)).toBeUndefined();
  });
});

describe('evaluatePlank', () => {
  it('plank corretto: score 10, nessun joint rosso', () => {
    const result = evaluatePlank(plankCorrect);
    expect(result.isCorrect).toBe(true);
    expect(result.overallScore).toBeGreaterThanOrEqual(8);
    expect(result.jointsToColorRed).toEqual([]);
    expect(result.audioFeedback).toBe(FEEDBACK.correct);
  });

  it('bacino che cede: anche rosse e istruzione di alzare il bacino', () => {
    const result = evaluatePlank(plankHipSag);
    expect(result.isCorrect).toBe(false);
    expect(result.jointsToColorRed).toEqual(['LEFT_HIP', 'RIGHT_HIP']);
    expect(result.audioFeedback).toBe(FEEDBACK.hipSag);
    expect(result.overallScore).toBeLessThanOrEqual(6);
    expect(result.overallScore).toBeGreaterThanOrEqual(1);
  });

  it('bacino a piramide: anche rosse e istruzione di abbassare il bacino', () => {
    const result = evaluatePlank(plankHipPike);
    expect(result.isCorrect).toBe(false);
    expect(result.jointsToColorRed).toEqual(['LEFT_HIP', 'RIGHT_HIP']);
    expect(result.audioFeedback).toBe(FEEDBACK.hipPike);
  });

  it('cedimento moderato del bacino: preso dalla regola di deviazione anche con angolo ≥ 160°', () => {
    // Anche abbassate di ~0.035: bodyLine ~166° (sopra la soglia angolare)
    // ma deviazione dell'anca ~5.5% della lunghezza spalla–caviglia.
    const landmarks = structuredClone(plankCorrect.landmarks);
    landmarks.LEFT_HIP!.y = 0.585;
    landmarks.RIGHT_HIP!.y = 0.595;
    landmarks.LEFT_KNEE!.x = 0.67;
    landmarks.LEFT_KNEE!.y = 0.6225;
    landmarks.RIGHT_KNEE!.x = 0.68;
    landmarks.RIGHT_KNEE!.y = 0.6325;
    const result = evaluatePlank({ ...plankCorrect, landmarks });
    expect(result.isCorrect).toBe(false);
    expect(result.jointsToColorRed).toEqual(['LEFT_HIP', 'RIGHT_HIP']);
    expect(result.audioFeedback).toBe(FEEDBACK.hipSag);
  });

  it('plank corretto con lato destro occluso: valutato sul lato visibile', () => {
    const landmarks = structuredClone(plankCorrect.landmarks);
    for (const name of Object.keys(landmarks) as Array<keyof typeof landmarks>) {
      if (name.startsWith('RIGHT_')) landmarks[name]!.visibility = 0.15;
    }
    const result = evaluatePlank({ ...plankCorrect, landmarks });
    expect(result.isCorrect).toBe(true);
    expect(result.overallScore).toBe(10);
  });

  it('posa non rilevabile: score 0 e invito a riposizionarsi', () => {
    const snapshot: PoseSnapshot = { ...plankCorrect, landmarks: {} };
    const result = evaluatePlank(snapshot);
    expect(result.overallScore).toBe(0);
    expect(result.audioFeedback).toBe(FEEDBACK.notVisible);
  });

  it('ogni frase audio rispetta il limite di 8 parole', () => {
    for (const phrase of Object.values(FEEDBACK)) {
      expect(phrase.split(/\s+/).length).toBeLessThanOrEqual(8);
    }
  });
});

describe('LocalPlankEvaluator (debounce anti-flickering)', () => {
  it('non cambia stato prima di 500ms di persistenza', () => {
    const evaluator = new LocalPlankEvaluator(500);
    const at = (snapshot: PoseSnapshot, timestamp: number) =>
      evaluator.evaluate({ ...snapshot, timestamp });

    expect(at(plankCorrect, 0).isCorrect).toBe(true);
    // Un singolo frame di "sag" (glitch) NON deve essere committato:
    // l'EMA lo attenua e il debounce lo trattiene.
    expect(at(plankHipSag, 100).isCorrect).toBe(true);
    // Con "sag" persistente (EMA a regime + 500ms di debounce) lo stato cambia.
    let committed = at(plankHipSag, 200);
    for (let t = 300; t <= 2500; t += 100) committed = at(plankHipSag, t);
    expect(committed.isCorrect).toBe(false);
    expect(committed.jointsToColorRed).toContain('LEFT_HIP');
  });
});
