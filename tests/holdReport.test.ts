import { describe, expect, it } from 'vitest';
import { HoldReportBuilder, type HoldReport, type Sex } from '../src/core/analysis/holdReport';
import { TrainingPipeline } from '../src/core/pipeline';
import { PLANK } from '../src/exercises/plank/definition';
import { buildSession, displaceJoint, type BodyParams, type Segment } from '../src/dev/synthetic';

const plank: BodyParams = { kind: 'plank', variant: 'FOREARM' };

function analyze(segments: Segment[], sex?: Sex): HoldReport {
  const frames = buildSession(segments, { fps: 15 });
  const durationMs = frames[frames.length - 1].timestamp + 66;
  const pipeline = new TrainingPipeline(PLANK);
  const builder = new HoldReportBuilder(PLANK, { durationMs, sex });
  for (const frame of frames) builder.add(pipeline.process(frame));
  return builder.finish();
}

describe('Report video del plank', () => {
  it('plank corretto fino alla fine: nessun cedimento, nessun difetto, screenshot di riferimento', () => {
    const r = analyze([{ durationMs: 20000, body: plank }]);
    expect(r.protocol.endReason).toBe('video_end');
    expect(r.protocol.validHoldMs).toBeGreaterThan(18000);
    expect(r.issues).toEqual([]);
    expect(r.positives).toEqual(expect.arrayContaining(['bacino', 'ginocchia', 'gomiti', 'testa e collo']));
    expect(r.snapshots.map((s) => s.key)).toEqual(['reference']);
    expect(r.summary).toContain('Esecuzione corretta');
    expect(r.summary).toContain('Non valutabili dal video');
  });

  it('bacino che cede e non viene riallineato: cedimento tecnico 3 s dopo il richiamo', () => {
    const r = analyze([
      { durationMs: 10000, body: plank },
      { durationMs: 8000, body: { ...plank, hipOffset: 0.05 } },
    ]);
    expect(r.protocol.endReason).toBe('not_restored');
    expect(r.protocol.endIssueId).toBe('hipSag');
    const warnAt = r.protocol.warnings[0].atMs;
    expect(warnAt).toBeGreaterThan(9500);
    expect(warnAt).toBeLessThan(11500);
    expect(r.protocol.endMs).toBeCloseTo(warnAt + 3000, -2);
    const sag = r.issues.find((i) => i.id === 'hipSag')!;
    expect(sag.level).toBe('critical');
    expect(sag.peakValue).toBeGreaterThan(5);
    expect(sag.snapshotKey).not.toBeNull();
    expect(r.snapshots.find((s) => s.issueId === 'hipSag')?.caption).toContain('Bacino che cede');
    expect(r.summary).toContain('non corretto entro 3 secondi');
  });

  it('deviazione corretta in tempo, poi seconda deviazione: stop alla seconda', () => {
    const r = analyze([
      { durationMs: 8000, body: plank },
      { durationMs: 1500, body: { ...plank, hipOffset: 0.05 } },
      { durationMs: 5000, body: plank },
      { durationMs: 5000, body: { ...plank, hipOffset: -0.07 } },
    ]);
    expect(r.protocol.warnings[0].restored).toBe(true);
    expect(r.protocol.endReason).toBe('second_deviation');
    expect(r.protocol.endIssueId).toBe('hipPike');
    expect(r.protocol.endMs).toBeGreaterThan(14000);
  });

  it('difetto lieve non corretto entro 3 s diventa una deviazione', () => {
    const r = analyze([
      { durationMs: 6000, body: plank },
      { durationMs: 10000, body: { ...plank, hipOffset: 0.02 } },
    ]);
    const sag = r.issues.find((i) => i.id === 'hipSag')!;
    expect(sag.escalated).toBe(true);
    expect(r.protocol.endReason).toBe('not_restored');
  });

  it('il corpo esce dalla posizione: collasso', () => {
    const r = analyze([
      { durationMs: 8000, body: plank },
      { durationMs: 4000, body: { kind: 'standing', originX: 0.6 } },
    ]);
    expect(r.protocol.endReason).toBe('collapse');
    expect(r.protocol.validHoldMs).toBeGreaterThan(6500);
    expect(r.protocol.validHoldMs).toBeLessThan(8500);
  });

  it('nessun plank nel video', () => {
    const r = analyze([{ durationMs: 5000, body: { kind: 'standing', originX: 0.6 } }]);
    expect(r.protocol.startMs).toBeNull();
    expect(r.summary).toContain('non è stata riconosciuta');
  });

  it('livello normativo: cedimento a ~15 s è insufficiente, video che finisce senza cedimento dà un "almeno"', () => {
    const failed = analyze(
      [
        { durationMs: 15000, body: plank },
        { durationMs: 6000, body: { ...plank, hipOffset: 0.05 } },
      ],
      'male',
    );
    expect(failed.ratings).toHaveLength(1);
    expect(failed.ratings[0].band.label).toBe('Insufficiente');
    expect(failed.ratings[0].atLeast).toBe(false);

    const both = analyze([{ durationMs: 10000, body: plank }]);
    expect(both.ratings.map((r) => r.sex)).toEqual(['male', 'female']);
    expect(both.ratings.every((r) => r.atLeast)).toBe(true);
  });

  it('piedi che scivolano indietro', () => {
    const r = analyze([
      {
        durationMs: 12000,
        body: plank,
        // Dopo 4 s le punte scivolano lentamente all'indietro (fino a ~15 cm).
        mutate: (pose, tMs) => {
          const dx = Math.max(0, Math.min(1, (tMs - 4000) / 6000)) * 0.055;
          let p = pose;
          for (const j of ['LEFT_ANKLE', 'RIGHT_ANKLE', 'LEFT_HEEL', 'RIGHT_HEEL', 'LEFT_FOOT_INDEX', 'RIGHT_FOOT_INDEX'] as const) {
            p = displaceJoint(p, j, dx, 0);
          }
          for (const j of ['LEFT_KNEE', 'RIGHT_KNEE'] as const) p = displaceJoint(p, j, dx * 0.5, 0);
          return p;
        },
      },
    ]);
    const feet = r.issues.find((i) => i.id === 'feetSliding');
    expect(feet).toBeDefined();
    expect(feet!.peakValue).toBeGreaterThan(6);
  });
});
