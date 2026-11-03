/**
 * Genera il catalogo esercizi dell'app (src/ui/routine/catalog/exercises.json)
 * da ExerciseDB V1, senza chiave API.
 *
 * - snapshot: scripts/exercise-catalog/exercisedb-snapshot.json (committato, così il
 *   catalogo si rigenera offline e gli id delle traduzioni restano stabili)
 * - nomi italiani: scripts/exercise-catalog/names-it.json ({ "<exerciseId>": "<nome>" })
 *
 * Uso: npm run catalog            (rigenera dallo snapshot)
 *      npm run catalog -- --fetch (riscarica lo snapshot, poi rigenera)
 *
 * Richiede Node >= 23.6 (type-stripping nativo dei .ts).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from './exercise-catalog/transform.ts';
import type { RawExercise } from './exercise-catalog/transform.ts';
import { LEGACY_PRESET_NOTES } from './exercise-catalog/legacyPresetNotes.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'scripts', 'exercise-catalog');
const snapshotPath = join(dataDir, 'exercisedb-snapshot.json');
const namesPath = join(dataDir, 'names-it.json');
const outPath = join(root, 'src', 'ui', 'routine', 'catalog', 'exercises.json');

const API = 'https://oss.exercisedb.dev/api/v1/exercises';
/** Massimo consentito dall'API. */
const PAGE_SIZE = 25;
/** Pausa tra pagine: richieste ravvicinate vengono rifiutate con una pagina HTML. */
const PAGE_DELAY_MS = 1200;
const MAX_RETRIES = 6;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ApiPage {
  data: RawExercise[];
  meta: { hasNextPage: boolean; nextCursor?: string };
}

async function getPage(url: string): Promise<ApiPage> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url);
    const body = await res.text();
    try {
      return JSON.parse(body) as ApiPage;
    } catch {
      console.warn(`[catalog] risposta non JSON (HTTP ${res.status}), tentativo ${attempt}/${MAX_RETRIES}`);
      await sleep(3000 * attempt);
    }
  }
  throw new Error(`[catalog] impossibile scaricare ${url}`);
}

async function fetchSnapshot(): Promise<RawExercise[]> {
  const all: RawExercise[] = [];
  let cursor: string | undefined;
  do {
    const page = await getPage(`${API}?limit=${PAGE_SIZE}${cursor ? `&after=${cursor}` : ''}`);
    for (const { exerciseId, name, gifUrl, targetMuscles, equipments } of page.data) {
      all.push({ exerciseId, name, gifUrl, targetMuscles, equipments });
    }
    cursor = page.meta.hasNextPage ? page.meta.nextCursor : undefined;
    if (cursor) await sleep(PAGE_DELAY_MS);
  } while (cursor);
  return all;
}

function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback;
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

if (process.argv.includes('--fetch')) {
  const snapshot = await fetchSnapshot();
  writeJson(snapshotPath, snapshot);
}

const raw = readJson<RawExercise[]>(snapshotPath, []);
if (raw.length === 0) throw new Error('[catalog] snapshot assente: esegui `npm run catalog -- --fetch`');

if (!existsSync(namesPath)) writeJson(namesPath, {});
const namesIt = readJson<Record<string, string>>(namesPath, {});

const catalog = buildCatalog(raw, namesIt, LEGACY_PRESET_NOTES);
writeJson(outPath, catalog);

const missing = catalog.filter((exercise) => !namesIt[exercise.id]?.trim()).length;
console.log(`[catalog] raw ${raw.length}`);
console.log(`[catalog] unique ${catalog.length}`);
console.log(`[catalog] missing italian names: ${missing}`);
