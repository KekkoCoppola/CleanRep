# CleanRep Design System & UI Specifications

Questo documento formalizza il design system, l'architettura visiva e i pattern di interazione di CleanRep, derivati dal mockup di riferimento.

---

## 1. Visione & Principi di Design

CleanRep adotta un'estetica **Stealth / Obsidian Dark Mode**:
- **Pure OLED Black Foundation**: Sfondo nero puro (`#000000`) per display OLED e mobile, con perfetto stacco volumetrico per le card e totale assenza di discontinuità con le illustrazioni della mascotte.
- **Mascotte Gymmy & Day Modes**: La mascotte ufficiale CleanRep è presente al centro della Home:
  - **Rest Day**: Gymmy riposa rilassato a letto con cuscino, coperta verde e animazione fluttuante "Zzz" con luce soffusa da terra.
  - **Workout Day**: Gymmy esegue un energico squat con bilanciere e gocce di sudore, mostrando il logo CleanRep sulla maglietta.
- **Dinamica di Scroll & Sticky Header**:
  - In posizione iniziale (scroll = 0), Gymmy è il protagonista visivo al centro della schermata, mentre la sezione Workouts fa capolino dal basso.
  - Con lo scroll verso il basso, Gymmy scorre via fluidamente verso l'alto scomparendo, lasciando spazio a tutta la dashboard dei widget.
  - Il titolo stilizzato in alto ("Rest Day" / "Workout Day" con il logo 'R' con il bicipite) rimane **sticky** in cima con effetto blur, garantendo coerenza di stato per tutta la navigazione.
- **Micro-Elevazione e Card Curvature**: Cards con bordi fortemente arrotondati (`border-radius: 24px - 28px`) e superfici opache soft (`#16171d`), che separano i contenuti senza appesantire la vista.
- **Tipografia di Precisione**: Font sans-serif moderno, geometrico e leggibile (`Plus Jakarta Sans`), con forte gerarchia tra numeri mastodontici in evidenza e testi di supporto raffinati in scala di grigi.
- **Visual Feedback & Heatmap**: Tracciamento visivo delle attività tramite griglia di pallini (dot-matrix heatmap) per i mesi e indicatori ad anello di completamento per gli allenamenti.

---

## 2. Token di Design (CSS Variables)

```css
:root {
  /* Sfondi e Superfici */
  --bg-app: #0c0d11;
  --bg-card: #16171d;
  --bg-card-hover: #1b1d24;
  --bg-card-active: #21232b;
  --bg-pill: #21232a;
  --bg-pill-hover: #2b2e38;

  /* Colori del Testo */
  --text-primary: #ffffff;
  --text-secondary: #9ea2b0;
  --text-muted: #656877;
  --text-dim: #454854;

  /* Accenti e Indicatori */
  --accent-white: #ffffff;
  --accent-ok: #22c55e;
  --accent-ko: #ef4444;
  --track-bg: #272a34;
  --dot-inactive: #252732;
  --dot-active: #ffffff;

  /* Bordi e Divisori */
  --border-subtle: rgba(255, 255, 255, 0.05);
  --border-focus: rgba(255, 255, 255, 0.15);
  --divider: rgba(255, 255, 255, 0.06);

  /* Raggi di Curvatura */
  --radius-card: 26px;
  --radius-card-sm: 20px;
  --radius-pill: 9999px;
  --radius-button: 18px;

  /* Tipografia */
  --font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```

---

## 3. Tipografia & Gerarchia

| Livello | Dimensione | Peso | Spaziatura (Letter-Spacing) | Utilizzo |
|---|---|---|---|---|
| **Display Header** | `2.15rem` (34px) | 700 (Bold) | `-0.03em` | Titolo principale "Workouts" |
| **Hero Metric Number** | `2.8rem` (44px) | 700 (Bold) | `-0.02em` | Valori "190", "3.200" |
| **Hero Metric Unit** | `1.15rem` (18px) | 500 (Medium) | `normal` | Unità "lbs" |
| **Card Title** | `1.1rem` (17.5px) | 600 (SemiBold) | `-0.01em` | "Chest + tricep", "Body weight" |
| **Card Subtitle** | `0.875rem` (14px) | 400 (Regular) | `normal` | "Fridays", "31 min ago", "Last 7 days" |
| **Month Label** | `0.85rem` (13.5px) | 500 (Medium) | `normal` | "Jan", "Feb", "Mar" |
| **Badge Counter** | `0.95rem` (15px) | 700 (Bold) | `normal` | Numero "1", "2" nel cerchio |

---

## 4. Specifiche Componenti

### 4.1 Header Bar
- **Titolo a sinistra**: "Workouts" in grassetto bianco, allineato con il padding laterale dello schermo.
- **Azioni a destra**: Due pulsanti circolari adiacenti (`38px × 38px`), sfondo `--bg-pill`, bordo sottile e icone bianche:
  1. Icona **Sliders / Tuning**: apre filtri e impostazioni.
  2. Icona **Plus (+)**: permette di aggiungere un allenamento o analizzare un video.

### 4.2 Griglia Superiore (2 Colonne)
- **Card Sinistra (Workout 1)**:
  - In alto a sinistra: **ProgressRing** (diametro `44px`), tracciato grigio scuro con arco bianco indicante la percentuale e cifra "1" al centro.
  - In alto a destra: Icona di regolazione (tuning sliders).
  - In basso: Nome scheda in grassetto ("Chest + tricep") e giorno ("Fridays").
- **Card Destra (Body Weight)**:
  - In alto a destra: Icona di regolazione.
  - Centro/Alto: Valore numerico grande `190` con unità adiacente `lbs`.
  - In basso: Titolo metrica "Body weight" e tempo trascorso "31 min ago".

### 4.3 Card Heatmap Mensile & Workout 2
- Struttura unificata ad alta densità informativa:
  - **Sezione Superiore (Dot Grid Heatmap)**:
    - 3 colonne per i mesi: "Jan", "Feb", "Mar".
    - Sotto ogni mese, una matrice di punti (pallini di diametro `5px` con spaziatura regolare).
    - I giorni in cui l'utente si è allenato brillano in bianco (`#ffffff`) con lieve alone luminoso, mentre i giorni non attivi restano in grigio scuro opaco (`#252732`).
  - **Sezione Inferiore (Workout 2 Banner)**:
    - Sinistra: **ProgressRing** con numero "2" e arco bianco di completamento.
    - Centro: Titolo ("Back + bicep + legs") e giorno ("Mondays").
    - Destra: Icona di regolazione (tuning sliders).

### 4.4 Card Volume Lifted
- Card orizzontale a tutta larghezza divisa visivamente in due metà:
  - **Sinistra**: Titolo "Volume lifted", sottotitolo "Last 7 days".
  - **Destra**: Valore numerico grande "3.200 lbs" affiancato dall'icona di regolazione.

### 4.5 Card Inferiore di Scorrimento (Add / Next Workout)
- Card semivisibile che sbuca dalla parte inferiore della schermata, con un'icona "+" morbida, a suggerire la lista scorrevole delle schede e la possibilità di aggiungere nuove routine.

### 4.6 Bottom Docked Navbar
- Barra di navigazione fissa sul fondo con effetto satinato scuro (`backdrop-filter: blur(20px)` e sfondo semi-trasparente `rgba(12, 13, 17, 0.88)`).
- 4 icone ad alto contrasto distribuite in modo uniforme:
  1. **Dashboard Grid** (Icona attiva bianca: 4 quadratini arrotondati 2×2).
  2. **Calendar** (Icona calendario per visualizzare la pianificazione mensile/settimanale).
  3. **Analytics** (Icona barre statistiche per consultare i progressi e carichi).
  4. **Live Cam Workout** (Icona videocamera: **avvia direttamente la modalità di tracciamento postura live**).

---

## 5. Pattern di Navigazione & Integrazione Live Cam

- **Schermata Base (`phase: 'idle'`)**: L'utente naviga la dashboard con tutte le metriche, lo storico visivo delle sessioni e le schede programmate.
- **Avvio Live Workout**:
  - Toccando l'icona della **videocamera** nella navbar, l'app passa istantaneamente a `phase: 'active'`.
  - In alternativa, toccando una delle card di allenamento ("Chest + tricep" o "Back + bicep + legs"), l'utente può avviare la routine corrispondente.
- **Sessione Live (`phase: 'active'`)**:
  - Si apre a pieno schermo la visuale fotocamera con rilevamento pose MediaPipe (`StageView`).
  - L'HUD vocale e visivo fornisce feedback in tempo reale sulla corretta esecuzione (verde/rosso, conteggio secondi, suggerimenti audio).
  - Un pulsante sempre visibile e accessibile in alto a sinistra o in basso consente di **terminare la sessione** e rientrare nella dashboard Workouts.
- **Analisi Video**: Tramite il tasto "+" dell'header è possibile caricare un file video locale e ottenere il report biomeccanico dettagliato.

---

## 6. Schema Dati Mock per Estensioni Future

Tutti i dati visualizzati nella dashboard sono gestiti nel file `src/ui/mockData/workoutsMockData.ts`:
- `WorkoutRoutine`: `{ id, number, title, schedule, progressPercent }`
- `MetricSummary`: `{ id, value, unit, label, subtitle }`
- `MonthHeatmap`: `{ month: string, weeks: Array<Array<{ day: number, completed: boolean }>> }`
- `VolumeSummary`: `{ value: string, unit: string, label: string, timeframe: string }`

Questi contratti permetteranno di sostituire agevolmente i dati fittizi con il salvataggio su SQLite/Capacitor Storage o sincronizzazione Cloud nelle versioni future.
