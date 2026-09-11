import { describe, expect, it } from 'vitest';
import type { SessionPhase } from '../src/types/contracts';
import { Coach, type Utterance } from '../src/core/feedback/coach';
import type { ActiveIssue, HoldSessionState } from '../src/core/exercise/holdSession';
import type { PoseQuality, QualityIssue } from '../src/core/tracking/types';
import { PLANK_MESSAGES } from '../src/exercises/plank/messages.it';

const OK: PoseQuality = { score: 1, issues: [], blocking: false };

function state(phase: SessionPhase, issues: ActiveIssue[] = [], holdMs = 5000): HoldSessionState {
  return {
    phase,
    variant: 'FOREARM',
    holdMs,
    correctMs: 0,
    inPosition: phase === 'HOLDING',
    issues,
    skippedRules: [],
    result: {
      isCorrect: issues.length === 0,
      overallScore: 10,
      jointsToColorRed: [],
      audioFeedback: '',
      phase,
      confidence: 1,
      issues: [],
    },
  };
}

function issue(
  id: string,
  since: number,
  severity: ActiveIssue['severity'] = 'high',
  priority = 1,
  level: ActiveIssue['level'] = 'tolerable',
): ActiveIssue {
  return { id, severity, joints: [], priority, since, level };
}

/** Simula `ms` di tempo a 10Hz con uno stato fisso; ritorna le frasi dette. */
function tick(
  coach: Coach,
  from: number,
  ms: number,
  make: (t: number) => HoldSessionState,
  quality: PoseQuality = OK,
  speaking = false,
): Array<Utterance & { t: number }> {
  const out: Array<Utterance & { t: number }> = [];
  for (let t = from; t < from + ms; t += 100) {
    const u = coach.update(t, make(t), quality, speaking);
    if (u) out.push({ ...u, t });
  }
  return out;
}

function holdingCoach(): Coach {
  const coach = new Coach(PLANK_MESSAGES);
  coach.update(0, state('HOLDING'), OK, false); // consuma "Posizione presa"
  return coach;
}

describe('Coach', () => {
  it('un difetto tollerabile che dura meno di 2s non viene mai detto', () => {
    const coach = holdingCoach();
    const said = tick(coach, 4000, 1900, () => state('HOLDING', [issue('hipSag', 4000)]));
    expect(said).toEqual([]);
  });

  it('una deviazione critica viene richiamata subito (protocollo: avviso alla prima deviazione evidente)', () => {
    const coach = holdingCoach();
    const said = tick(coach, 4000, 1500, () => state('HOLDING', [issue('hipSag', 4000, 'high', 1, 'critical')]));
    expect(said.map((s) => s.key)).toEqual(['issue:hipSag']);
    expect(said[0].t).toBeGreaterThanOrEqual(4800);
    expect(said[0].t).toBeLessThan(5000);
  });

  it('un errore persistente viene detto dopo 2s e non ripetuto prima di 10s', () => {
    const coach = holdingCoach();
    const said = tick(coach, 4000, 13000, () => state('HOLDING', [issue('hipSag', 4000)]));
    expect(said.map((s) => s.key)).toEqual(['issue:hipSag', 'issue:hipSag']);
    expect(said[0].t).toBeGreaterThanOrEqual(6000);
    expect(said[1].t - said[0].t).toBeGreaterThanOrEqual(10000);
    // Formulazioni alternate.
    expect(said[0].text).not.toBe(said[1].text);
  });

  it('dice solo la correzione più importante', () => {
    const coach = holdingCoach();
    const said = tick(coach, 4000, 6000, () =>
      state('HOLDING', [issue('hipSag', 4000, 'high', 1), issue('kneesBent', 4000, 'medium', 2)]),
    );
    expect(said.map((s) => s.key)).toEqual(['issue:hipSag']);
  });

  it('fuori da HOLDING: mai correzioni né complimenti', () => {
    const coach = new Coach(PLANK_MESSAGES);
    const said = tick(coach, 0, 20000, () => state('SETUP', [issue('hipSag', 0)]));
    expect(said.every((s) => s.key === 'setup')).toBe(true);
  });

  it('se il TTS sta parlando aspetta', () => {
    const coach = holdingCoach();
    const said = tick(coach, 4000, 5000, () => state('HOLDING', [issue('hipSag', 4000)]), OK, true);
    expect(said).toEqual([]);
  });

  it('i cambi di fase vengono annunciati subito, anche interrompendo', () => {
    const coach = new Coach(PLANK_MESSAGES);
    const u = coach.update(0, state('HOLDING'), OK, true);
    expect(u?.key).toBe('holdStart');
    expect(u?.interrupt).toBe(true);
  });

  it('complimento quando l’errore detto viene corretto', () => {
    const coach = holdingCoach();
    const said = [
      ...tick(coach, 4000, 2500, () => state('HOLDING', [issue('hipSag', 4000)])),
      ...tick(coach, 6500, 6000, () => state('HOLDING')),
    ];
    expect(said.map((s) => s.key)).toEqual(['issue:hipSag', 'praise']);
  });

  it('posa non affidabile: solo istruzioni di inquadratura, dopo 2s', () => {
    const coach = new Coach(PLANK_MESSAGES);
    const dark: PoseQuality = { score: 0.2, issues: ['LOW_CONFIDENCE', 'LOW_LIGHT'] as QualityIssue[], blocking: true };
    const said = tick(coach, 0, 4000, () => state('SETUP'), dark);
    expect(said.map((s) => s.key)).toEqual(['quality:LOW_CONFIDENCE']);
    expect(said[0].t).toBeGreaterThanOrEqual(2000);
    expect(said[0].text).toBe(PLANK_MESSAGES.lowConfidence[0]);
  });

  it('traguardo ogni 30 secondi se la forma è corretta', () => {
    const coach = new Coach(PLANK_MESSAGES);
    const said = tick(coach, 0, 35000, (t) => state('HOLDING', [], t));
    expect(said.map((s) => s.key)).toEqual(['holdStart', 'milestone']);
    expect(said[1].text).toBe('30 secondi, continua così');
  });
});
