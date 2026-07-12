# CleanRep 🏋️

**Live AR Fitness Trainer** — la webcam traccia il tuo corpo in tempo reale, disegna lo scheletro AR (verde = postura corretta, rosso = punti da correggere) e ti corregge a voce. Esercizio attuale: **Plank**.

Tutto gira **in locale nel browser**: nessun video lascia il dispositivo, nessuna API a pagamento.

## Come funziona

1. **Tracking** — [MediaPipe Pose](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) rileva 33 landmark del corpo a ~30fps (modello `full`, GPU delegate, frame-skipping adattivo su hardware lento).
2. **Valutazione** — un rule engine geometrico ([`src/engine/`](src/engine/)) valuta a ~10Hz la biomeccanica del plank: linea spalla–anca–caviglia, deviazione del bacino, ginocchia, gomiti. Angoli filtrati con EMA e stato debounced (niente flickering).
3. **Feedback** — overlay canvas verde/rosso + frasi vocali italiane (Web Speech API), max una ogni 4 secondi.

## Avvio

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit test (Vitest)
```

- **Modalità debug senza webcam**: `http://localhost:5173/?debug` (riproduce pose simulate in loop)
- **Modello leggero** per dispositivi deboli: aggiungi `?model=lite` all'URL
- **Test da smartphone**: serve HTTPS per la camera → tunnel tipo `ngrok http 5173` (i domini ngrok sono già in `server.allowedHosts`)

## Struttura

```
src/
├── engine/      # geometria, regole del plank, smoothing, evaluator
├── pose/        # wrapper MediaPipe PoseLandmarker + landmark
├── components/  # CameraView, DebugView, HUD, rendering scheletro
├── feedback/    # sintesi vocale con throttling
├── types/       # contratti dati (PoseSnapshot, EvaluationResult)
└── fixtures/    # pose simulate per test e debug mode
docs/
├── data-contracts.md             # schema JSON input/output
└── future-claude-integration.md  # upgrade opzionale: coaching AI di fine sessione
```

## Stack

React 18 · TypeScript · Vite · @mediapipe/tasks-vision · Vitest — zero librerie UI, bundle iniziale minimo.
