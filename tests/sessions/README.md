# Sessioni reali di regressione

Le sessioni registrate dal vivo sono il modo per verificare il tracking in condizioni vere: poca luce, controluce, camera inclinata, una seconda persona che passa, oggetti nell'inquadratura. Ogni file `.json` in questa cartella viene rigiocato da [`../sessions.test.ts`](../sessions.test.ts) su tutta la pipeline.

## Come registrare

1. Apri l'app con `?record`, per esempio `http://localhost:5173/?record&debug` o via ngrok dal telefono.
2. Esegui l'esercizio. Premi "Termina sessione" e il browser scarica `cleanrep-plank-<data>.json`.
3. Rinomina il file con l'esito atteso e copialo qui:

| Nome | Cosa verifica |
|---|---|
| `luce-bassa.correct.json` | plank corretto: va in posizione e non riceve **nessuna** correzione |
| `in-piedi.standing.json` | non risulta mai "in posizione" |
| `bacino-basso.hipSag.json` | la regola `hipSag` scatta e la correzione viene detta |

Per l'ultima riga si può usare l'id di qualunque regola: `hipSag`, `hipPike`, `kneesBent`, `elbowsUnderShoulders`, `handsUnderShoulders`, `headAlignment`.

Per rivedere una sessione con l'overlay diagnostico usa `?debug`, poi sorgente "Registrazione .json".
