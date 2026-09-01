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
    `claude-haiku-4-5-20251001` per Gennarino; `claude-sonnet-5` per la generazione descrizioni
    ("Casa da un link" / "Rigenera") in `lib/genera-descrizione-casa.js`.
  - **Google Gemini** (`https://generativelanguage.googleapis.com/v1beta/interactions` — la nuova
    Interactions API, non `generateContent`; header `x-goog-api-key`): `gemini-3.1-flash-lite` +
    grounding Google Maps per Scout (`scout.js`). Vedi `Skill HaplyHost.md` §8 per i dettagli
    (dove sta il testo nella risposta, il 429 sul grounding di ricerca, ecc.).

## Struttura del repository

```
haplyhost/
├── api/                     ← funzioni serverless Vercel (Node). NON girano con `npm run dev`:
│   │                          si testano solo online, dopo push, su haplyhost.vercel.app
│   ├── gennarino.js         ← chat AI ospiti: legge struttura (descrizione_casa, contatti host, max_ospiti) + luoghi + pagine, chiama Claude, logga su `domande`
│   ├── scout.js             ← cerca nuovi luoghi per una sezione, li salva in `proposte`. `RICERCHE_ATTIVE` (booleano,
│   │                          uguale in GestisciSezione.tsx): false → l'endpoint torna 503 senza chiamare AI.
│   │                          `MOTORE_SCOUT`: 'gemini' (in uso: Gemini 3.1 Flash-Lite + Maps grounding, prezzo+voto
│   │                          uniti alla descrizione) | 'claude' (fallback spento: Haiku + web_search_20250305).
│   ├── importa-casa.js      ← crea una struttura nuova da {nome, indirizzo, link}: genera descrizione_casa + citta (via lib/), imposta attivo=true
│   ├── aggiorna-casa.js     ← rigenera descrizione_casa + citta da un nuovo link per una struttura esistente (verifica owner tramite access_token)
│   └── host-autorizzati.js  ← SOLO superadmin (email === VITE_ADMIN_EMAIL): GET elenco, POST autorizza un'email + genera link
│                              di invito (supabase.auth.admin.generateLink), DELETE rimuove dall'elenco e prova a eliminare
│                              l'account Auth (fallisce di proposito se l'host ha già una struttura). Service role, tabella `host_autorizzati`.
├── lib/
│   └── genera-descrizione-casa.js  ← codice condiviso da importa-casa.js e aggiorna-casa.js: legge il link, chiede a Claude {descrizione, citta}.
│                                     Sta FUORI da api/ apposta, così Vercel non lo tratta come un endpoint serverless.
├── src/
│   ├── main.tsx             ← entry point: BrowserRouter + StrictMode
│   ├── App.tsx              ← TUTTE le rotte sono generate qui a partire da sezioni.ts (non aggiungere rotte a mano per le sezioni)
│   ├── supabaseClient.ts    ← client Supabase con anon key (sicuro lato browser)
│   ├── sezioni.ts           ← FONTE UNICA DI VERITÀ per le 13 tessere della home: {chiave, icona, etichetta, tipo}.
│   │                          tipo: 'elenco' (lista da tabella luoghi) | 'testo' (pagina da tabella pagine) | 'chat' (Gennarino)
│   ├── Struttura.tsx        ← rotta layout su /:slug — risolve lo slug in una riga `strutture`, la passa giù con <Outlet context>
│   ├── Home.tsx             ← griglia delle 13 tessere, legge SEZIONI da sezioni.ts
│   ├── SezionePage.tsx      ← pagina generica per sezioni tipo 'elenco' — legge `luoghi` filtrando su struttura_id+sezione+attivo
│   ├── PaginaStatica.tsx    ← pagina generica per sezioni tipo 'testo' — legge `pagine` filtrando su struttura_id+chiave
│   ├── Gennarino.tsx        ← UI chat ospiti, chiama /api/gennarino, storico conversazione in stato React (nessuna persistenza)
│   └── admin/
│       ├── Login.tsx            ← login via magic link email (Supabase OTP, nessuna password). `shouldCreateUser: false`:
│       │                          si accede solo con un'email GIÀ esistente in Supabase Auth. Le nuove email si
│       │                          abilitano a mano (Dashboard Supabase → Authentication → Users → Invite / Add user).
│       ├── RichiedeLogin.tsx    ← guardia di autenticazione: verifica sessione E risolve la struttura di cui l'utente è owner_user_id, passa entrambi con <Outlet context>
│       ├── Admin.tsx            ← dashboard host: bottoni "Gestisci X" / "Modifica X" generati da sezioni.ts. Se l'host non ha ancora una struttura, mostra <CreaStruttura /> invece del pannello.
│       │                          Sezione "PIATTAFORMA" con link a /admin/invita-host mostrata solo se email utente === VITE_ADMIN_EMAIL
│       ├── CreaStruttura.tsx    ← form onboarding (nome, indirizzo, link) → POST /api/importa-casa
│       ├── InvitaHost.tsx       ← rotta /admin/invita-host, SOLO superadmin: form (email, nome riferimento, piano, note) → POST /api/host-autorizzati
│       │                          → mostra il link di invito da copiare e mandare. Sotto, l'elenco degli host già autorizzati.
│       ├── ModificaCasa.tsx     ← rotta /admin/modifica-casa: form con TUTTI i dati struttura senza altro editor (nome, indirizzo,
│       │                          citta, descrizione_casa, host_nome, host_telefono, checkin, checkout, max_ospiti) → UPDATE diretto
│       │                          su `strutture` (RLS owner). Riquadro separato "rigenera descrizione da un link" → POST /api/aggiorna-casa
│       ├── GestisciSezione.tsx  ← UNICO componente riusato per tutte e 7 le sezioni 'elenco': elenco luoghi con toggle attivo/spento,
│       │                          modifica inline (nome/descrizione/distanza/maps/telefono) + "Elimina questo luogo" (DELETE, dentro la
│       │                          modifica), pulsante "Cerca nuovi luoghi" (Scout) + lista proposte da Accettare/Rifiutare
│       └── GestisciPagina.tsx   ← UNICO componente riusato per tutte e 6 le sezioni 'testo': editor titolo+contenuto su `pagine`
```

## Pattern architetturali importanti

1. **`sezioni.ts` è l'unica fonte di verità** per le sezioni della griglia. `App.tsx`, `Home.tsx` e `Admin.tsx` generano rotte/bottoni iterando su quell'array. Per aggiungere una sezione nuova: basta una riga in `sezioni.ts`, non serve toccare le rotte a mano.
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
  ordine int, attivo boolean, traduzioni jsonb, da_tradurre boolean
)
-- index (struttura_id, sezione, ordine)
-- traduzioni: JSON multi-lingua già importato da V1 (IT/EN/FR/DE/ES) e validato;
-- ispezionare una riga reale per la struttura esatta delle chiavi prima di costruire il selettore lingua

annunci (struttura_id, testo, attivo, creato_il)     -- non ancora usata dal frontend V2
eventi  (struttura_id, data, titolo, descrizione, attivo)  -- non ancora usata dal frontend V2
soggiorni (struttura_id, nome, checkin, checkout, con_bambini)  -- non ancora usata; serve per il Wi-Fi legato al soggiorno (feature pendente)
domande (struttura_id, domanda, risposta, lang default 'it', creato_il)  -- log Gennarino, scritto da api/gennarino.js con service role

pagine (
  id uuid pk, struttura_id uuid references strutture(id) on delete cascade,
  chiave text, titolo text, contenuto text, traduzioni jsonb,
  unique (struttura_id, chiave)
)

proposte (   -- output di Scout, in attesa di approvazione host
  id uuid pk, struttura_id uuid references strutture(id) on delete cascade,
  sezione text, nome text, descrizione text, distanza text, maps text, telefono text,
  creato_il timestamptz
)

host_autorizzati (   -- email autorizzate dal superadmin a diventare host (vedi supabase/migrations/0001)
  email text pk, nome_riferimento text, piano text,   -- piano: 'guida' | 'concierge' | 'portfolio'
  note text, autorizzato_il timestamptz default now(),
  registrato_il timestamptz   -- popolato quando l'host crea la struttura (Incremento B, non ancora fatto)
  -- RLS on, zero policy: solo server-side con service role, via api/host-autorizzati.js
)
```

**Policy RLS attuali (stato finale, non cronologia):**
- `strutture`: SELECT pubblico (anon+authenticated) dove `attivo=true`; UPDATE per `authenticated` dove `owner_user_id = auth.uid()`
- `strutture_segreti`: RLS on, zero policy — accesso solo server-side con service role
- `luoghi`: SELECT pubblico dove `attivo=true` **+** una policy `for all` per `authenticated` scoped a `struttura_id in (select id from strutture where owner_user_id = auth.uid())`
- `pagine`: SELECT pubblico senza restrizioni **+** policy `for all` per `authenticated` scoped come sopra
- `proposte`: solo la policy scoped per `authenticated` come sopra, nessun accesso pubblico
- `soggiorni`: SELECT pubblico solo per la riga dove `current_date` è tra `checkin` e `checkout` (privacy: non si vedono soggiorni passati/futuri)

`supabase/migrations/`: `0001_host_autorizzati.sql` (tabella host autorizzati),
`0002_strutture_owner_on_delete_set_null.sql` (FK owner_user_id → SET NULL). Lo schema sopra resta
la fonte di verità scritta; restano NON tracciati come migrazioni la colonna `link_riferimento` e la
policy RLS `strutture` per owner. Da qui in avanti ogni `ALTER TABLE` / `CREATE POLICY` va messo in
un file numerato lì dentro, non eseguito ad-hoc e perso nella chat.

## Variabili d'ambiente

| Nome | Dove | Uso |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` + Vercel (tutti gli env, tipo Config) | client Supabase browser |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` + Vercel (tutti gli env, tipo Config) | client Supabase browser |
| `SUPABASE_SERVICE_ROLE_KEY` | solo Vercel (tipo Secret) | usata in tutte le `/api/*.js` che bypassano RLS |
| `ANTHROPIC_API_KEY` | solo Vercel (tipo Secret) | gennarino.js, lib/genera-descrizione-casa.js, e scout.js solo se `MOTORE_SCOUT='claude'` |
| `GEMINI_API_KEY` | `.env.local` + Vercel (tipo Secret) | `scout.js` — motore Scout attuale (Gemini + Maps grounding) |
| `VITE_ADMIN_EMAIL` | `.env.local` + Vercel (tutti gli env, tipo Config) | email del superadmin. Frontend (`import.meta.env`) per mostrare la sezione "Invita host"; `api/host-autorizzati.js` (`process.env`) come vera guardia |

I valori reali vanno letti da `.env.local` (locale, gitignored) o dal dashboard Vercel — non richiederli/riscriverli qui.

## Testare le modifiche

- Solo frontend (componenti in `src/`, non `/api`): `npm run dev`, testare in locale prima del push.
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
- Pannello host: login magic-link, gestione on/off + modifica testi su tutte le sezioni elenco (con distanza visibile in lista), editor per tutte le pagine testuali, link "Vedi la guida degli ospiti" (apre `/:slug` in nuova scheda)
- Scout: ricerca nuovi luoghi con approvazione/rifiuto. Su Gemini + Maps grounding (`MOTORE_SCOUT`), riattivato. Restituisce anche prezzo e voto Google (uniti alla descrizione). Errori/esito veri mostrati nel pannello. **Prerequisito prod: `GEMINI_API_KEY` su Vercel.**
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
- **Aggiunta manuale di un luogo** dal pannello: `GestisciSezione.tsx` ora permette toggle/modifica/**elimina** di luoghi esistenti e accetta/rifiuta proposte Scout — manca ancora un pulsante "aggiungi luogo a mano" (INSERT su `luoghi`). Frontend puro.
- **Raggio di ricerca per Scout**: `scout.js` oggi dice solo "vicino a questo indirizzo". Aggiungere un selettore di distanza/raggio in `GestisciSezione` passato a `scout.js` e messo nel prompt.
- **Onboarding v2** (il gate + la pagina "Invita host" sono fatti, vedi sopra — qui resta il seguito):
  - (a) Incremento B: `importa-casa.js` verifica `host_autorizzati` e popola `registrato_il`; stato "registrato" mostrato in InvitaHost.
  - (b) alla prima installazione l'host sceglie quali delle 13 sezioni includere nella guida (serve `strutture.sezioni_attive`
    jsonb o simile — oggi le 13 tessere sono sempre tutte visibili da `sezioni.ts`).
  - (c) opzionale: struttura pre-compilata nell'invito (nome/indirizzo già in `host_autorizzati`), e/o Scout di partenza solo
    per 2-3 sezioni chiave lanciato una alla volta dal frontend (NON 7 in fila: ogni Scout = Claude + web search, 15-40s e
    costo reale, sfora il timeout serverless).
- Wi-Fi legato al soggiorno attivo (tabelle `strutture_segreti` e `soggiorni` pronte, nessuna UI/logica costruita)
- Multilingua: `luoghi.traduzioni` ha già dati reali in 5 lingue importati da V1; manca il selettore lingua e la logica di lettura nel frontend; `pagine` ha solo italiano
- Visualizzazione dei sotto-blocchi "Aperitivi" e "Stellati" dentro la pagina "Dove Mangiare" (dati presenti in `luoghi` con quelle sezioni, nessuna UI dedicata — oggi sarebbero raggiungibili solo con un URL manuale tipo `/villavirginia/aperitivi`, non linkato da nessuna parte)
- Restyling grafico (deliberatamente rimandato — l'interfaccia attuale è Tailwind minimale, non rifinita come la V1)
- Passaggio da Vercel Hobby a Pro (obbligatorio prima di fatturare a un cliente vero, per via dei termini d'uso non-commerciali del piano gratuito)
- Gestione di un host con più strutture (oggi il modello presume una struttura per host)
