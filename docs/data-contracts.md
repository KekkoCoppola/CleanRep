# CleanRep — Contratti dati

I due schemi JSON qui sotto sono il confine stabile dell'applicazione. Oggi vengono
scambiati in-process tra `poseTracker` e il rule engine locale (`src/engine/`); sono
progettati per poter viaggiare invariati verso un backend remoto (vedi
[future-claude-integration.md](future-claude-integration.md)).

Sorgente TypeScript: [`src/types/contracts.ts`](../src/types/contracts.ts).

## 1. `PoseSnapshot` — input del motore di valutazione

Prodotto dal frontend a ogni frame di tracking (~30fps; le regole vengono valutate a ~10Hz).

```json
{
  "exercise": "PLANK",
  "timestamp": 1752307200000,
  "fps": 30,
  "landmarks": {
    "LEFT_SHOULDER":  { "x": 0.32, "y": 0.48, "z": -0.12, "visibility": 0.99 },
    "RIGHT_SHOULDER": { "x": 0.34, "y": 0.50, "z":  0.08, "visibility": 0.97 },
    "LEFT_ELBOW":     { "x": 0.30, "y": 0.62, "z": -0.10, "visibility": 0.98 },
    "RIGHT_ELBOW":    { "x": 0.33, "y": 0.63, "z":  0.09, "visibility": 0.95 },
    "LEFT_HIP":       { "x": 0.52, "y": 0.55, "z": -0.05, "visibility": 0.99 },
    "RIGHT_HIP":      { "x": 0.53, "y": 0.56, "z":  0.05, "visibility": 0.98 },
    "LEFT_KNEE":      { "x": 0.68, "y": 0.60, "z": -0.04, "visibility": 0.96 },
    "RIGHT_KNEE":     { "x": 0.69, "y": 0.61, "z":  0.04, "visibility": 0.94 },
    "LEFT_ANKLE":     { "x": 0.82, "y": 0.66, "z": -0.03, "visibility": 0.93 },
    "RIGHT_ANKLE":    { "x": 0.83, "y": 0.67, "z":  0.03, "visibility": 0.91 }
  },
  "computedAngles": {
    "bodyLine": 178.4,
    "leftHipAngle": 179.5,
    "rightHipAngle": 177.4,
    "leftKneeAngle": 174.2,
    "rightKneeAngle": 174.5
  }
}
```

Convenzioni MediaPipe:

- `x`, `y` normalizzati in `[0,1]` rispetto al frame; **y cresce verso il basso**.
- `z` = profondità relativa al baricentro delle anche (negativo = più vicino alla camera). È rumorosa: il rule engine lavora sul piano immagine (x,y).
- `visibility` in `[0,1]`; sotto `0.5` il punto è considerato non affidabile.
- `computedAngles` è **pre-calcolato sul client** (in gradi). Se assente, l'evaluator lo ricava dai landmark. `bodyLine` è l'angolo spalla–anca–caviglia mediato tra i due lati: 180° = corpo perfettamente in linea.

L'esempio sopra è un plank corretto ripreso di lato (testa a sinistra del frame).

## 2. `EvaluationResult` — output del motore di valutazione

```json
{
  "isCorrect": false,
  "overallScore": 6,
  "jointsToColorRed": ["LEFT_HIP", "RIGHT_HIP"],
  "audioFeedback": "Alza il bacino, sei troppo basso"
}
```

| Campo | Tipo | Semantica |
|---|---|---|
| `isCorrect` | boolean | `true` se nessuna regola è violata |
| `overallScore` | number | 1–10 (10 = perfetto; `0` riservato a "posa non rilevabile") |
| `jointsToColorRed` | string[] | Nomi dei landmark da colorare in rosso sull'overlay (ordinati alfabeticamente) |
| `audioFeedback` | string | Frase italiana ≤ 8 parole, pronunciata dal TTS del dispositivo |

## Regole biomeccaniche del plank (soglie in `src/engine/plankRules.ts`)

| # | Regola | Soglia | Joint rossi | Feedback | Penalità |
|---|---|---|---|---|---|
| 0 | Gating visibilità | `visibility ≥ 0.5` sui joint richiesti | — | "Mettiti di lato alla camera" | score = 0 |
| 1 | Linea del corpo (bacino che cede) | `bodyLine < 160°` e anca sotto la retta spalla–caviglia | `*_HIP` | "Alza il bacino, sei troppo basso" | −4 |
| 1b | Linea del corpo (bacino a piramide) | `bodyLine < 160°` e anca sopra la retta | `*_HIP` | "Abbassa il bacino, corpo in linea" | −4 |
| 2 | Ginocchia distese | angolo anca–ginocchio–caviglia `< 160°` | `*_KNEE` | "Distendi le gambe" | −2 |
| 3 | Gomiti sotto le spalle | scostamento orizzontale gomito–spalla `> 0.1` | `*_ELBOW` | "Porta i gomiti sotto le spalle" | −2 |

Anti-flickering (`src/engine/smoothing.ts`): angoli filtrati con EMA (α = 0.3) e cambio di
stato verde↔rosso committato solo dopo ≥ 500 ms di persistenza.
