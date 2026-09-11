# CleanRep — Contratti dati

Sorgente TypeScript: [`src/types/contracts.ts`](../src/types/contracts.ts) e [`src/core/tracking/types.ts`](../src/core/tracking/types.ts).

## 1. `RawPoseFrame`: input del core

È l'unico input di `TrainingPipeline` ([`src/core/pipeline.ts`](../src/core/pipeline.ts)). Lo producono la camera live, un file video o una registrazione, e il core non sa quale delle tre. Le registrazioni `?record` sono array di questi frame.

```json
{
  "timestamp": 18234.5,
  "width": 640,
  "height": 480,
  "brightness": 0.46,
  "down": { "x": 0.02, "y": 0.99 },
  "phoneFlat": false,
  "poses": [
    {
      "landmarks": [{ "x": 0.32, "y": 0.48, "z": -0.12, "visibility": 0.99 }, "… 33 landmark MediaPipe …"],
      "worldLandmarks": [{ "x": -0.21, "y": -0.4, "z": -0.15, "visibility": 0.99 }, "… 33 in metri …"]
    }
  ]
}
```

| Campo | Semantica |
|---|---|
| `timestamp` | ms monotoni (`performance.now()` dal vivo) |
| `width`, `height` | pixel del frame analizzato. Servono per la geometria **isotropa**: `x` va moltiplicata per `width/height` prima di calcolare angoli, altrimenti su 4:3, 16:9 e 9:16 gli angoli risultano deformati |
| `poses` | tutte le persone rilevate (default max 2). Il subject lock sceglie quella giusta |
| `landmarks` | 33 punti MediaPipe: `x,y` in `[0,1]` sul frame **non specchiato**, `y` verso il basso, `z` relativa alle anche (negativa = più vicino), `visibility` in `[0,1]` |
| `worldLandmarks` | stessi punti in metri, 3D. Usati per la coerenza anatomica (le ossa non cambiano lunghezza) |
| `brightness` | luminosità media 0–1 (campionata 1 volta/s) |
| `down` | gravità nel piano immagine, dall'accelerometro. Assente = `(0,1)` |
| `phoneFlat` | telefono quasi orizzontale: `down` non affidabile |

## 2. `StablePose`: posa stabilizzata

Esce da `PoseStabilizer` ed è ciò che viene **disegnato e giudicato**: ogni giunto ha `x,y` filtrati, `confidence` e uno `state`:

- `tracked`: misurato ora;
- `held`: ultimo valore buono tenuto per ≤ 300 ms, disegnato tratteggiato;
- `lost`: non affidabile, né disegnato né usato dalle regole.

Contiene anche `subjectId`, `nearSide` (il lato verso la camera), `quality { score, issues, blocking }` e `corrections` (scambi L/R e campioni rifiutati nel frame).

## 3. `EvaluationResult`: output della valutazione

```json
{
  "isCorrect": false,
  "overallScore": 6,
  "jointsToColorRed": ["LEFT_HIP", "RIGHT_HIP"],
  "audioFeedback": "Alza il bacino",
  "phase": "HOLDING",
  "variant": "FOREARM",
  "confidence": 0.93,
  "issues": [{ "id": "hipSag", "severity": "high", "joints": ["LEFT_HIP", "RIGHT_HIP"] }]
}
```

| Campo | Semantica |
|---|---|
| `phase` | `NO_SUBJECT` · `SETUP` (visibile ma non in posizione) · `HOLDING` (in posizione: unica fase giudicata) · `PAUSED` |
| `overallScore` | 1–10 in `HOLDING`; `0` = non valutabile |
| `variant` | plank: `FOREARM` (avambracci) o `HIGH` (braccia tese) |
| `confidence` | qualità della posa × quota di regole valutabili |
| `audioFeedback` | testo HUD (≤ 8 parole). **Quando** parlare lo decide il Coach |

## Regole del plank ([`src/exercises/plank/definition.ts`](../src/exercises/plank/definition.ts))

Le misure sono normalizzate sul corpo e riferite alla gravità. Le coppie entra/esce sono soglie di isteresi. Se i giunti richiesti non sono affidabili, la regola viene **saltata** e non conta come violata.

Le soglie seguono la rubrica *Valutazione biomeccanica e metodologia di giudizio tecnico del plank*: ogni regola restituisce `level` (`tolerable` = richiamo verbale, `critical` = cedimento tecnico) e `value` (cm o gradi). Le distanze in cm usano la scala dei landmark mondo MediaPipe.

| Regola | Misura | Tollerabile entra / esce | Critico | Priorità | Penalità |
|---|---|---|---|---|---|
| In posizione | asse spalle→caviglie ≤ 40° dal pavimento, busto ≤ 50°, braccio che scende verso il pavimento | — | — | — | — |
| `hipSag` | anca sotto la retta spalla–caviglia (cm) | 3.5 / 2.5 cm | ≥ 5 cm | 1 | −4 |
| `hipPike` | anca sopra la retta (cm) | 3.5 / 2.5 cm | ≥ 5 cm | 1 | −4 |
| `kneesBent` | flessione del ginocchio (180° − angolo) | 12° / 8° | ≥ 20° | 2 | −2 |
| `elbowsUnderShoulders` (avambracci) | braccio spalla→gomito dalla verticale | 15° / 10° | ≥ 30° | 3 | −2 |
| `handsUnderShoulders` (braccia tese) | spalla→polso dalla verticale | 20° / 14° | ≥ 30° | 3 | −2 |
| `headUp` | sguardo (orecchio→naso) dalla verticale: iperestensione | 50° / 40° | ≥ 70° | 4 | −1 |
| `headDrop` | orecchio sotto il prolungamento del busto | 20° / 14° | — | 5 (bassa) | −1 |

Deviazione tollerabile = metà della penalità.

**Protocollo del test** ([`src/core/analysis/holdReport.ts`](../src/core/analysis/holdReport.ts)):

- Il cronometro parte quando il corpo è in posizione e stabile.
- Deviazione = difetto critico per ≥ 0.5 s, oppure difetto tollerabile non corretto entro 3 s. Alla prima deviazione scatta il richiamo.
- Il test termina se la deviazione non viene ripristinata entro 3 s, alla seconda deviazione, o quando il corpo esce dalla posizione (collasso).
- Il tempo registrato è il "tempo valido fino al cedimento tecnico" e viene confrontato con le fasce normative:
  - uomini < 77 / 77–106 / 107–128 / > 128.5 s;
  - donne < 63 / 63–90 / 91–121 / > 121 s.
- Metriche sull'intero video: piedi che scivolano (aumento della distanza gomiti–caviglie ≥ 6 cm) e oscillazioni del bacino (≥ 1.5 cm).

Variante: angolo del gomito > 145° = braccia tese, < 120° = avambracci; nella fascia intermedia si tiene la variante precedente.

## Coach vocale ([`src/core/feedback/coach.ts`](../src/core/feedback/coach.ts))

- Correzioni solo in `HOLDING`:
  - l'errore deve persistere ≥ 1.5 s (≥ 3 s se di severità bassa);
  - si dice solo quello a priorità più alta;
  - la stessa correzione non si ripete prima di 10 s.
- Tra due frasi passano almeno 3.5 s, e il coach non parla sopra una frase in corso. Fanno eccezione gli annunci di fase ("Posizione presa", "Pausa").
- Dopo che l'errore segnalato è stato corretto arriva il complimento ("Bene, così"), al massimo uno ogni 15 s. Ogni 30 s di forma corretta c'è un annuncio del tempo.
- Fuori posizione o con una posa non affidabile il coach dà solo istruzioni di inquadratura ("Mettiti di lato alla camera", "Troppo buio…"), dopo 2 s di persistenza.
