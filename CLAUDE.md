# Haplyhost — contesto di progetto

Piattaforma SaaS multi-struttura per case vacanze. Ogni host gestisce la propria "struttura" (es. una villa, un B&B); ogni struttura ha una guida digitale per gli ospiti con un assistente AI chiamato **Gennarino**. Il brand B2B è **Haplyhost**; Gennarino è il personaggio/concierge lato ospite.

Questo repo è la **V2**, scritta da zero come multi-tenant fin dall'inizio. Esiste una V1 precedente ("StayFlow", repo `dinozzo-maker/stayflow`, deploy su `stayflow-six-pink.vercel.app`) che serviva una sola struttura (Villa Virginia) con dati hardcoded nel codice. La V1 è **congelata** (solo correzioni, nessuna nuova feature) e viene usata solo come riferimento per portare contenuti reali nella V2 — non toccarla.

**Villa Virginia** (slug `villavirginia`) è la struttura #1 della V2, di proprietà dell'account `bernardinocalifano@gmail.com`. È il caso reale su cui si sta validando tutta l'architettura prima di offrire il prodotto ad altri host.

Modello di business: piani Guida (14€/mese), Concierge (29€/mese), Portfolio (59€/mese) + fee di setup una tantum. È in corso una trattativa con un prospect Portfolio-tier (~12-13 unità).

## Stile e priorità di lavoro

- La persona che segue l'esecuzione giorno per giorno **non è una programmatrice** — quando fai modifiche, spiega in modo chiaro cosa hai fatto e perché, non solo cosa. Preferisci passi piccoli e verificabili a cambi grossi e opachi.
- Metodo di consegna: **incrementale**. Ogni funzionalità va portata a uno stato testabile (in locale o in produzione) prima di passare alla prossima, non si accumula lavoro non verificato.
- Tutto il codice, i nomi di tabelle/colonne/variabili e i testi visibili sono **in italiano**.
- Prima di aggiungere una sezione/contenuto nuovo, controlla se il pattern esiste già ed estendilo invece di duplicare (vedi "Pattern architetturali" sotto) — è un principio già seguito con successo più volte in questo progetto.

## Stack tecnico

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 (plugin `@tailwindcss/vite`) + React Router v7 (rotte annidate con `<Outlet context={...}>`)
- **Backend/DB**: Supabase (Postgres + Auth + RLS) — progetto separato dalla V1
- **Deploy**: Vercel, progetto `haplyhost`, collegato a GitHub `dinozzo-maker/haplyhost` (repo privata), auto-deploy su push a `main`. **Piano Hobby** (gratuito ma per uso non commerciale — va aggiornato a Pro prima di fatturare al primo cliente vero)
- **AI**: chiamate via `fetch` diretta, mai con SDK ufficiali (mantenere questo pattern per coerenza).
  - **Anthropic** (`https://api.anthropic.com/v1/messages`, header `x-api-key` + `anthropic-version: 2023-06-01`):
    `claude-haiku-4-5-20251001` per `api/traduci-guida.js`; `claude-sonnet-5` per la generazione
    descrizioni ("Casa da un link" / "Rigenera") in `lib/genera-descrizione-casa.js`. Gennarino può
    tornarci con `MOTORE_GENNARINO='claude'` (fallback spento).
  - **Google Gemini** (`gemini-3.1-flash-lite`, header `x-goog-api-key`): due endpoint diversi —
    Scout usa la **Interactions API** (`/v1beta/interactions`) per il grounding Google Maps;
    **Gennarino** (`api/gennarino.js`, `MOTORE_GENNARINO='gemini'`) usa **`generateContent`**
    (`/v1beta/models/<m>:generateContent`) perché serve chat multi-turno + `systemInstruction` e il
    frontend manda tutto lo storico. Vedi `Skill HaplyHost.md` §8.

## Struttura del repository

```
haplyhost/
├── api/                     ← funzioni serverless Vercel (Node). NON girano con `npm run dev`:
│   │                          si testano solo online, dopo push, su haplyhost.vercel.app
│   ├── gennarino.js         ← chat AI ospiti: legge struttura (incl. `note_gennarino`) + luoghi + pagine, logga su `domande`.
│   │                          DUE chiamate a `MODELLO_GEMINI` (`generateContent`; interruttore `MOTORE_GENNARINO`): 1) piccola,
│   │                          riconosce la lingua dell'ospite; 2) la risposta, con quella lingua come vincolo. Carattere napoletano
│   │                          nel system prompt (con esempi). `lang` dal body = ripiego. Strip `*`/`#` markdown.
│   ├── traduci-guida.js     ← SOLO owner: traduce con Haiku pagine (tutte) + luoghi senza traduzioni (en/fr/de/es) → `pagine.traduzioni` /
│   │                          `luoghi.traduzioni`. Chiamate a lotti di 4. `vercel.json` maxDuration 60. Pulsante in ModificaCasa.
│   ├── scout.js             ← cerca nuovi luoghi per una sezione, li salva in `proposte`. `RICERCHE_ATTIVE` (booleano,
│   │                          uguale in GestisciSezione.tsx): false → l'endpoint torna 503 senza chiamare AI.
│   │                          `MOTORE_SCOUT`: 'gemini' (in uso: Gemini 3.1 Flash-Lite + Maps grounding; prezzo e voto
│   │                          scritti nelle colonne `proposte.prezzo`/`voto`) | 'claude' (fallback spento: Haiku + web_search_20250305).
│   ├── importa-casa.js      ← crea una struttura nuova da {nome, indirizzo, link}: genera descrizione_casa + citta (via lib/), imposta attivo=true
│   ├── aggiorna-casa.js     ← rigenera descrizione_casa + citta da un nuovo link per una struttura esistente (verifica owner tramite access_token)
│   ├── host-autorizzati.js  ← SOLO superadmin (email === VITE_ADMIN_EMAIL): GET elenco, POST autorizza un'email + genera link
│   │                          di invito (supabase.auth.admin.generateLink), DELETE rimuove dall'elenco e prova a eliminare
│   │                          l'account Auth (fallisce di proposito se l'host ha già una struttura). Service role, tabella `host_autorizzati`.
│   └── sezioni-extra.js     ← SOLO superadmin: POST crea una sezione custom (genera slug da etichetta, rifiuta collisioni con
│                              le 14 di sistema / rotte riservate), DELETE la elimina. Tabella `sezioni_extra`, service role.
├── lib/
│   └── genera-descrizione-casa.js  ← codice condiviso da importa-casa.js e aggiorna-casa.js: legge il link, chiede a Claude {descrizione, citta}.
│                                     Sta FUORI da api/ apposta, così Vercel non lo tratta come un endpoint serverless.
├── src/
│   ├── main.tsx             ← entry point: BrowserRouter + StrictMode
│   ├── App.tsx              ← TUTTE le rotte generate da `useSezioni().tutte` (14 di sistema + custom). Non aggiungere rotte a mano per le sezioni
│   ├── index.css            ← `@import "tailwindcss"` + design system "g-*" della GUIDA OSPITI (token su .g-shell,
│   │                          non :root, così l'override inline di --g-accent fa ricalcolare i color-mix; dark via
│   │                          prefers-color-scheme). L'admin NON usa g-*: resta su utility Tailwind (reskin editoriale a parte).
│   ├── lingua.ts            ← multilingua guida ospiti: `Lingua`, `LINGUE`, `rilevaLingua()` (navigator.language + localStorage),
│   │                          `LinguaContext`/`useLingua()`, `campoTradotto()` (ripiego campo per campo su it), dizionario `T` dei testi fissi
│   ├── LinguaProvider.tsx   ← `<LinguaProvider>` (stato lingua + `<html lang>`); montato in Struttura.tsx. Diviso da lingua.ts per il fast-refresh
│   ├── SelettoreLingua.tsx  ← riga di 5 pastiglie (bandiera + sigla), reso in Home.tsx sotto la copertina (stile StayFlow). Non c'è sulle sottopagine: la scelta è ricordata
│   ├── supabaseClient.ts    ← client Supabase con anon key (sicuro lato browser)
│   ├── sezioni.ts           ← le 14 sezioni DI SISTEMA: {chiave, icona, etichetta, tipo, descrizione?} + `CHIAVI_BUILTIN` (Set)
│   │                          + `filtraVisibili(tutte, sezioni_attive)` (filtro guida, usato da Home/TabBar/GennarinoFab).
│   │                          tipo: 'elenco' (lista da tabella luoghi) | 'testo' (pagina da tabella pagine) | 'chat' (Gennarino)
│   ├── useSezioni.ts        ← hook: `SEZIONI` + righe di `sezioni_extra` (cache di modulo, 1 fetch/sessione, degrada se tabella assente).
│   │                          `invalidaCacheSezioni()` dopo crea/elimina RIALLINEA tutti i consumatori montati (pub/sub interno):
│   │                          serve perché App.tsx genera le rotte da qui e non si rimonta. Usato da App, Home, Admin, SezioniGuida.
│   ├── Struttura.tsx        ← rotta layout su /:slug — risolve lo slug in `strutture` (incl. `sezioni_attive`, `accento`, `copertina_url`).
│   │                          Rende `.g-shell` (con --g-accent inline) + <Outlet context> + <GennarinoFab> + <TabBar>
│   ├── TabBar.tsx           ← barra fissa in basso della guida: Home + prime 2 sezioni 'elenco' visibili + Gennarino
│   ├── GennarinoFab.tsx     ← bottone tondo galleggiante → /:slug/gennarino; nascosto sulla rotta chat o se la sezione chat è spenta
│   ├── Home.tsx             ← hero (gradiente o `copertina_url`) + griglia `.g-tile` da `filtraVisibili()` (esclusa la voce chat)
│   ├── SezionePage.tsx      ← sezioni 'elenco' — legge `luoghi` (+`prezzo`,`voto`,`categoria`); schede `.g-place` con pastiglie
│   ├── PaginaStatica.tsx    ← sezioni 'testo' — legge `pagine`; `.g-peek` + `.g-prose`. Sotto il testo, tasti "💬 WhatsApp" (verde
│   │                          #25D366 → wa.me) e "📞 Chiama" (colore accento → tel:) se `strutture.host_telefono` c'è E la pagina è
│   │                          `contatti` o nomina WhatsApp/telefono (`FRASI_TELEFONO`). Nel testo, i numeri di telefono diventano chip
│   │                          `tel:` (`.g-tel`); i codici brevi 112/118… solo nella pagina `emergenze`
│   ├── Gennarino.tsx        ← UI chat ospiti (`.g-chat`), chiama /api/gennarino, storico in stato React (nessuna persistenza)
│   └── admin/
│       ├── Login.tsx            ← login via magic link email (Supabase OTP, nessuna password). `shouldCreateUser: false`:
│       │                          si accede solo con un'email GIÀ esistente in Supabase Auth. Le nuove email si
│       │                          abilitano a mano (Dashboard Supabase → Authentication → Users → Invite / Add user).
│       ├── RichiedeLogin.tsx    ← guardia di autenticazione: verifica sessione E risolve la struttura di cui l'utente è owner_user_id, passa entrambi con <Outlet context>
│       ├── Admin.tsx            ← dashboard host: bottoni "Gestisci X" / "Modifica X" generati da `useSezioni()`. Se l'host non ha ancora una struttura, mostra <CreaStruttura />.
│       │                          Sezione "PIATTAFORMA" (solo se email === VITE_ADMIN_EMAIL): link a /admin/invita-host e /admin/sezioni-extra
│       ├── CreaStruttura.tsx    ← form onboarding (nome, indirizzo, link) → POST /api/importa-casa
│       ├── InvitaHost.tsx       ← rotta /admin/invita-host, SOLO superadmin: form (email, nome riferimento, piano, note) → POST /api/host-autorizzati
│       │                          → mostra il link di invito da copiare e mandare. Sotto, l'elenco degli host già autorizzati.
│       ├── ModificaCasa.tsx     ← rotta /admin/modifica-casa: form con TUTTI i dati struttura senza altro editor (nome, indirizzo,
│       │                          citta, descrizione_casa, host_nome, host_telefono, checkin, checkout, max_ospiti) → UPDATE diretto
│       │                          su `strutture` (RLS owner). Blocco "Aspetto della guida": 5 preset colore (`accento`) + foto
│       │                          copertina — "Carica foto" (upload su Storage bucket `copertine`, salva SUBITO `copertina_url`)
│       │                          o link incollato (in `<details>`, staged). Riquadro "Rigenera la descrizione" → POST /api/aggiorna-casa
│       ├── NoteGennarino.tsx     ← rotta /admin/note (link nel pannello): textarea `strutture.note_gennarino` → UPDATE diretto.
│       │                          Info pratiche libere per Gennarino, NON una sezione della guida
│       ├── DomandeOspiti.tsx     ← rotta /admin/domande (link nel pannello): elenco `domande` della struttura (cosa hanno chiesto
│       │                          gli ospiti a Gennarino), tap per vedere la risposta. Sola lettura (migration 0008)
│       ├── TraduciGuida.tsx      ← rotta /admin/traduzioni (link nel pannello): pulsante "Traduci la guida" → POST /api/traduci-guida
│       ├── SezioniGuida.tsx     ← rotta /admin/sezioni-guida: spunte "mostra nella guida" (sistema + custom) → UPDATE `strutture.sezioni_attive`.
│       │                          Filtra SOLO la guida ospiti (Home.tsx), non il pannello. NULL = tutte le sistema, custom escluse.
│       ├── SezioniExtra.tsx     ← rotta /admin/sezioni-extra, SOLO superadmin: crea/elimina sezioni custom (etichetta, icona via
│       │                          selettore emoji, descrizione, tipo testo|elenco, categoria per Scout se elenco) → POST/DELETE /api/sezioni-extra.
│       ├── GestisciSezione.tsx  ← UNICO componente riusato per tutte e 7 le sezioni 'elenco': elenco luoghi con toggle attivo/spento,
│       │                          modifica inline + "Elimina questo luogo" (DELETE, dentro la modifica), "+ Aggiungi un luogo a mano"
│       │                          (INSERT), "Cerca nuovi luoghi" (Scout) + proposte da Accettare/Rifiutare. Campi condivisi modifica/nuovo:
│       │                          <CampiLuogo> (nome/descrizione/distanza/prezzo/voto/maps/telefono)
│       └── GestisciPagina.tsx   ← UNICO componente riusato per tutte e 6 le sezioni 'testo': editor titolo+contenuto su `pagine`
```

## Pattern architetturali importanti

1. **Le sezioni si iterano da `useSezioni().tutte`**, non da `SEZIONI` direttamente. `SEZIONI` (in `sezioni.ts`) sono le 14 di sistema; `useSezioni()` le unisce alle righe di `sezioni_extra` (custom del superadmin). `App.tsx`, `Home.tsx`, `Admin.tsx`, `SezioniGuida.tsx` generano rotte/bottoni da `tutte`. Una sezione di sistema nuova = una riga in `sezioni.ts`; una sezione custom = riga in `sezioni_extra` (dalla pagina `/admin/sezioni-extra`). Non toccare le rotte a mano. `App.tsx` ha una rotta `*` sotto `/admin` che tiene gli URL `/admin/...` sconosciuti dentro il pannello (loading → redirect a `/admin`) invece di farli cadere sulla rotta ospite `/:slug`.
2. **Multi-tenancy lato host**: `RichiedeLogin.tsx` risolve `struttura` a partire da `owner_user_id = auth.uid()` e la passa via `Outlet context` a tutte le pagine `/admin/*`. Nessun componente admin deve cercare una struttura per slug fisso — oggi ogni host ha **una sola struttura** (nessuna tabella ponte per host multi-proprietà, da aggiungere se servirà).
3. **Multi-tenancy lato ospite**: `Struttura.tsx` risolve la struttura dallo `:slug` nell'URL, la passa via `Outlet context` a `Home`, `SezionePage`, `PaginaStatica`, `Gennarino`.
4. **Componenti generici parametrizzati**, non uno per sezione: `GestisciSezione` prende `{sezione, etichetta}`, `GestisciPagina` prende `{chiave, etichetta}`, `PaginaStatica` prende `{chiave}`. Estendere questi invece di crearne di nuovi.
5. Le funzioni in `/api` che devono scrivere bypassando l'RLS (log domande, creazione struttura durante onboarding, lettura cross-tenant) usano `SUPABASE_SERVICE_ROLE_KEY`. Le funzioni normali del frontend usano sempre la anon key.

## Schema database (Postgres/Supabase)

```sql
strutture (
  id uuid pk, slug text unique, nome text, indirizzo text, citta text,
  lat numeric, lng numeric, checkin text, checkout text, max_ospiti int,
  host_nome text, host_telefono text, descrizione_casa text,
  regole text,            -- probabilmente vestigiale: il contenuto "Regole Casa" reale vive in pagine.chiave='regole'
  sezioni_attive jsonb,   -- migration 0003: array delle chiavi sezione da mostrare in guida. NULL = tutte
  accento text,           -- migration 0005: colore d'accento della guida (hex). NULL = teal di default
  copertina_url text,     -- migration 0005: link immagine hero. NULL = gradiente dal colore accento
  note_gennarino text,    -- migration 0007: testo libero dell'host, solo per il prompt di Gennarino (non è una sezione guida)
  attivo boolean, creato_il timestamptz,
  owner_user_id uuid references auth.users(id) on delete set null   -- ON DELETE SET NULL da migration 0002:
  --   cancellare un utente Auth NON cancella/blocca la sua struttura (diventa senza proprietario)
  -- ⚠️ link_riferimento: documentata in passato ma NON presente nel DB reale (verificato 30/08/2026).
  --    Il codice NON deve leggerla/scriverla finché non viene aggiunta con un ALTER TABLE.
)

strutture_segreti (
  struttura_id uuid pk references strutture(id) on delete cascade,
  wifi_rete text, wifi_password text
  -- RLS abilitata, NESSUNA policy di select: raggiungibile solo lato server con service role
)

luoghi (
  id uuid pk, struttura_id uuid references strutture(id) on delete cascade,
  sezione text, nome text, icona text, etichetta text, categoria text,
  descrizione text, distanza text, maps text, telefono text,
  prezzo text, voto text,   -- migration 0005: fascia di prezzo (es. "15-25 €") e voto Google (es. "4,5"), da Scout
  ordine int, attivo boolean, traduzioni jsonb, da_tradurre boolean
)
-- index (struttura_id, sezione, ordine)
-- ⚠️ distanza: i dati reali importati da V1 hanno già l'emoji dentro il testo (es. "🚶 7 min a piedi").
--    Il frontend NON deve aggiungere un'altra icona davanti.
-- traduzioni: { en: {...}, fr: {...}, de: {...}, es: {...} } — NIENTE chiave `it` (l'italiano è la colonna).
--    Campi per lingua NON uniformi tra righe (alcune {descrizione,categoria,distanza}, altre {descrizione,etichetta}):
--    leggere con campoTradotto() che fa ripiego campo per campo. `nome` non si traduce mai. `da_tradurre` è vestigiale.
--    53/69 righe di Villa Virginia tradotte (import V1); le altre le riempie api/traduci-guida.js.

annunci (struttura_id, testo, attivo, creato_il)     -- non ancora usata dal frontend V2
eventi  (struttura_id, data, titolo, descrizione, attivo)  -- non ancora usata dal frontend V2
soggiorni (struttura_id, nome, checkin, checkout, con_bambini)  -- non ancora usata; serve per il Wi-Fi legato al soggiorno (feature pendente)
domande (id uuid pk, struttura_id, domanda, risposta, lang default 'it', creato_il)  -- log Gennarino, scritto da api/gennarino.js con service role (lang = lingua rilevata). RLS: SELECT per l'host della struttura (migration 0008)

pagine (
  id uuid pk, struttura_id uuid references strutture(id) on delete cascade,
  chiave text, titolo text, contenuto text, traduzioni jsonb,   -- traduzioni: { en:{titolo,contenuto}, fr:{...}, ... }, popolato da api/traduci-guida.js
  unique (struttura_id, chiave)
)

proposte (   -- output di Scout, in attesa di approvazione host
  id uuid pk, struttura_id uuid references strutture(id) on delete cascade,
  sezione text, nome text, descrizione text, distanza text, maps text, telefono text,
  prezzo text, voto text,   -- migration 0005: come luoghi; copiati nel luogo quando l'host accetta la proposta
  creato_il timestamptz
)

host_autorizzati (   -- email autorizzate dal superadmin a diventare host (vedi supabase/migrations/0001)
  email text pk, nome_riferimento text, piano text,   -- piano: 'guida' | 'concierge' | 'portfolio'
  note text, autorizzato_il timestamptz default now(),
  registrato_il timestamptz   -- popolato quando l'host crea la struttura (Incremento B, non ancora fatto)
  -- RLS on, zero policy: solo server-side con service role, via api/host-autorizzati.js
)

sezioni_extra (   -- sezioni della guida create dal superadmin, oltre alle 14 di sistema (migration 0004)
  chiave text pk,   -- slug generato dall'etichetta
  icona text default '📄', etichetta text, descrizione text,
  tipo text default 'testo',   -- 'testo' (usa pagine) | 'elenco' (usa luoghi + Scout)
  categoria text,   -- solo per 'elenco': termine di ricerca per Scout
  ordine int default 100, creato_il timestamptz default now()
  -- RLS on: SELECT pubblico (serve a ogni guida); scrittura solo via api/sezioni-extra.js con service role
)
```

**Policy RLS attuali (stato finale, non cronologia):**
- `strutture`: SELECT pubblico (anon+authenticated) dove `attivo=true`; UPDATE per `authenticated` dove `owner_user_id = auth.uid()`
- `strutture_segreti`: RLS on, zero policy — accesso solo server-side con service role
- `luoghi`: SELECT pubblico dove `attivo=true` **+** una policy `for all` per `authenticated` scoped a `struttura_id in (select id from strutture where owner_user_id = auth.uid())`
- `pagine`: SELECT pubblico senza restrizioni **+** policy `for all` per `authenticated` scoped come sopra
- `proposte`: solo la policy scoped per `authenticated` come sopra, nessun accesso pubblico
- `domande`: RLS on; SELECT per `authenticated` scoped a `struttura_id in (select id from strutture where owner_user_id = auth.uid())` (migration 0008). Scrittura solo service role (api/gennarino.js). Nessun accesso anon.
- `soggiorni`: SELECT pubblico solo per la riga dove `current_date` è tra `checkin` e `checkout` (privacy: non si vedono soggiorni passati/futuri)
- `sezioni_extra`: SELECT pubblico senza restrizioni; nessuna policy di scrittura (solo service role via API)
- **Storage** `storage.objects` (migration 0006): bucket `copertine` (public), INSERT/UPDATE/DELETE per `authenticated` dove `bucket_id='copertine'` (non scoped per host: un host solo oggi), SELECT pubblico. Le foto di copertina delle guide.

`supabase/migrations/`: `0001_host_autorizzati.sql`, `0002_strutture_owner_on_delete_set_null.sql`
(FK owner_user_id → SET NULL), `0003_strutture_sezioni_attive.sql` (colonna `sezioni_attive`),
`0004_sezioni_extra.sql` (tabella sezioni custom), `0005_guida_grafica.sql` (colonne `strutture.accento`
+ `strutture.copertina_url`, `luoghi.prezzo` + `luoghi.voto`, `proposte.prezzo` + `proposte.voto`;
lanciata su Supabase 03/09/2026), `0006_storage_copertine.sql` (bucket Storage pubblico `copertine`
+ policy su `storage.objects`: INSERT/UPDATE/DELETE per `authenticated`, SELECT pubblico; per il
pulsante "Carica foto" in ModificaCasa), `0007_note_gennarino.sql` (colonna `strutture.note_gennarino`,
letta da `api/gennarino.js` — SQL prima del push), `0008_domande_lettura_host.sql` (RLS su `domande` +
policy SELECT per l'host, per la pagina `/admin/domande`). Lo schema sopra resta la fonte di verità scritta;
restano NON tracciati la colonna `link_riferimento` e la policy RLS `strutture` per owner. Da qui in
avanti ogni `ALTER TABLE` / `CREATE POLICY` va in un file numerato lì dentro. ⚠️ Quando una migration
aggiunge una colonna che il codice nuovo **legge in una `select`** (es. 0003), lanciare l'SQL
**prima** del push, o la pagina va in 400. Se invece il codice degrada da solo se la tabella manca
(es. 0004 via `useSezioni`), l'ordine è meno critico.

## Variabili d'ambiente

| Nome | Dove | Uso |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` + Vercel (tutti gli env, tipo Config) | client Supabase browser |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` + Vercel (tutti gli env, tipo Config) | client Supabase browser |
| `SUPABASE_SERVICE_ROLE_KEY` | solo Vercel (tipo Secret) | usata in tutte le `/api/*.js` che bypassano RLS |
| `ANTHROPIC_API_KEY` | solo Vercel (tipo Secret) | `lib/genera-descrizione-casa.js`, `api/traduci-guida.js`; `gennarino.js`/`scout.js` solo se il rispettivo `MOTORE_*='claude'` |
| `GEMINI_API_KEY` | `.env.local` + Vercel (tipo Secret) | `scout.js` (Interactions + Maps grounding); ripiego per `gennarino.js` |
| `GEMINI_API_KEY_GENNARINO` | solo Vercel (tipo Secret) | chiave Gemini dedicata a `gennarino.js` (`generateContent`). Se assente → usa `GEMINI_API_KEY` |
| `VITE_ADMIN_EMAIL` | `.env.local` + Vercel (tutti gli env, tipo Config) | email del superadmin. Frontend (`import.meta.env`) per mostrare la sezione "Invita host"; `api/host-autorizzati.js` (`process.env`) come vera guardia |

I valori reali vanno letti da `.env.local` (locale, gitignored) o dal dashboard Vercel — non richiederli/riscriverli qui.

## Testare le modifiche

- Solo frontend (componenti in `src/`, non `/api`): `npm run dev`, testare in locale prima del push. `npm run dev` punta comunque al Supabase remoto (non c'è un DB locale): una migration che aggiunge colonne lette in `select` va lanciata prima anche per i test locali.
- `vite.config.ts` legge `process.env.PORT` (default 5173): serve solo a poter avviare un secondo dev server su un'altra porta quando 5173 è occupata. Ininfluente per il build/deploy.
- Qualsiasi modifica a `/api/*.js` o `/lib/*.js`: **non testabile in locale**, `npm run dev` non esegue le funzioni serverless. Serve fare push e testare su `https://haplyhost.vercel.app/...` dopo che Vercel ha ridistribuito (circa un minuto).
- Trio standard di pubblicazione, sempre dalla radice del progetto: `git add .` / `git commit -m "..."` / `git push`. **Controllare sempre la cartella corrente prima**: in passato comandi git sono stati lanciati per errore da dentro `src/admin` o da una cartella `admin` vuota creata per sbaglio nella radice — questo fa sì che `git add .` non veda affatto le cartelle `api/` e `lib/`, con file mancanti nel push senza errori evidenti.
- Su Supabase SQL Editor può comparire un popup "Potential issue detected... enable RLS?": scegliere **"Run without RLS"** per script che fanno solo INSERT/UPDATE su tabelle esistenti; **"Run and enable RLS"** solo quando lo script contiene dei veri `CREATE TABLE`.
- Incidente noto: quel popup ha causato l'esecuzione doppia di uno script di import, duplicando 55 righe in `luoghi` — dopo un import massivo, controllare sempre il conteggio righe atteso.

## Costi AI (incidente 31/08/2026)

L'account Anthropic è andato a saldo negativo (−0,37 USD) → tutte le funzioni AI ferme per qualche
ora (Gennarino V1 e V2, Scout, generazione descrizioni). Causa: account con poco credito iniziale +
una giornata di sviluppo pesante su Claude Sonnet 5 (Scout con ricerca web, "Casa da un link",
"Rigenera", retry). La V1 "StayFlow" (ancora live) è un consumo di sfondo minore, non la causa.

Mitigazioni fatte:
- Scout **spostato da Claude a Gemini 3.1 Flash-Lite + Google Maps grounding** (`MOTORE_SCOUT='gemini'`
  in `scout.js`). Costo ~1/10, grounding gratis fino a 5.000/mese. Il motore Claude resta nel file,
  spento (`MOTORE_SCOUT='claude'`). Scout riattivato (`RICERCHE_ATTIVE = true`).
- `vercel.json`: `maxDuration: 60` per `api/scout.js` (le chiamate Gemini+grounding durano ~10-18s).

Mitigazioni da fare (in ordine): ricarica automatica Anthropic + tetto di spesa sulla Console;
workspace/chiave API separati per sviluppo vs produzione; cache del prompt + tetto a `domanda`/`storico`
in `gennarino.js` (oggi il system prompt con 55 luoghi + 6 pagine riparte intero a ogni messaggio, e
`storico` è illimitato e controllato dal chiamante su un endpoint pubblico); cache 24h su
`/api/consiglio` della V1; rigenerare la `GEMINI_API_KEY` (passata in chat il 01/09).

## Stato attuale (fine agosto 2026)

**Funzionante e pubblicato:**
- Routing multi-struttura da slug, con le 13 tessere della griglia (7 elenco + 6 testo)
- Contenuti reali di Villa Virginia importati da StayFlow V1 (55 luoghi + 6 pagine testuali)
- Gennarino: chat AI grounded sui dati reali della struttura, markdown disabilitato nel prompt, log su `domande`
- Pannello host: login magic-link, gestione on/off + modifica/elimina/**aggiungi a mano** luoghi su tutte le sezioni elenco (con distanza in lista), editor per le pagine testuali, link "Vedi la guida degli ospiti", pagina "Sezioni della guida" (scegli quali tessere mostrare agli ospiti — `strutture.sezioni_attive`)
- **Sezioni custom del superadmin**: pagina `/admin/sezioni-extra` (solo superadmin) per creare/eliminare sezioni oltre le 14 di sistema, tipo testo o elenco. Vivono in `sezioni_extra`, si uniscono ovunque via `useSezioni()`, nascono spente per tutti gli host. **Prerequisito prod: migration 0004.**
- Scout: ricerca nuovi luoghi con approvazione/rifiuto. Su Gemini + Maps grounding (`MOTORE_SCOUT`), riattivato. Restituisce anche prezzo e voto Google (colonne `proposte.prezzo`/`voto`, copiati nel luogo all'accettazione). Errori/esito veri mostrati nel pannello. **Prerequisito prod: `GEMINI_API_KEY` su Vercel.**
- **Reskin della guida ospiti** (migration 0005, verificato in prod 03/09/2026): design system "g-*" in `src/index.css` (spirito StayFlow: Nunito, hero, griglia emoji, barra in basso `TabBar`, FAB `GennarinoFab`, modalità chiara/scura). Due leve per l'host in ModificaCasa: colore d'accento (`strutture.accento`, 5 preset, iniettato come `--g-accent` inline sullo `.g-shell`) e foto di copertina — **"Carica foto"** (upload su Storage bucket `copertine`, migration 0006) o link incollato. Schede luogo con pastiglie prezzo/voto (`luoghi.prezzo`/`voto` da Scout). Selettore emoji in SezioniExtra. "+ Aggiungi un luogo a mano" in GestisciSezione. Il pannello admin resta su Tailwind grezzo (reskin editoriale rimandato). "Il consiglio di oggi": rimandato.
- **Multilingua della guida ospiti** (IT/EN/FR/DE/ES, nessuna migration): all'apertura la guida si mette nella lingua del telefono (`navigator.language`), con selettore 🌐 in alto a destra (scelta ricordata in localStorage). Testi fissi da un dizionario (`src/lingua.ts` `T`); luoghi da `luoghi.traduzioni` con ripiego all'italiano; etichette sezioni tradotte (solo le 14 di sistema — le custom restano in italiano). Gennarino risponde nella lingua dell'ospite (`api/gennarino.js` accetta `lang`). Le pagine di testo e i luoghi senza traduzione si riempiono con **"Traduci la guida"** in ModificaCasa → `api/traduci-guida.js` (Haiku). Verificato frontend in locale 03/09/2026.
- Base multi-tenant: `owner_user_id`, RLS scoped per host, un host vede/modifica solo la propria struttura
- "Casa da un link": creazione struttura da {nome, indirizzo, link}, con generazione automatica di `descrizione_casa` + `citta`, struttura creata con `attivo=true`. Testato con successo anche con un annuncio Airbnb.
- **"Modifica Casa"** (`src/admin/ModificaCasa.tsx` + `api/aggiorna-casa.js` + `lib/genera-descrizione-casa.js`, rotta `/admin/modifica-casa`, pulsante nel pannello): l'host modifica tutti i dati della struttura (nome, indirizzo, citta, descrizione_casa, host_nome, host_telefono, checkin, checkout, max_ospiti) con UPDATE diretto, e può rigenerare descrizione+citta da un nuovo link. Testato in produzione 30/08/2026.
- Gennarino ora include nella knowledge base anche `descrizione_casa`, `host_telefono`, `max_ospiti` (prima `descrizione_casa` non era usata da nessuno). Verificato: risponde con i dettagli della casa presi da `descrizione_casa`.

**Gate registrazione host + invito superadmin (pubblicato, testato in prod 31/08/2026):**
- `Login.tsx` con `shouldCreateUser: false` — si accede solo con email già in Supabase Auth. Email sconosciuta → messaggio, non il link.
- **Invito host**: tabella `host_autorizzati` + `api/host-autorizzati.js` (GET/POST/DELETE) + `src/admin/InvitaHost.tsx` (rotta `/admin/invita-host`, link "PIATTAFORMA" nel pannello solo se `email === VITE_ADMIN_EMAIL`). Il superadmin autorizza un'email, genera il link di invito, e può rimuovere un host dall'elenco (il "Rimuovi" prova anche a eliminare l'account Auth, salta se ha già una struttura).
- Serve `VITE_ADMIN_EMAIL` su Vercel + `.env.local` = email del superadmin (oggi `bernardinocalifano@gmail.com`, che possiede Villa Virginia).
- **Incremento B non ancora fatto**: `importa-casa.js` non verifica `host_autorizzati` né popola `registrato_il` — oggi il vero blocco è solo `shouldCreateUser: false` a livello di login.

**Debiti tecnici aperti:**
- Colonna `strutture.link_riferimento`: documentata ma NON presente nel DB reale. Il codice non la tocca più. Da aggiungere con `ALTER TABLE` (in una migration) + reintrodurre in ModificaCasa/importa-casa/aggiorna-casa per ricordare l'ultimo link usato.
- Nessuna policy RLS `strutture` SELECT per `authenticated` scoped su `owner_user_id`: oggi l'host trova la propria struttura solo grazie alla policy pubblica `attivo=true`. Se una struttura viene spenta, l'host non la vede più nel pannello.

**Non ancora iniziato:**
- **Raggio di ricerca per Scout**: `scout.js` oggi dice solo "vicino a questo indirizzo". Aggiungere un selettore di distanza/raggio in `GestisciSezione` passato a `scout.js` e messo nel prompt.
- **Sezioni custom, follow-up**: modifica di una sezione custom esistente dalla UI (per ora solo elimina+ricrea); riordino da UI
  (per ora campo `ordine` solo via SQL); assegnare una sezione custom solo a certi host; pulizia righe `pagine`/`luoghi` orfane
  dopo l'eliminazione di una sezione.
- **Onboarding v2** (gate + "Invita host" + scelta sezioni host [b] fatti — qui resta il seguito):
  - (a) Incremento B: `importa-casa.js` verifica `host_autorizzati` e popola `registrato_il`; stato "registrato" mostrato in InvitaHost.
  - (c) opzionale: struttura pre-compilata nell'invito (nome/indirizzo già in `host_autorizzati`), e/o Scout di partenza solo
    per 2-3 sezioni chiave lanciato una alla volta dal frontend (ogni Scout ~10-18s).
- Wi-Fi legato al soggiorno attivo (tabelle `strutture_segreti` e `soggiorni` pronte, nessuna UI/logica costruita)
- Multilingua, follow-up: traduzione delle etichette delle sezioni **custom** (`sezioni_extra`, oggi solo italiano); segnale di "traduzione da rifare" quando l'host modifica una pagina/luogo già tradotto (oggi si rilancia "Traduci la guida" a mano e riscrive tutto).
- Ottimizzazione foto di copertina: l'upload (`ModificaCasa` → bucket `copertine`) non ridimensiona l'immagine — un JPEG da telefono può essere pesante. Client-side resize (canvas) prima dell'upload, tetto attuale 5 MB. Le trasformazioni immagine di Supabase richiedono il piano Pro. Pulizia dei file orfani non fatta.
- Visualizzazione dei sotto-blocchi "Aperitivi" e "Stellati" dentro la pagina "Dove Mangiare" (dati presenti in `luoghi` con quelle sezioni, nessuna UI dedicata — oggi sarebbero raggiungibili solo con un URL manuale tipo `/villavirginia/aperitivi`, non linkato da nessuna parte)
- **Reskin del pannello admin**: la guida ospiti è riskinnata (design system `g-*`); l'admin resta su Tailwind grezzo. Serve un impianto grafico dedicato più sobrio/editoriale (mockup "v2" già approvato a voce), separato da `g-*`.
- **"Il consiglio di oggi"**: c'era nel mockup del reskin (chiamata AI a costo), rimosso su richiesta. Da riprendere quando c'è budget AI e cache.
- Passaggio da Vercel Hobby a Pro (obbligatorio prima di fatturare a un cliente vero, per via dei termini d'uso non-commerciali del piano gratuito)
- Gestione di un host con più strutture (oggi il modello presume una struttura per host)
