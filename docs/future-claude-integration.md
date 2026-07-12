# CleanRep — Integrazione futura con Claude (differita)

> **Stato: NON attiva nell'MVP.** La valutazione real-time è interamente locale
> (rule engine geometrico, gratis, ~10Hz). Questo documento conserva i deliverable
> del design originale — system prompt e backend — pronti per quando si vorrà
> aggiungere un livello di coaching AI.
>
> **Costi**: l'API Anthropic non ha piano gratuito. Chiamarla ogni 2 secondi durante
> l'allenamento (~30 req/min) è insostenibile per un'app consumer. L'uso consigliato
> è **on-demand**: riepilogo di fine sessione, consigli personalizzati, spiegazioni
> degli errori ricorrenti — poche chiamate per sessione, non un loop.

## Architettura ibrida consigliata

```
Browser (invariato)                        Server (nuovo, opzionale)
┌─────────────────────────┐               ┌──────────────────────────┐
│ MediaPipe Pose 30fps    │               │ Node.js/Express          │
│ Rule engine locale 10Hz │──fine sessione│ POST /api/coach          │
│ (verde/rosso + TTS)     │  (1 chiamata)─▶ @anthropic-ai/sdk        │
└─────────────────────────┘               │ claude-opus-4-8          │
                                          └──────────────────────────┘
```

Il payload riusa i contratti esistenti: un array di `PoseSnapshot` campionati (o
statistiche aggregate della sessione) in ingresso, un `EvaluationResult` esteso in uscita.

## System prompt per Claude

```text
Sei il motore di valutazione biomeccanica di CleanRep, un personal trainer digitale
severo ma costruttivo. Ricevi snapshot di pose in formato JSON (landmark MediaPipe
con coordinate x,y normalizzate in [0,1] con y crescente verso il basso, z relativa
alle anche, visibility in [0,1], più gli angoli articolari pre-calcolati in gradi).

REGOLE DI ANALISI (esercizio PLANK):
1. Se un landmark tra spalle, anche, ginocchia o caviglie ha visibility < 0.5,
   la posa non è valutabile: isCorrect=false, overallScore=0, jointsToColorRed=[],
   audioFeedback che invita a riposizionarsi di lato alla camera.
2. Linea del corpo: angolo spalla-anca-caviglia (media dei due lati, campo bodyLine).
   Sotto 160° la linea è rotta. Determina la direzione confrontando la y dell'anca
   con la retta spalla-caviglia: anca sotto la retta = bacino che cede ("Alza il
   bacino, sei troppo basso"); anca sopra = bacino a piramide ("Abbassa il bacino,
   corpo in linea"). In entrambi i casi segnala LEFT_HIP e RIGHT_HIP.
3. Ginocchia: angolo anca-ginocchio-caviglia sotto 160° = gambe piegate
   ("Distendi le gambe"), segnala il ginocchio del lato violato.
4. Gomiti (plank su avambracci): |x gomito - x spalla| > 0.1 = gomiti fuori asse
   ("Porta i gomiti sotto le spalle"), segnala i gomiti violati.
5. Punteggio: parti da 10 e sottrai 4 per la linea del corpo, 2 per le ginocchia,
   2 per i gomiti; minimo 1. Se nessuna regola è violata: isCorrect=true e score 10.

VINCOLI DI OUTPUT:
- Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza alcun testo, commento
  o markdown prima o dopo.
- Schema: {"isCorrect": boolean, "overallScore": number 0-10,
  "jointsToColorRed": string[] con i nomi esatti dei landmark (es. "LEFT_HIP"),
  "audioFeedback": string in italiano di MASSIMO 8 parole}.
- audioFeedback è pronunciato da un TTS: imperativo, concreto, una sola correzione
  alla volta (la più grave).
```

Con gli structured outputs (sotto) il vincolo "solo JSON" è garantito dall'API stessa;
il prompt lo ribadisce per robustezza.

## Sketch backend Node.js/Express

```bash
npm install express @anthropic-ai/sdk zod
# export ANTHROPIC_API_KEY=sk-ant-...
```

```typescript
// server/index.ts
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

const SYSTEM_PROMPT = `...(il system prompt qui sopra)...`;

const EvaluationResultSchema = z.object({
  isCorrect: z.boolean(),
  overallScore: z.number(),
  jointsToColorRed: z.array(z.string()),
  audioFeedback: z.string(),
});

const app = express();
app.use(express.json({ limit: '512kb' }));

const client = new Anthropic(); // legge ANTHROPIC_API_KEY dall'ambiente

app.post('/api/coach', async (req, res) => {
  try {
    const response = await client.messages.parse({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      // Prompt caching: il system prompt (stabile) viene riusato tra le chiamate.
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: JSON.stringify(req.body) }],
      // Structured outputs: la risposta È lo schema EvaluationResult, garantito.
      output_config: { format: zodOutputFormat(EvaluationResultSchema) },
    });
    if (!response.parsed_output) {
      res.status(502).json({ error: 'Risposta del modello non conforme allo schema' });
      return;
    }
    res.json(response.parsed_output);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Valutazione AI non disponibile' });
  }
});

app.listen(3001, () => console.log('CleanRep coach API su http://localhost:3001'));
```

Note implementative:

- **`client.messages.parse` + `zodOutputFormat`**: l'API vincola la risposta allo schema
  Zod e l'SDK la restituisce già validata in `parsed_output` — niente parsing manuale,
  niente testo fuori dal JSON.
- **Prompt caching** (`cache_control: ephemeral` sul system prompt): le chiamate
  successive alla prima riusano il prefisso in cache. Verificare l'efficacia con
  `response.usage.cache_read_input_tokens > 0`.
- **La API key vive solo sul server**: mai nel bundle frontend.
- Lato client basta un `fetch('/api/coach', { method: 'POST', body: JSON.stringify(...) })`
  a fine sessione; il tipo di ritorno è l'`EvaluationResult` di `src/types/contracts.ts`
  (l'interfaccia `Evaluator` è già pensata per accogliere un'implementazione remota).
