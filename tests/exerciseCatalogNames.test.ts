import { describe, expect, it } from 'vitest';
import { loadExerciseCatalog } from '../src/ui/routine/catalog/exerciseCatalog';
import namesIt from '../scripts/exercise-catalog/names-it.json';

const names = namesIt as Record<string, string>;
const EXERCISE_CATALOG = await loadExerciseCatalog();

describe('nomi italiani del catalogo', () => {
  it('ogni esercizio ha un nome italiano', () => {
    const ids = EXERCISE_CATALOG.map((e) => e.id);
    expect(ids.filter((id) => !names[id]?.trim())).toEqual([]);
  });

  it('nessun nome italiano è condiviso da due esercizi', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const e of EXERCISE_CATALOG) {
      const key = e.name.toLowerCase();
      if (seen.has(key)) clashes.push(`${e.name}: ${seen.get(key)} / ${e.id}`);
      seen.set(key, e.id);
    }
    expect(clashes).toEqual([]);
  });

  it('gergo da palestra italiana: Cable Pulldown → Lat machine', () => {
    expect(EXERCISE_CATALOG.find((e) => e.nameEn === 'Cable Pulldown')?.name).toMatch(/lat machine/i);
  });
});
