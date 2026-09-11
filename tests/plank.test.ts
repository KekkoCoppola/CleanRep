import { describe, expect, it } from 'vitest';
import type { JointName } from '../src/types/contracts';
import { TrainingPipeline, type PipelineOutput } from '../src/core/pipeline';
import { COMMON_MESSAGES } from '../src/core/feedback/messages.it';
import type { RawLandmark, RawPoseFrame } from '../src/core/tracking/types';
import { PLANK } from '../src/exercises/plank/definition';
import { PLANK_MESSAGES } from '../src/exercises/plank/messages.it';
import {
  buildSession,
  displaceJoint,
  poseFromJointMap,
  swapSides,
  type BodyParams,
  type Segment,
  type SessionOptions,
} from '../src/dev/synthetic';
import plankCorrectJson from '../src/exercises/plank/fixtures/plank-correct.json';
import plankHipSagJson from '../src/exercises/plank/fixtures/plank-hip-sag.json';
import plankHipPikeJson from '../src/exercises/plank/fixtures/plank-hip-pike.json';

const forearm: BodyParams = { kind: 'plank', variant: 'FOREARM' };
const high: BodyParams = { kind: 'plank', variant: 'HIGH' };

function run(frames: RawPoseFrame[]): PipelineOutput[] {
  const pipeline = new TrainingPipeline(PLANK);
  return frames.map((f) => pipeline.process(f));
}

function session(segments: Segment[], options?: SessionOptions): PipelineOutput[] {
  return run(buildSession(segments, options));
}

const last = (out: PipelineOutput[]) => out[out.length - 1];
const spoken = (out: PipelineOutput[]) => out.flatMap((o) => (o.utterance ? [o.utterance.key] : []));

/** Ripete una fixture statica come sequenza di frame a 30fps. */
function fixtureFrames(json: unknown, durationMs = 3000): RawPoseFrame[] {
  const landmarks = (json as { landmarks: Partial<Record<JointName, RawLandmark>> }).landmarks;
  const pose = poseFromJointMap(landmarks);
  const frames: RawPoseFrame[] = [];
  for (let t = 0; t < durationMs; t += 33) frames.push({ timestamp: t, width: 640, height: 480, poses: [pose] });
  return frames;
}

/** Ruota tutto il frame (camera inclinata) e fornisce la gravità misurata dal sensore. */
function tilt(frames: RawPoseFrame[], deg: number): RawPoseFrame[] {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return frames.map((f) => {
    const aspect = f.width / f.height;
    const cx = aspect / 2;
    return {
      ...f,
      down: { x: -sin, y: cos },
      poses: f.poses.map((p) => ({
        ...p,
        landmarks: p.landmarks.map((l) => {
          const x = l.x * aspect - cx;
          const y = l.y - 0.5;
          return { ...l, x: (x * cos - y * sin + cx) / aspect, y: x * sin + y * cos + 0.5 };
        }),
      })),
    };
  });
}

describe('Plank: fasi della sessione', () => {
  it('persona in piedi: mai in posizione, mai giudicata, nessuna correzione né complimento', () => {
    const out = session([{ durationMs: 6000, body: { kind: 'standing', originX: 0.6 } }]);
    expect(out.every((o) => o.state.phase !== 'HOLDING')).toBe(true);
    expect(out.every((o) => o.state.result.overallScore === 0)).toBe(true);
    const keys = spoken(out);
    expect(keys.some((k) => k.startsWith('issue:') || k === 'praise' || k === 'milestone')).toBe(false);
    expect(last(out).state.result.audioFeedback).toBe(PLANK_MESSAGES.setup[0]);
  });

  it('plank corretto: entra in HOLDING dopo ~0.8s, nessun errore, variante avambracci', () => {
    const out = session([{ durationMs: 4000, body: forearm }]);
    const enter = out.findIndex((o) => o.state.phase === 'HOLDING');
    expect(enter).toBeGreaterThan(20);
    expect(enter).toBeLessThan(40);
    const r = last(out).state.result;
    expect(r.isCorrect).toBe(true);
    expect(r.overallScore).toBe(10);
    expect(r.variant).toBe('FOREARM');
    expect(r.jointsToColorRed).toEqual([]);
    expect(spoken(out)).toEqual(['holdStart']);
  });

  it('alzarsi durante il plank: pausa, timer fermo', () => {
    const out = session([
      { durationMs: 3000, body: forearm },
      { durationMs: 3000, body: { kind: 'standing', originX: 0.6 } },
    ]);
    expect(last(out).state.phase).toBe('PAUSED');
    const heldAtPause = last(out).state.holdMs;
    expect(heldAtPause).toBeLessThan(3500);
    expect(spoken(out)).toContain('paused');
  });

  it('nessuno inquadrato: NO_SUBJECT', () => {
    const out = session([{ durationMs: 2000, body: null }]);
    expect(last(out).state.phase).toBe('NO_SUBJECT');
  });
});

describe('Plank: regole', () => {
  it('bacino che cede: anche rosse e correzione', () => {
    // La prima correzione arriva ~1.5s dopo l'errore e ≥3.5s dopo "Posizione presa".
    const out = session([{ durationMs: 6000, body: { ...forearm, hipOffset: 0.05 } }]);
    const r = last(out).state.result;
    expect(r.isCorrect).toBe(false);
    expect(r.issues.map((i) => i.id)).toContain('hipSag');
    expect(r.jointsToColorRed).toEqual(['LEFT_HIP', 'RIGHT_HIP']);
    expect(r.audioFeedback).toBe(PLANK_MESSAGES.issues.hipSag[0]);
    expect(r.overallScore).toBe(6);
    expect(spoken(out)).toContain('issue:hipSag');
  });

  it('bacino a piramide', () => {
    const out = session([{ durationMs: 4000, body: { ...forearm, hipOffset: -0.07 } }]);
    expect(last(out).state.result.issues.map((i) => i.id)).toEqual(['hipPike']);
  });

  it('piccole oscillazioni del bacino entro la tolleranza non sono errori', () => {
    const out = session([{ durationMs: 4000, body: { ...forearm, hipOffset: 0.015 } }]);
    expect(last(out).state.result.isCorrect).toBe(true);
  });

  it('ginocchia piegate', () => {
    const out = session([{ durationMs: 4000, body: { ...forearm, kneeBend: 50 } }]);
    const ids = last(out).state.result.issues.map((i) => i.id);
    expect(ids).toContain('kneesBent');
  });

  it('avambracci: gomiti avanti rispetto alle spalle', () => {
    const out = session([{ durationMs: 4000, body: { ...forearm, armForward: 0.1 } }]);
    expect(last(out).state.result.issues.map((i) => i.id)).toEqual(['elbowsUnderShoulders']);
  });

  it('braccia tese: riconosce la variante e non applica la regola dei gomiti', () => {
    const out = session([{ durationMs: 4000, body: high }]);
    const r = last(out).state.result;
    expect(r.variant).toBe('HIGH');
    expect(r.isCorrect).toBe(true);
  });

  it('braccia tese: mani avanti rispetto alle spalle', () => {
    const out = session([{ durationMs: 4000, body: { ...high, armForward: 0.18 } }]);
    expect(last(out).state.result.issues.map((i) => i.id)).toEqual(['handsUnderShoulders']);
  });

  it('testa che cade: difetto tollerabile', () => {
    const out = session([{ durationMs: 5000, body: { ...forearm, headDrop: 0.06 } }]);
    const issues = last(out).state.result.issues;
    expect(issues.map((i) => i.id)).toEqual(['headDrop']);
    expect(issues[0].level).toBe('tolerable');
  });

  it('collo in iperestensione (sguardo in avanti): deviazione critica', () => {
    const out = session([
      {
        durationMs: 4000,
        body: forearm,
        // Naso all'altezza dell'orecchio e davanti: sguardo all'orizzonte.
        mutate: (pose) => {
          const ear = pose.landmarks[7];
          pose.landmarks[0] = { ...pose.landmarks[0], x: ear.x - 0.04, y: ear.y - 0.005 };
          return pose;
        },
      },
    ]);
    const issue = last(out).state.result.issues.find((i) => i.id === 'headUp');
    expect(issue?.level).toBe('critical');
  });

  it('misure in cm: bacino a 10 cm sotto l’asse è critico, a 4 cm è tollerabile', () => {
    const critical = session([{ durationMs: 3000, body: { ...forearm, hipOffset: 0.05 } }]);
    const tolerable = session([{ durationMs: 3000, body: { ...forearm, hipOffset: 0.02 } }]);
    const c = last(critical).state.result.issues.find((i) => i.id === 'hipSag')!;
    const t = last(tolerable).state.result.issues.find((i) => i.id === 'hipSag')!;
    expect(c.level).toBe('critical');
    expect(c.value).toBeGreaterThan(8);
    expect(t.level).toBe('tolerable');
    expect(t.value).toBeGreaterThan(3.5);
    expect(t.value).toBeLessThan(5);
  });
});

describe('Plank: robustezza', () => {
  it('stesso corpo in 4:3, 16:9 e verticale 9:16: stesso giudizio (geometria isotropa)', () => {
    for (const [width, height, originX, size] of [
      [640, 480, 0.45, 1],
      [1280, 720, 0.5, 1],
      [480, 854, 0.1, 0.7],
    ] as const) {
      const ok = session([{ durationMs: 3000, body: { ...forearm, originX, size } }], { width, height });
      expect(last(ok).state.result.isCorrect, `${width}x${height}`).toBe(true);
      const sag = session([{ durationMs: 3000, body: { ...forearm, originX, size, hipOffset: 0.05 * size } }], {
        width,
        height,
      });
      expect(last(sag).state.result.issues.map((i) => i.id), `${width}x${height}`).toContain('hipSag');
    }
  });

  it('camera inclinata di 15°: con la gravità del sensore il plank corretto resta corretto', () => {
    const out = run(tilt(buildSession([{ durationMs: 3000, body: forearm }]), 15));
    expect(last(out).state.phase).toBe('HOLDING');
    expect(last(out).state.result.isCorrect).toBe(true);
  });

  it('glitch del modello (gambe scambiate, gomito che salta) non generano correzioni', () => {
    const out = session([
      {
        durationMs: 8000,
        body: forearm,
        mutate: (pose, tMs) => {
          let p = Math.floor(tMs / 400) % 3 === 1 ? swapSides(pose) : pose;
          if (Math.floor(tMs / 700) % 4 === 2) p = displaceJoint(p, 'LEFT_ELBOW', 0.15, -0.2);
          return p;
        },
      },
    ]);
    expect(spoken(out).filter((k) => k.startsWith('issue:'))).toEqual([]);
    expect(last(out).state.result.isCorrect).toBe(true);
  });

  it('lato destro verso la camera: stesso giudizio', () => {
    const out = session([{ durationMs: 4000, body: { ...forearm, nearSide: 'RIGHT', hipOffset: 0.05 } }]);
    expect(last(out).state.result.issues.map((i) => i.id)).toContain('hipSag');
  });

  it('fixture storiche: corretto, bacino basso, bacino alto', () => {
    expect(last(run(fixtureFrames(plankCorrectJson))).state.result.isCorrect).toBe(true);
    expect(last(run(fixtureFrames(plankHipSagJson))).state.result.issues.map((i) => i.id)).toContain('hipSag');
    expect(last(run(fixtureFrames(plankHipPikeJson))).state.result.issues.map((i) => i.id)).toContain('hipPike');
  });
});

describe('Frasi', () => {
  it('ogni frase rispetta il limite di 8 parole', () => {
    const phrases = [
      ...PLANK_MESSAGES.setup,
      ...PLANK_MESSAGES.lowConfidence,
      ...PLANK_MESSAGES.good,
      ...Object.values(PLANK_MESSAGES.issues).flat(),
      ...Object.values(COMMON_MESSAGES.quality).flat(),
      ...COMMON_MESSAGES.holdStart,
      ...COMMON_MESSAGES.paused,
      ...COMMON_MESSAGES.praise,
      COMMON_MESSAGES.milestone(30),
    ];
    for (const phrase of phrases) expect(phrase.split(/\s+/).length, phrase).toBeLessThanOrEqual(8);
  });
});
