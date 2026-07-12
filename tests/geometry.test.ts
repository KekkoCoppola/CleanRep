import { describe, expect, it } from 'vitest';
import {
  angleBetween3Points,
  distance,
  midpoint,
  verticalDeviationFromLine,
} from '../src/engine/geometry';

describe('angleBetween3Points', () => {
  it('ritorna 90° per un angolo retto', () => {
    expect(angleBetween3Points({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90, 5);
  });

  it('ritorna 180° per tre punti collineari', () => {
    expect(
      angleBetween3Points({ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }),
    ).toBeCloseTo(180, 5);
  });

  it('ritorna 0 se due punti coincidono (vettore nullo)', () => {
    expect(angleBetween3Points({ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 2 })).toBe(0);
  });
});

describe('verticalDeviationFromLine', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 1, y: 0 };

  it('è positiva per un punto sotto la linea (y maggiore)', () => {
    expect(verticalDeviationFromLine({ x: 0.5, y: 0.2 }, a, b)).toBeGreaterThan(0);
  });

  it('è negativa per un punto sopra la linea (y minore)', () => {
    expect(verticalDeviationFromLine({ x: 0.5, y: -0.2 }, a, b)).toBeLessThan(0);
  });

  it('è ~0 per un punto sulla linea', () => {
    expect(verticalDeviationFromLine({ x: 0.7, y: 0 }, a, b)).toBeCloseTo(0, 8);
  });
});

describe('midpoint / distance', () => {
  it('midpoint calcola il punto medio', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 2, y: 4 })).toEqual({ x: 1, y: 2 });
  });

  it('distance calcola la distanza euclidea', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});
