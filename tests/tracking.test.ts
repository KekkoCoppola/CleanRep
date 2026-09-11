import { describe, expect, it } from 'vitest';
import type { JointName } from '../src/types/contracts';
import { OneEuroFilter, STATIC_HOLD_FILTER } from '../src/core/filters/oneEuro';
import { PoseStabilizer } from '../src/core/tracking/poseStabilizer';
import type { RawPose, RawPoseFrame, StablePose } from '../src/core/tracking/types';
import {
  buildSession,
  displaceJoint,
  gaussian,
  mulberry32,
  occlude,
  swapSides,
  syntheticPose,
  type BodyParams,
} from '../src/dev/synthetic';

const plank: BodyParams = { kind: 'plank', variant: 'FOREARM' };

function run(frames: RawPoseFrame[]): StablePose[] {
  const stabilizer = new PoseStabilizer();
  return frames.map((f) => stabilizer.process(f));
}

function joint(pose: StablePose, name: JointName) {
  return pose.joints[name];
}

function std(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

/** Gambe divaricate nell'immagine: rende lo scambio sinistra/destra visibile e misurabile. */
function spreadLegs(pose: RawPose): RawPose {
  let out = displaceJoint(pose, 'RIGHT_KNEE', 0.06, 0.02);
  out = displaceJoint(out, 'RIGHT_ANKLE', 0.08, 0.02);
  out = displaceJoint(out, 'RIGHT_HEEL', 0.08, 0.02);
  return displaceJoint(out, 'RIGHT_FOOT_INDEX', 0.08, 0.02);
}

describe('OneEuroFilter', () => {
  it('riduce il tremolio di un punto fermo di almeno il 70%', () => {
    const rng = mulberry32(7);
    const filter = new OneEuroFilter(STATIC_HOLD_FILTER);
    const raw: number[] = [];
    const out: number[] = [];
    for (let i = 0; i < 300; i++) {
      const v = 0.5 + gaussian(rng) * 0.005;
      raw.push(v);
      out.push(filter.filter(v, (i * 1000) / 30));
    }
    // Ignora il transitorio iniziale.
    expect(std(out.slice(30))).toBeLessThan(std(raw.slice(30)) * 0.3);
  });

  it('segue un movimento vero senza restare indietro a regime', () => {
    const filter = new OneEuroFilter(STATIC_HOLD_FILTER);
    let v = 0;
    for (let i = 0; i < 90; i++) v = filter.filter(i < 30 ? 0.2 : 0.5, (i * 1000) / 30);
    expect(v).toBeCloseTo(0.5, 2);
  });
});

describe('PoseStabilizer', () => {
  it('scheletro fermo: jitter ridotto rispetto ai landmark grezzi', () => {
    const frames = buildSession([{ durationMs: 4000, body: plank, noise: 0.006 }]);
    const out = run(frames);
    const rawY = frames.slice(30).map((f) => f.poses[0].landmarks[23].y); // LEFT_HIP
    const stableY = out.slice(30).map((p) => joint(p, 'LEFT_HIP')!.y);
    expect(std(stableY)).toBeLessThan(std(rawY) * 0.35);
  });

  it('corregge lo scambio sinistra/destra delle gambe', () => {
    const frames = buildSession([
      {
        durationMs: 3000,
        body: plank,
        noise: 0.002,
        mutate: (pose, tMs) => {
          const spread = spreadLegs(pose);
          // Dal secondo 1 in poi MediaPipe "scambia" le gambe un frame ogni tre.
          return tMs > 1000 && Math.round(tMs / 33) % 3 === 0 ? swapSides(spread) : spread;
        },
      },
    ]);
    const out = run(frames);
    const swapFrames = out.filter((p) => p.corrections.swaps.includes('legs'));
    expect(swapFrames.length).toBeGreaterThan(5);
    // Il ginocchio sinistro stabilizzato non salta mai sulla posizione del destro.
    for (let i = 31; i < out.length; i++) {
      const a = joint(out[i - 1], 'LEFT_KNEE')!;
      const b = joint(out[i], 'LEFT_KNEE')!;
      expect(Math.abs(b.x - a.x)).toBeLessThan(0.02);
    }
  });

  it('un gomito che salta per un frame su un oggetto viene rifiutato', () => {
    const frames = buildSession([
      {
        durationMs: 2000,
        body: plank,
        noise: 0.002,
        mutate: (pose, tMs) => (tMs > 1000 && tMs < 1040 ? displaceJoint(pose, 'LEFT_ELBOW', 0.15, -0.2) : pose),
      },
    ]);
    const out = run(frames);
    const glitchIndex = out.findIndex((p) => p.corrections.rejected.includes('LEFT_ELBOW'));
    expect(glitchIndex).toBeGreaterThan(0);
    const before = joint(out[glitchIndex - 1], 'LEFT_ELBOW')!;
    const during = joint(out[glitchIndex], 'LEFT_ELBOW')!;
    expect(Math.hypot(during.x - before.x, during.y - before.y)).toBeLessThan(0.01);
  });

  it('uno spostamento vero e persistente viene accettato (nessun arto bloccato per sempre)', () => {
    const frames = buildSession([
      {
        durationMs: 2500,
        body: plank,
        noise: 0.002,
        mutate: (pose, tMs) => (tMs > 1000 ? displaceJoint(pose, 'LEFT_WRIST', 0.12, 0) : pose),
      },
    ]);
    const out = run(frames);
    const last = joint(out[out.length - 1], 'LEFT_WRIST')!;
    const target = frames[frames.length - 1].poses[0].landmarks[15];
    expect(Math.abs(last.x - target.x)).toBeLessThan(0.01);
  });

  it('una seconda persona che entra non ruba lo scheletro', () => {
    const frames = buildSession([
      { durationMs: 1500, body: plank },
      {
        durationMs: 3000,
        body: plank,
        // Più grande e ben visibile: al primo aggancio vincerebbe lei.
        extra: (tMs) => [syntheticPose({ kind: 'standing', originX: 1.2 - tMs / 6000, size: 1.2 })],
      },
    ]);
    const out = run(frames);
    const id = out[10].subjectId;
    expect(id).not.toBeNull();
    for (const p of out.slice(10)) expect(p.subjectId).toBe(id);
    const hip = joint(out[out.length - 1], 'LEFT_HIP')!;
    const expectedHip = syntheticPose(plank).landmarks[23];
    expect(Math.abs(hip.y - expectedHip.y)).toBeLessThan(0.02);
    expect(out[out.length - 1].otherBoxes.length).toBe(1);
  });

  it("un oggetto scambiato per posa quando non c'è nessuno non diventa un soggetto agganciato", () => {
    const ghost = occlude(syntheticPose({ kind: 'standing', size: 0.3, originX: 1.1 }), [], 0.1);
    for (const l of ghost.landmarks) l.visibility = Math.min(l.visibility, 0.2);
    const frames = buildSession([
      { durationMs: 1500, body: plank },
      { durationMs: 2000, body: plank, extra: () => [ghost] },
    ]);
    const out = run(frames);
    const id = out[10].subjectId;
    for (const p of out.slice(10)) expect(p.subjectId).toBe(id);
  });

  it('giunto occluso: tenuto per poco, poi dichiarato perso', () => {
    const frames = buildSession([
      { durationMs: 1000, body: plank, noise: 0.002 },
      { durationMs: 1000, body: plank, noise: 0.002, mutate: (pose) => occlude(pose, ['LEFT_KNEE']) },
    ]);
    const out = run(frames);
    const shortly = out[30 + 5]; // ~170ms dopo l'occlusione
    const later = out[30 + 20]; // ~670ms dopo
    expect(joint(shortly, 'LEFT_KNEE')!.state).toBe('held');
    expect(joint(later, 'LEFT_KNEE')!.state).toBe('lost');
  });

  it('coerenza anatomica: un avambraccio che si allunga del 60% viene scartato', () => {
    const frames = buildSession([
      { durationMs: 1500, body: plank, noise: 0.001 },
      { durationMs: 100, body: plank, noise: 0.001, mutate: (pose) => displaceJoint(pose, 'LEFT_WRIST', -0.06, 0) },
    ]);
    const out = run(frames);
    expect(out.slice(45).some((p) => p.corrections.rejected.includes('LEFT_WRIST'))).toBe(true);
  });

  it('riconosce il lato rivolto alla camera', () => {
    const left = run(buildSession([{ durationMs: 500, body: { ...plank, nearSide: 'LEFT' } }]));
    const right = run(buildSession([{ durationMs: 500, body: { ...plank, nearSide: 'RIGHT' } }]));
    expect(left[left.length - 1].nearSide).toBe('LEFT');
    expect(right[right.length - 1].nearSide).toBe('RIGHT');
  });

  it('qualità: nessuna persona, persona tagliata, poca luce', () => {
    const none = run(buildSession([{ durationMs: 300, body: null }]));
    expect(none[none.length - 1].quality.issues).toContain('NO_PERSON');
    expect(none[none.length - 1].quality.blocking).toBe(true);

    const clipped = run(buildSession([{ durationMs: 300, body: { ...plank, originX: 1.0 } }]));
    expect(clipped[clipped.length - 1].quality.issues).toContain('CLIPPED');

    const dark = run(buildSession([{ durationMs: 300, body: plank, brightness: 0.05 }]));
    expect(dark[dark.length - 1].quality.issues).toContain('LOW_LIGHT');

    const ok = run(buildSession([{ durationMs: 300, body: plank }]));
    expect(ok[ok.length - 1].quality.blocking).toBe(false);
  });
});
