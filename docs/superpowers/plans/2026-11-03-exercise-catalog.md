# Catalogo esercizi ExerciseDB — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire gli 8 `PRESET_EXERCISES` scritti a mano con il catalogo ExerciseDB V1 (~1.284 esercizi unici), con nomi italiani da palestra e GIF "in negativo" nella schermata di personalizzazione.

**Architecture:** Uno script Node (`scripts/build-exercise-catalog.ts`, eseguito con il type-stripping nativo di Node ≥ 23.6) scarica ExerciseDB in uno snapshot committato e genera `src/ui/routine/catalog/exercises.json` con logica pura testata (`scripts/exercise-catalog/transform.ts`). L'app importa il JSON staticamente; ricerca e risoluzione dei campi del form sono funzioni pure; la UI esistente di `RoutineScreen` cambia solo nella sorgente dati, nei placeholder e nell'illustrazione.

**Tech Stack:** React 18 · TypeScript 5.6 strict · Vite 6 · Vitest 2 · Node 24 (script).

**Spec:** `docs/superpowers/specs/2026-11-03-exercise-catalog-design.md`

## Global Constraints

- Fonte unica: ExerciseDB V1 `https://oss.exercisedb.dev/api/v1/exercises?limit=25&after=<nextCursor>`; 25 per pagina massimo; pausa ≥ 1200 ms tra pagine e retry con backoff quando la risposta non è JSON.
- Le GIF restano remote (`https://static.exercisedb.dev/media/<id>.gif`): niente download, niente canvas (il server non manda CORS).
- Illustrazione: esattamente `filter: invert(1) hue-rotate(180deg); mix-blend-mode: screen;`.
- Placeholder: sets `3`, reps `8-12`, note `es. RPE 8, pausa 90s...` (o la nota italiana dell'ex preset).
- Nomi italiani: gergo delle palestre italiane, inglese mantenuto dove è l'uso comune; mai traduzioni letterali goffe.
- Niente istruzioni passo-passo nel catalogo. Nessuna migrazione delle routine salvate (`cleanrep_routines_v1`).
- Commit sul branch `feat/exercise-catalog` (upstream non impostato: non fare push senza richiesta).

## Review Focus

1. "dumbbell lying rear lateral raise" contiene sia "rear" sia "lateral": deve andare su `traps`, non su `side-delts` → test in Task 1.
2. Ricerca con maiuscole, spazi extra, accenti o in inglese su un esercizio con nome italiano ("  LAT MACHINE ", "pulldown", "àlzate" ≈ "alzate") → deve trovarlo → test in Task 3.
3. Campi del form vuoti, solo spazi, sets `"0"`/`"abc"` → sets 3, reps `8-12`; la nota esempio generica non viene mai salvata → test in Task 3.
4. GIF che non si carica (offline): l'illustrazione sparisce ma il form resta usabile; scegliendo un altro esercizio la nuova GIF riappare → verifica manuale in Task 4.
5. Routine salvate prima della modifica (id tipo `barbell-bench-press`) e esercizi cardio senza muscoli: lista routine e card volume si mostrano senza errori → test `mapMuscles` in Task 1 + verifica manuale in Task 4.

---

### Task 1: Logica pura di trasformazione del catalogo

**Files:**
- Modify: `src/ui/routine/RoutineTypes.ts` (aggiungi `CatalogExercise`; non toccare ancora `PRESET_EXERCISES`)
- Create: `scripts/exercise-catalog/transform.ts`
- Create: `scripts/exercise-catalog/legacyPresetNotes.ts`
- Test: `tests/exerciseCatalogTransform.test.ts`

**Interfaces:**
- Produces (in `RoutineTypes.ts`):
  ```ts
  export interface CatalogExercise {
    id: string;              // exerciseId ExerciseDB
    name: string;            // italiano (fallback: nameEn)
    nameEn: string;          // display case
    gifUrl: string;
    primaryMuscles: MuscleTarget[];
    equipment: string[];
    notesPlaceholder?: string;
  }
  ```
- Produces (in `transform.ts`, tutti `export`):
  - `interface RawExercise { exerciseId: string; name: string; gifUrl: string; targetMuscles: string[]; equipments: string[] }`
  - `normalizeName(name: string): string` — minuscole, ogni sequenza non `[a-z0-9]` → uno spazio, trim.
  - `mapMuscles(targetMuscles: string[], nameEn: string): MuscleTarget[]` — tabella della spec §3, senza duplicati, ordine di prima comparsa.
  - `toDisplayCase(name: string): string` — se il nome è tutto minuscolo, maiuscola dopo inizio/spazio/`-`/`(`; altrimenti invariato.
  - `dedupeByName(raw: RawExercise[]): RawExercise[]` — tiene la prima occorrenza per `normalizeName`.
  - `buildCatalog(raw: RawExercise[], namesIt: Record<string, string>, legacyNotes: Record<string, string>): CatalogExercise[]` — dedupe → mappa → ordina per `name` con `localeCompare(…, 'it')`.
- Produces (in `legacyPresetNotes.ts`): `export const LEGACY_PRESET_NOTES: Record<string, string>` con chiave = `normalizeName(nameEn)`.
- Gli import tra file usano estensione `.ts` e `import type` per i tipi (richiesto dal type-stripping di Node).

- [ ] **Step 1: Scrivi i test che falliscono** in `tests/exerciseCatalogTransform.test.ts`:

```ts
expect(normalizeName('Dumbbell Incline Bench-Press (V. 2)')).toBe('dumbbell incline bench press v 2');
expect(mapMuscles(['deltoids'], 'dumbbell lying rear lateral raise')).toEqual(['traps']);
expect(mapMuscles(['deltoids'], 'cable face pull')).toEqual(['traps']);
expect(mapMuscles(['deltoids'], 'dumbbell lateral raise')).toEqual(['side-delts']);
expect(mapMuscles(['deltoids'], 'barbell upright row')).toEqual(['side-delts']);
expect(mapMuscles(['deltoids'], 'dumbbell shoulder press')).toEqual(['front-delts']);
expect(mapMuscles(['pectorals', 'serratus anterior'], 'x')).toEqual(['chest']);
expect(mapMuscles(['forearms'], 'x')).toEqual(['biceps']);
expect(mapMuscles(['erector spinae'], 'x')).toEqual(['abs']);
expect(mapMuscles(['upper back', 'levator scapulae'], 'x')).toEqual(['traps']);
expect(mapMuscles(['glutes', 'calves', 'adductors'], 'x')).toEqual(['legs']);
expect(mapMuscles(['cardiovascular system'], 'x')).toEqual([]);
expect(toDisplayCase('cable pushdown (with rope attachment)')).toBe('Cable Pushdown (With Rope Attachment)');
expect(toDisplayCase('EZ-Bar Curl')).toBe('EZ-Bar Curl');
// dedupe: 'Dumbbell Incline Bench Press' (B3Rxp6L) e 'dumbbell incline bench press' (ns0SIbU) → resta solo B3Rxp6L
// buildCatalog: usa namesIt[id] se presente, altrimenti toDisplayCase(nameEn);
//   notesPlaceholder = LEGACY_PRESET_NOTES[normalizeName(nameEn)] (assente → campo omesso);
//   output ordinato per name in italiano.
```

- [ ] **Step 2:** `npx vitest run tests/exerciseCatalogTransform.test.ts` → FAIL (moduli inesistenti).
- [ ] **Step 3: Implementa `transform.ts`, `legacyPresetNotes.ts` e `CatalogExercise`.** Ordine delle regole sui deltoidi: prima `/\brear\b|reverse fl(y|ies)|face pull/` → `traps`, poi `/lateral|\bside\b|upright row/` → `side-delts`, altrimenti `front-delts`. `LEGACY_PRESET_NOTES` (chiavi normalizzate → nota italiana dagli attuali preset):
  - `barbell bench press` → `Piedi saldi, arco fisiologico, fermo al petto 1s`
  - `barbell standing wide military press` → `Glutei e addome contratti, traiettoria verticale`
  - `dumbbell incline bench press` → `Inclinazione panca 30°, focus porzione clavicolare`
  - `dumbbell lateral raise` → `Gomiti leggermente flessi, nessun slancio col busto`
  - `dumbbell incline fly` → `Apertura controllata, enfasi sullo stretch pettorale`
  - `cable pushdown` → `Gomiti serrati ai fianchi, contrazione di picco`
  - `barbell full squat` → `Accosciata sotto al parallelo, petto aperto`
  - `cable pulldown` → `Tirata al petto, deprimere le scapole`
- [ ] **Step 4:** `npx vitest run tests/exerciseCatalogTransform.test.ts` → PASS; `npm run typecheck` → nessun errore.
- [ ] **Step 5: Commit** — `feat(catalog): pure transform for ExerciseDB catalog`.

### Task 2: Script di download e generazione del catalogo

**Files:**
- Create: `scripts/build-exercise-catalog.ts`
- Create (generati, committati): `scripts/exercise-catalog/exercisedb-snapshot.json`, `scripts/exercise-catalog/names-it.json` (inizialmente `{}`), `src/ui/routine/catalog/exercises.json`
- Modify: `package.json` (script `"catalog": "node scripts/build-exercise-catalog.ts"`)

**Interfaces:**
- Consumes: `RawExercise`, `buildCatalog` (Task 1), `LEGACY_PRESET_NOTES`.
- Produces: `src/ui/routine/catalog/exercises.json` = `CatalogExercise[]`; snapshot = `RawExercise[]` (solo i 5 campi, ordine di download).
- CLI: `npm run catalog -- --fetch` scarica e riscrive lo snapshot, poi genera; `npm run catalog` rigenera solo dal snapshot + `names-it.json` (offline). Stampa: totali grezzi, unici, esercizi senza nome italiano.

- [ ] **Step 1:** Implementa lo script (paginazione con `after`, pausa 1200 ms, fino a 6 retry con attesa crescente se il body non è JSON; JSON scritto con indentazione 2 e newline finale).
- [ ] **Step 2:** `npm run catalog -- --fetch` → stampa `raw 1500`, `unique 1284` (±qualche unità se ExerciseDB è cambiato), `missing italian names: <unique>`.
- [ ] **Step 3: Verifica a mano** su `exercises.json`: l'esercizio con `nameEn` `"Dumbbell Incline Bench Press"` ha `primaryMuscles: ["chest"]` e `notesPlaceholder` della panca inclinata; `"Dumbbell Lying Rear Lateral Raise"` ha `["traps"]`.
- [ ] **Step 4:** `npm test` e `npm run typecheck` → verdi.
- [ ] **Step 5: Commit** — `feat(catalog): ExerciseDB snapshot and catalog generator`.

### Task 3: Catalogo a runtime, ricerca e risoluzione del form

**Files:**
- Create: `src/ui/routine/catalog/exerciseCatalog.ts`
- Create: `src/ui/routine/catalog/exerciseForm.ts`
- Modify: `src/ui/routine/RoutineTypes.ts` (aggiungi `DEFAULT_SETS = 3`, `DEFAULT_REPS = '8-12'`, `DEFAULT_NOTES_PLACEHOLDER = 'es. RPE 8, pausa 90s...'`)
- Test: `tests/exerciseCatalog.test.ts`

**Interfaces:**
- Consumes: `exercises.json` (Task 2), `CatalogExercise`.
- Produces:
  - `export const EXERCISE_CATALOG: CatalogExercise[]` (import statico del JSON).
  - `export function searchExercises(catalog: CatalogExercise[], query: string): CatalogExercise[]` — query e nomi normalizzati con `toLowerCase()`, `normalize('NFD')` senza segni diacritici, spazi multipli compressi, trim; query vuota → catalogo intero; corrisponde se è sottostringa di `name` **o** di `nameEn`.
  - `export interface ExerciseFormInput { sets: string; reps: string; notes: string }`
  - `export function resolveExerciseForm(input: ExerciseFormInput, exercise: Pick<CatalogExercise, 'notesPlaceholder'>): { sets: number; reps: string; notes: string }` — sets: `parseInt` ≥ 1 altrimenti `DEFAULT_SETS`; reps: trim o `DEFAULT_REPS`; notes: trim, se vuoto `exercise.notesPlaceholder ?? ''`.

- [ ] **Step 1: Test che falliscono:**

```ts
// catalogo reale
expect(EXERCISE_CATALOG.length).toBeGreaterThan(1200);
expect(new Set(EXERCISE_CATALOG.map((e) => e.id)).size).toBe(EXERCISE_CATALOG.length);
expect(EXERCISE_CATALOG.every((e) => /^https:\/\/static\.exercisedb\.dev\/media\/\w+\.gif$/.test(e.gifUrl))).toBe(true);
// ricerca su fixture sintetica [{ name: 'Alzate laterali con manubri', nameEn: 'Dumbbell Lateral Raise', … }]
expect(searchExercises(f, '  ALZATE   laterali ')).toHaveLength(1);
expect(searchExercises(f, 'àlzate')).toHaveLength(1);
expect(searchExercises(f, 'lateral raise')).toHaveLength(1);
expect(searchExercises(f, '')).toBe(f);
expect(searchExercises(f, 'squat')).toEqual([]);
// form
expect(resolveExerciseForm({ sets: '', reps: '  ', notes: '' }, {})).toEqual({ sets: 3, reps: '8-12', notes: '' });
expect(resolveExerciseForm({ sets: '0', reps: '', notes: '' }, {}).sets).toBe(3);
expect(resolveExerciseForm({ sets: 'abc', reps: '', notes: '' }, {}).sets).toBe(3);
expect(resolveExerciseForm({ sets: '5', reps: '10', notes: ' RPE 8 ' }, {})).toEqual({ sets: 5, reps: '10', notes: 'RPE 8' });
expect(resolveExerciseForm({ sets: '', reps: '', notes: '' }, { notesPlaceholder: 'Fermo al petto' }).notes).toBe('Fermo al petto');
```

- [ ] **Step 2:** `npx vitest run tests/exerciseCatalog.test.ts` → FAIL.
- [ ] **Step 3:** Implementa i due moduli e le costanti.
- [ ] **Step 4:** `npx vitest run tests/exerciseCatalog.test.ts` → PASS; `npm run typecheck` → verde.
- [ ] **Step 5: Commit** — `feat(catalog): runtime catalog, search and form defaults`.

### Task 4: Collegamento alla UI delle routine

**Files:**
- Modify: `src/ui/routine/RoutineTypes.ts` (rimuovi `PresetExercise` e `PRESET_EXERCISES`)
- Modify: `src/ui/routine/RoutineScreen.tsx` (righe ~3-5, 37-42, 91-97, 116-140, 191, 393-500)
- Modify: `src/ui/routine/AnatomyGraphic.tsx:111-127`
- Modify: `src/ui/routine/routine.css:612-621`

**Interfaces:**
- Consumes: `EXERCISE_CATALOG`, `searchExercises`, `resolveExerciseForm`, `DEFAULT_*` (Task 3).
- Produces: `ExerciseCustomizationGraphic({ gifUrl, alt, className }: { gifUrl: string; alt: string; className?: string })`.

- [ ] **Step 1: `AnatomyGraphic.tsx`** — `ExerciseCustomizationGraphic` mostra `<img src={gifUrl} alt={alt} className="exercise-gif-negative">`; su `onError` restituisce `null`. Il chiamante passa `key={gifUrl}` per azzerare l'errore quando cambia esercizio.
- [ ] **Step 2: `routine.css`** — sostituisci `.exercise-incline-graphic-img` con `.exercise-gif-negative { max-height: 175px; width: auto; object-fit: contain; filter: invert(1) hue-rotate(180deg); mix-blend-mode: screen; animation: routineFadeIn 0.35s ease-out; }`.
- [ ] **Step 3: `RoutineScreen.tsx`**
  - `selectedExercise: CatalogExercise | null` (iniziale `null`); `filteredExercises = useMemo(() => searchExercises(EXERCISE_CATALOG, searchQuery), [searchQuery])`.
  - La lista mostra `exercise.name`; il titolo dell'header usa `selectedExercise?.name ?? 'Personalizza'` (togli il caso speciale `'Incline'`).
  - Selezione: sets/reps/notes impostati a `''`.
  - Input: `value` vuoto, `placeholder` = `String(DEFAULT_SETS)`, `DEFAULT_REPS`, `selectedExercise.notesPlaceholder ?? DEFAULT_NOTES_PLACEHOLDER`; rimuovi `required` da sets e reps.
  - Conferma: `resolveExerciseForm(...)`; `RoutineExercise` con `exerciseId: selectedExercise.id`, `name: selectedExercise.name`, `primaryMuscles: selectedExercise.primaryMuscles`.
  - Illustrazione: `<ExerciseCustomizationGraphic key={selectedExercise.gifUrl} gifUrl={selectedExercise.gifUrl} alt={selectedExercise.name} />`.
- [ ] **Step 4:** `npm run typecheck` e `npm test` → verdi.
- [ ] **Step 5: Verifica manuale** (`npm run dev`, browser a 375×812):
  - "Scegli l'esercizio": la ricerca filtra da ~1.284 voci senza scatti evidenti.
  - Personalizzazione: GIF in negativo e placeholder visibili; "Aggiungi" con campi vuoti salva 3 sets × 8-12.
  - Offline (DevTools → Offline): l'illustrazione sparisce e il form funziona; tornati online, un altro esercizio mostra la GIF.
  - Una routine salvata prima della modifica si apre senza errori; aggiungere un esercizio cardio non rompe le card volume.
- [ ] **Step 6: Commit** — `feat(routine): exercise picker backed by ExerciseDB catalog`.

### Task 5: Nomi italiani con agent di ricerca

Indipendente dai Task 3-4 (tocca solo `names-it.json` ed `exercises.json` rigenerato): può girare in parallelo a loro dopo il Task 2.

**Files:**
- Create: `scripts/exercise-catalog/glossary-it.md`
- Modify: `scripts/exercise-catalog/names-it.json`, `src/ui/routine/catalog/exercises.json` (rigenerato)
- Test: `tests/exerciseCatalogNames.test.ts`

**Interfaces:**
- Consumes: `exercises.json` (id + `nameEn`).
- Produces: `names-it.json` = `{ "<exerciseId>": "<nome italiano>" }` per ogni id del catalogo.

- [ ] **Step 1: Glossario.** Un agent con ricerca web scrive `glossary-it.md`: termini ricorrenti (attrezzi, impugnature, posizioni, macchine) → resa in uso nelle palestre italiane, con la regola "inglese se è l'uso comune" ed esempi ancorati: `lat pulldown` → `Lat machine`, `chest press` / `leg extension` restano invariati.
- [ ] **Step 2: Batch.** Dividi gli id in 8 file di ~160 voci (`{id, nameEn}`) nello scratchpad. Lancia 8 agent in parallelo; ognuno applica il glossario, cerca online solo i casi dubbi e restituisce un JSON `id → nome`. Il controller unisce i risultati in `names-it.json` (chiavi ordinate).
- [ ] **Step 3: Test che fallisce** in `tests/exerciseCatalogNames.test.ts`:

```ts
const ids = EXERCISE_CATALOG.map((e) => e.id);
expect(ids.filter((id) => !namesIt[id]?.trim())).toEqual([]);
expect(EXERCISE_CATALOG.find((e) => e.nameEn === 'Cable Pulldown')?.name).toMatch(/lat machine/i);
```

- [ ] **Step 4:** `npm run catalog` (offline, dal snapshot) → `missing italian names: 0`; `npx vitest run tests/exerciseCatalogNames.test.ts` → PASS.
- [ ] **Step 5: Revisione a campione.** Leggi 40 nomi a caso e correggi in `names-it.json` i calchi letterali; rigenera.
- [ ] **Step 6: Commit** — `feat(catalog): Italian gym names for ExerciseDB exercises`.
