# Catalogo esercizi da ExerciseDB — design

Data: 2026-11-03 · Branch: `feat/exercise-catalog` (da `origin/feat/robust-tracking`)

## Intento

Sostituire gli 8 esercizi scritti a mano in `PRESET_EXERCISES`
(`src/ui/routine/RoutineTypes.ts`) con il catalogo completo di ExerciseDB V1
(~1.500 esercizi), con nomi in italiano da palestra e un'illustrazione animata nello
stile del mockup. Le schermate restano quelle dei mockup: "Scegli l'esercizio"
(ricerca + lista) e "Personalizzazione esercizio" (illustrazione, sets, reps, note).

Perché: per creare routine vere serve un catalogo reale; lo stile delle illustrazioni
(figura grigia, muscoli in rosso) deve essere uniforme in tutta l'app.

## Obiettivi

- Tutti gli esercizi ExerciseDB V1, deduplicati, nella lista con ricerca.
- Nome italiano per ogni esercizio, secondo l'uso delle palestre italiane.
- GIF dell'esercizio nella schermata di personalizzazione, resa "in negativo".
- Sets, reps e note come placeholder, non come valori precompilati.
- Muscoli di ogni esercizio convertiti nei gruppi `MuscleTarget`, così le card del
  volume muscolare continuano a funzionare.

## Non obiettivi

- Istruzioni passo-passo (non previste nei mockup): non salvate né mostrate.
- Correzione AR della postura per i nuovi esercizi (resta solo il plank).
- Scaricare o ospitare le GIF dentro l'app.
- Nuove schermate o filtri (per muscolo, attrezzo, ecc.).

## Anti-obiettivi

- Traduzioni letterali goffe: "Tirata alla lat" al posto di "Lat machine" è un fallimento.
- Stili di illustrazione misti nella stessa app.
- Rompere le routine già salvate in `localStorage`.

## Vincoli

- **ExerciseDB V1 gratuito**: 1.500 esercizi, nessuna chiave. Paginazione con
  `?limit=25&after=<nextCursor>` (25 è il massimo per pagina). Il server limita le
  richieste ravvicinate (risponde HTML invece di JSON): servono pause e retry.
  Il README lo dichiara "non per produzione"; licenza delle GIF non dichiarata; GIF a 180 px.
- **GIF senza CORS** (`static.exercisedb.dev` non manda `Access-Control-Allow-Origin`):
  impossibile rielaborarle su canvas, solo CSS.
- **Duplicati**: stesso esercizio con maiuscole diverse
  (es. "Dumbbell Incline Bench Press" / "dumbbell incline bench press").
- **App Capacitor**: le GIF richiedono rete.
- Il codice delle routine (`f3c3306`) è solo su `origin/feat/robust-tracking`, non su `main`.

## Approcci considerati

| | Approccio | Copertura illustrazioni | Esito |
|---|---|---|---|
| **A** | **ExerciseDB V1 come unica fonte** | 100% (1.500/1.500), stile uniforme | **Scelto** |
| B | free-exercise-db (876) + GIF ExerciseDB dove il nome combacia | ~37% (325/876), abbinamenti con errori | Scartato: stile misto, revisione manuale |
| C | Solo gli esercizi abbinati tra le due fonti | ~325 esercizi | Scartato: sottoinsieme di A con più lavoro |

Scelto A perché è l'unico che dà la stessa illustrazione a ogni esercizio; nessun'altra
fonte gratuita ha quello stile (deriva tutto dalla stessa famiglia di asset ExerciseDB).
Se l'app cresce, il piano a pagamento di ExerciseDB (GIF fino a 1080p) si innesta senza
cambiare struttura.

## Decisioni

1. **Snapshot dei dati nel repo.** Uno script Node ri-eseguibile in `scripts/` scarica
   ExerciseDB V1 (con pause/retry) e genera un JSON del catalogo dentro `src/`.
   Campi per esercizio: `id` (exerciseId ExerciseDB), `name` (italiano), `nameEn`,
   `gifUrl`, `primaryMuscles` (`MuscleTarget[]`), `equipment`.
   Le GIF restano caricate dal server ExerciseDB.
2. **Traduzione con agent** (richiesta dell'utente). Gli agent cercano online come viene
   chiamato l'esercizio nelle palestre italiane; non traducono alla lettera.
   - Si tiene l'inglese dove è l'uso comune in Italia (chest press, leg extension, …).
   - Si usa il gergo italiano anche quando è "inglese italianizzato": "lat pulldown" → "Lat machine".
   - Prima un glossario comune (es. dumbbell → manubri, barbell → bilanciere, cable → ai cavi)
     per coerenza, poi batch paralleli; ricerca web solo sui casi dubbi.
   - Output: file di mappatura `id → nome italiano` committato, unito dallo script.
     L'utente può correggerlo a mano e rigenerare.
3. **Muscoli → `MuscleTarget`** (tabella approvata dall'utente):

   | ExerciseDB `targetMuscles` | `MuscleTarget` |
   |---|---|
   | pectorals, serratus anterior | `chest` |
   | deltoids, nome con "lateral" / "side" / "upright row" | `side-delts` |
   | deltoids, nome con "rear" / "reverse fly" / "face pull" | `traps` *(scelta mia: deltoide posteriore → dorso alto)* |
   | deltoids, altri | `front-delts` |
   | triceps | `triceps` |
   | biceps, forearms | `biceps` |
   | latissimus dorsi | `lats` |
   | upper back, trapezius, levator scapulae | `traps` |
   | abdominals, erector spinae | `abs` |
   | glutes, quadriceps, hamstrings, calves, abductors, adductors | `legs` |
   | cardiovascular system | nessuno (lista vuota) |

4. **Deduplica**: stesso nome normalizzato (minuscole, punteggiatura rimossa) → un solo esercizio.
5. **Nomi e ricerca**: in lista e nel titolo si mostra il nome italiano; la ricerca
   cerca sia nel nome italiano sia in quello inglese.
6. **Placeholder**: i campi sets/reps/note partono vuoti. Placeholder: `3`, `8-12` e,
   per gli 8 esercizi di oggi, la loro nota italiana attuale (gli altri tengono
   `es. RPE 8, pausa 90s...`). Campo vuoto al salvataggio → si usa il placeholder.
   Gli 8 esercizi attuali vengono abbinati a mano al loro equivalente ExerciseDB.
7. **Illustrazione "in negativo"** (opzione B, scelta dall'utente nell'anteprima):
   `ExerciseCustomizationGraphic` riceve l'URL della GIF dell'esercizio selezionato,
   con `filter: invert(1) hue-rotate(180deg); mix-blend-mode: screen`.
   Se la GIF non si carica (offline), l'area dell'illustrazione si nasconde.
8. **Routine già salvate**: `RoutineExercise` copia `name` e `primaryMuscles` al momento
   dell'aggiunta, quindi le routine esistenti restano leggibili senza migrazione.

## Lasciato al builder

- Nomi e posizione esatta dei file (script, JSON, mappatura traduzioni).
- Caricamento del JSON (statico o lazy all'apertura della scelta esercizio).
- Lista lunga: virtualizzazione solo se il rendering di ~1.500 righe risulta lento sul telefono.
- Maiuscole dei nomi inglesi (ExerciseDB li ha spesso in minuscolo).
- Test: script di generazione (mappatura muscoli, deduplica) e ricerca.
