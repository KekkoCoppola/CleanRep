import { describe, expect, it } from 'vitest';
import { containViewport, project } from '../src/ui/render/viewport';

describe('containViewport', () => {
  it('frame 4:3 in contenitore 4:3: riempie tutto', () => {
    const vp = containViewport(640, 480, 800, 600, false);
    expect(vp).toMatchObject({ scale: 1.25, offsetX: 0, offsetY: 0, width: 800, height: 600 });
  });

  it('frame 16:9 in contenitore 4:3: bande sopra e sotto, nessuna deformazione', () => {
    const vp = containViewport(1280, 720, 800, 600, false);
    expect(vp.width / vp.height).toBeCloseTo(16 / 9, 6);
    expect(vp.offsetX).toBe(0);
    expect(vp.offsetY).toBeCloseTo((600 - 450) / 2, 6);
  });

  it('telefono in verticale (9:16) in contenitore orizzontale: bande laterali', () => {
    const vp = containViewport(480, 854, 800, 600, false);
    expect(vp.height).toBe(600);
    expect(vp.width / vp.height).toBeCloseTo(480 / 854, 6);
    expect(vp.offsetX).toBeGreaterThan(0);
  });

  it('dimensioni nulle (video non ancora pronto): viewport vuota senza NaN', () => {
    const vp = containViewport(0, 0, 800, 600, false);
    expect(vp.scale).toBe(0);
    expect(Number.isNaN(project(vp, 0.5, 0.5).x)).toBe(false);
  });
});

describe('project', () => {
  it('mappa gli angoli del frame sugli angoli dell’area disegnata', () => {
    const vp = containViewport(1280, 720, 800, 600, false);
    expect(project(vp, 0, 0)).toEqual({ x: 0, y: vp.offsetY });
    expect(project(vp, 1, 1)).toEqual({ x: 800, y: vp.offsetY + vp.height });
  });

  it('specchiato (camera frontale): x invertita, y invariata', () => {
    const vp = containViewport(640, 480, 640, 480, true);
    expect(project(vp, 0.25, 0.4)).toEqual({ x: 480, y: 192 });
  });

  it('un punto del frame e il pixel del video disegnato coincidono (stessa trasformazione)', () => {
    // Il video è disegnato in (offsetX, offsetY, width, height): il pixel sorgente (px, py)
    // finisce in offset + p * scale. Lo scheletro deve finire nello stesso punto.
    const vp = containViewport(480, 640, 1000, 700, false);
    const px = 123;
    const py = 456;
    const expected = { x: vp.offsetX + px * vp.scale, y: vp.offsetY + py * vp.scale };
    const got = project(vp, px / 480, py / 640);
    expect(got.x).toBeCloseTo(expected.x, 6);
    expect(got.y).toBeCloseTo(expected.y, 6);
  });
});
