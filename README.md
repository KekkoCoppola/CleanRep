# CleanRep 🏋️

**Live AR Fitness Trainer**: la fotocamera traccia il corpo in tempo reale, disegna lo scheletro (verde = postura corretta, rosso = punti da correggere) e corregge a voce. Esercizio attuale: **Plank**, su avambracci o a braccia tese (riconosciuti in automatico).

Tutto gira **in locale sul dispositivo** (browser o APK Android): nessun video lascia il telefono e non ci sono API a pagamento.

## Come funziona

```
fotocamera ─▶ MediaPipe Pose (2 pose, 33 landmark) ─▶ RawPoseFrame
                                                        │
          ┌───────────────── core (TypeScript puro, senza DOM) ─────────────────┐
          │ PoseStabilizer: aggancio alla persona · correzione sinistra/destra  │
          │   · coerenza anatomica · gate di velocità · filtro 1€ · qualità     │
          │ HoldSession: NO_SUBJECT → SETUP → HOLDING ⇄ PAUSED + regole         │
          │ Coach: cosa dire e quando (persistenza, priorità, pause)            │
          └─────────────────────────────────────────────────────────────────────┘
                                                        │
      canvas unico: frame analizzato + scheletro dello STESSO frame ◀─┘ ─▶ voce (TTS)
```

- **Aggancio alla persona.** Con più persone nell'inquadratura lo scheletro resta su chi si allena: conta la continuità del riquadro e le proporzioni ossee in metri.
- **Arti che non saltano.**
  - Gli scambi sinistra/destra del modello vengono corretti.
  - Un giunto che si sposta in modo impossibile viene scartato, così come un osso che cambia lunghezza.
  - Il tremolio è filtrato con il filtro One Euro.
- **"Non sono sicuro" ≠ "sbagli".** Se la posa è poco affidabile (persona tagliata, poca luce, poco visibile) l'app non giudica. Lo scheletro diventa neutro e la voce dà solo istruzioni di inquadratura.
- **Giudizio solo in posizione.** Chi è in piedi o si sta sistemando non riceve né correzioni né complimenti.
- **Regole normalizzate sul corpo e sulla gravità**, con isteresi. Valgono a qualsiasi distanza, con qualsiasi proporzione del frame e con la camera inclinata: la gravità arriva dall'accelerometro.
- **Voce.** Dice una correzione alla volta e solo se l'errore dura. Tra una frase e l'altra lascia una pausa minima, e fa i complimenti quando correggi.

## Analisi di un video

Dalla home, **"Analizza un video"**: carichi un video del plank ripreso di lato. Passa dalla stessa pipeline del live, a ~10 frame analizzati per secondo di video, e l'app restituisce:

- un **testo breve** con il tempo valido fino al cedimento tecnico, il livello rispetto ai valori normativi, cosa migliorare (con misura, istante e consiglio), cosa va bene e cosa non si può giudicare dal video;
- gli **screenshot** dei momenti peggiori di ogni difetto: scheletro dell'app, punti da correggere in rosso e cerchiati, asse ideale tratteggiato, didascalia con difetto, istante e misura;
- **"Condividi report"**: un unico file HTML con testo e immagini (foglio di condivisione Android nell'APK, condivisione di sistema o download nel browser).

La valutazione segue la rubrica *Valutazione biomeccanica e metodologia di giudizio tecnico del plank*:

- tre livelli: ottimale, difetto tollerabile, deviazione critica;
- asse orecchio–spalla–anca–ginocchio–caviglia;
- bacino fuori asse: tollerabile sotto i 5 cm, critico sopra;
- protocollo del test:
  - alla prima deviazione evidente c'è un richiamo e 3 s per ripristinare;
  - la seconda deviazione o il collasso chiudono il test;
  - un difetto lieve non corretto entro 3 s conta come deviazione.

Le soglie sono in `src/exercises/plank/definition.ts` (`PLANK_THRESHOLDS`), il protocollo e il testo in `src/core/analysis/holdReport.ts`.

## Avvio (web)

```bash
npm install          # scarica anche wasm e modelli MediaPipe in public/mediapipe
npm run dev          # http://localhost:5173
npm test             # unit test (Vitest)
npm run typecheck    # core senza DOM + app
```

Parametri URL:

| Parametro | Effetto |
|---|---|
| `?debug` | overlay diagnostico (fase, qualità, soggetto, correzioni, fps) + scelta sorgente: fotocamera, file video, registrazione `.json`, demo sintetica |
| `?record` | registra i frame grezzi della sessione e li scarica come `.json` a fine sessione (riproducibili con `?debug`) |
| `?model=lite\|full\|heavy` | modello MediaPipe (default `full`; `heavy` richiede `node scripts/fetch-models.mjs --heavy`) |
| `?poses=1..4` | numero massimo di persone rilevate (default 2) |

Test da smartphone via browser: serve HTTPS per la camera, quindi un tunnel tipo `ngrok http 5173` (i domini ngrok sono in `server.allowedHosts`).

## APK Android (Capacitor 6)

Requisiti: JDK 17 e Android SDK 34 (`ANDROID_HOME`).

```bash
npm run android:apk     # build web + cap sync + gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
npm run android:open    # apre il progetto in Android Studio
```

Nell'APK la voce usa il TTS nativo di Android e lo schermo resta acceso durante l'allenamento. Gli asset MediaPipe sono inclusi, quindi l'app funziona offline.

## Struttura

```
src/
├── core/            # TS puro (tsconfig.core.json vieta il DOM): riusabile ovunque, testato
│   ├── tracking/    # stabilizer, subject lock, swap L/R, anatomia, qualità
│   ├── exercise/    # tipi ExerciseDefinition, contesto, HoldSession
│   ├── feedback/    # Coach + frasi comuni
│   ├── filters/     # 1€, isteresi, debounce
│   ├── geometry/    # vettori isotropi, gravità
│   └── pipeline.ts  # stabilizer + sessione + coach
├── exercises/       # un esercizio = una cartella (plank/) + registro in index.ts
├── platform/        # camera, MediaPipe, sorgenti frame, sensori, voce, wake lock
├── ui/              # React: App, StageView, HUD, renderer canvas
├── dev/             # generatore sintetico e registratore di sessioni
└── types/           # contratti dati
android/             # progetto nativo Capacitor
scripts/             # fetch-models, build-apk
docs/                # contratti dati, integrazione AI futura
```

### Aggiungere un esercizio

1. Crea `src/exercises/<nome>/definition.ts` che esporta una `HoldExerciseDefinition`. Serve: `isInPosition`, le regole con `evaluate(ctx, wasViolated)` e le frasi.
2. Registralo in `src/exercises/index.ts` e aggiungi l'id a `ExerciseType`.
3. Aggiungi i test con il generatore sintetico (`src/dev/synthetic.ts`) e, meglio ancora, con sessioni reali registrate con `?record`.

Gli esercizi a ripetizioni (squat, push-up) avranno un `kind: 'reps'` con il contatore delle ripetizioni: è il prossimo passo dell'architettura.

## Stack

React 18 · TypeScript · Vite · @mediapipe/tasks-vision · Capacitor 6 · Vitest
