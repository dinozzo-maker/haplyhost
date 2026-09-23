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
  - **Scout (17-22/09/2026) non ha più un motore unico** (`MOTORE_SCOUT` è stato rimosso): prova in
    cascata Gemini → Claude Haiku (`web_search_20250305`) → **OpenRouter** (modello gratis
    `qwen/qwen3.8-27b:free` + il suo tool `openrouter:web_search`, via Exa) → **Geoapify Places**
    (ricerca per categoria OSM + verifica web con **Exa Answer API**), saltando ogni fornitore la cui
    chiave manca e passando al successivo su errore o zero risultati verificati. Vedi `api/scout.js`
    e `lib/proposte-scout.js` nella struttura del repo sotto.
  - **Geoapify** (`VITE_GEOAPIFY_API_KEY`, la stessa chiave usata lato browser e lato server — vedi
    "Variabili d'ambiente": non è un segreto, finisce comunque nel bundle) copre due usi scollegati:
    autocompletamento indirizzo (`IndirizzoAutomatico.tsx`, solo client) e, dentro Scout, geocodifica +
    ricerca luoghi + calcolo distanze reali (mai fidarsi della distanza dichiarata dal modello).
  - **Exa** (`EXA_API_KEY`, facoltativa: la sua assenza fa semplicemente cadere i candidati Geoapify
    per mancanza di conferma) conferma via web che nome/descrizione di un candidato Geoapify
    corrispondano a una fonte reale, prima di proporlo all'host.
  - **OpenRouter** (`OPENROUTER_API_KEY`) è il 3° fornitore della cascata Scout, unico a costo zero
    (modello `:free`).

## Struttura del repository

```
haplyhost/
├── api/                     ← funzioni serverless Vercel (Node). NON girano con `npm run dev`:
│   │                          si testano solo online, dopo push, su haplyhost.vercel.app
│   ├── gennarino.js         ← chat AI ospiti: legge struttura (incl. `note_gennarino`) + luoghi + pagine, logga su `domande`.
│   │                          DUE chiamate a `MODELLO_GEMINI` (`generateContent`; interruttore `MOTORE_GENNARINO`): 1) piccola,
│   │                          riconosce la lingua dell'ospite; 2) la risposta, con quella lingua come vincolo. Carattere napoletano
│   │                          nel system prompt (con esempi). `lang` dal body = ripiego. Strip `*`/`#` markdown. Se consiglia di
│   │                          contattare gli host, il prompt gli impone sempre "un messaggio WhatsApp", mai "chiama/telefona"
│   │                          (13/09/2026, preferenza esplicita dell'host) — src/Gennarino.tsx riconosce il numero nella risposta
│   │                          e ci aggiunge i tasti WhatsApp/Chiama veri sotto quel messaggio.
│   │                          Endpoint PUBBLICO: `domanda` capata a 1500 char, `storico` alle ultime 12 righe (2000 char l'una)
│   │                          — `pulisciStorico()`. Rate limit grezzo per struttura: 429 se >15 righe in `domande` nell'ultimo
│   │                          minuto (dosso, non muro — una raffica simultanea passa). Per-IP vero: ancora da fare (store esterno).
│   │                          Prima di salvare oscura email, telefoni, URL e codici di prenotazione; aggiorna le statistiche
│   │                          aggregate giornaliere. Il testo viene eliminato automaticamente dopo 90 giorni.
│   │                          Prima di qualunque risposta controlla `strutture.attivo=true`: una guida in bozza non può essere
│   │                          interrogata dall'endpoint pubblico (17/09/2026).
│   ├── pulisci-domande.js   ← chiamata ogni notte da Vercel Cron: elimina da `domande` solo il testo oltre 90 giorni.
│   │                          Non è pubblica: accetta solo `Authorization: Bearer CRON_SECRET`.
│   ├── traduci-guida.js     ← SOLO owner: traduce con Haiku (max_tokens 16k, 1 retry sul JSON storto) pagine + luoghi con
│   │                          `da_tradurre=true` O (con testo) senza `traduzioni` (en/fr/de/es) → `*.traduzioni`, e azzera `da_tradurre`.
│   │                          Una riga col flag ma senza testo da tradurre (es. luogo con solo il nome) → flag tolto lo stesso
│   │                          (contata in `ripulite`), altrimenti l'avviso ambra resterebbe per sempre. Lotti di 4. Fallimenti
│   │                          per-riga non bloccano: risposta `{pagine,luoghi,ripulite,nonRiusciti,errore?}`, il flag resta solo
│   │                          sulle righe con un errore vero. `vercel.json` maxDuration 60. Pulsante in `/admin/traduzioni`.
│   ├── scout.js             ← cerca nuovi luoghi per una sezione, li salva in `proposte`. `RICERCHE_ATTIVE` (booleano,
│   │                          uguale in GestisciSezione.tsx): false → l'endpoint torna 503 senza chiamare AI.
│   │                          **Non ha più un motore unico** (17-22/09/2026, `MOTORE_SCOUT` rimosso): `cercaConFallback()`
│   │                          prova in cascata, saltando chi non ha la chiave configurata e passando al successivo su
│   │                          errore o zero risultati verificati: 1) Gemini + Interactions/Maps grounding, 2) Claude Haiku
│   │                          (`web_search_20250305`, `max_tokens:6000`, 1 continuazione su `pause_turn`), 3) OpenRouter
│   │                          (modello gratis `qwen/qwen3.8-27b:free` + `openrouter:web_search`, via Exa), 4) Geoapify
│   │                          Places per categoria (`CATEGORIE_GEOAPIFY`, solo sezioni mappate) + conferma via Exa Answer
│   │                          API — un candidato Geoapify senza conferma web viene scartato, mai mostrato con la sola
│   │                          scheda mappa come descrizione. Ogni chiamata AI passa da `registraConsumoAI()` (vedi
│   │                          `lib/consumi-ai.js` sotto). `errorePubblicoScout()` traduce l'errore del fornitore in un
│   │                          messaggio host-safe (quota esaurita, timeout, o generico) + `tentativi` (fornitore→esito).
│   │                          **Doppioni**: `lib/identita-luoghi.js` (`possibileDuplicato()`) scarta lato server un
│   │                          candidato troppo simile a un luogo già in guida (tollera un refuso, ignora parole generiche
│   │                          come "pizzeria/ristorante") — nato da un caso vero ("Vaillum" proposto quando esisteva già
│   │                          "Vatillum Pizzeria Paestum"). **Verifica fonti**: un nome dev'essere citato letteralmente
│   │                          nella fonte che lo accompagna (non basta che la fonte esista); `proposte.verifica` (jsonb,
│   │                          migration 0017) registra fonti/campi non verificati/eventuali contraddizioni, mostrato in
│   │                          GestisciSezione.tsx come pannello "Fonti e dettagli da verificare". **Distanza**: mai quella
│   │                          dichiarata dal modello — `distanzaGeograficaKm()` (haversine, `lib/proposte-scout.js`) la
│   │                          ricalcola da coordinate vere (Geoapify geocoding sull'indirizzo del candidato). **Salvataggio
│   │                          a lotto**: l'host spunta le proposte da tenere ed preme un unico "Salva le scelte" → RPC
│   │                          `salva_scelte_proposte` (migration 0018, transazione con `for update`): inserisce solo le
│   │                          spuntate in `luoghi`, elimina TUTTE le proposte viste (scelte o no). Chiamata anche in
│   │                          modalità "configurazione" (`configurazione:true`) dal wizard guidato — vedi `ConfiguraGuida.tsx`.
│   │                          `raggio_km` dal body (1/5/15/30/150, `RAGGI_KM` — stesse opzioni di `RAGGI` in GestisciSezione.tsx;
│   │                          altrimenti default 5), più `raggioCompleto:true` (solo dal wizard) per non escludere i posti
│   │                          vicinissimi nella prima ricerca. `vercel.json` maxDuration 60 (le chiamate durano 10-18s).
│   ├── importa-casa.js      ← crea una struttura nuova da {nome, indirizzo, link}. Prima: rifiuta se l'email non è in `host_autorizzati`
│   │                          (403; salta il check se è il superadmin, `VITE_ADMIN_EMAIL`). Poi genera descrizione_casa + citta
│   │                          (via lib/), imposta attivo=FALSE (l'host pubblica dal pannello), segna host_autorizzati.registrato_il.
│   ├── aggiorna-casa.js     ← rigenera descrizione_casa + citta da un nuovo link per una struttura esistente (verifica owner tramite access_token)
│   ├── host-autorizzati.js  ← SOLO superadmin (email === VITE_ADMIN_EMAIL): GET elenco, POST autorizza un'email + genera link
│   │                          di invito (supabase.auth.admin.generateLink), DELETE trasferisce prima tutte le strutture al
│   │                          superadmin e poi rimuove account Auth + autorizzazione: nessuna struttura resta senza proprietario.
│   ├── sezioni-extra.js     ← SOLO superadmin: POST crea una sezione custom (genera slug da etichetta, rifiuta collisioni con
│   │                          le 14 di sistema / rotte riservate — 'privacy' e 'configurazione' incluse dal 17-22/09/2026),
│   │                          DELETE la elimina. Tabella `sezioni_extra`, service role.
│   ├── consumi-ai.js        ← (17-22/09/2026) SOLO superadmin (verifica email via `supabase.auth.getUser(token)`): GET
│   │                          totali Oggi/7gg/30gg + tabella per servizio/fornitore/modello + ultimi errori (solo tipo e
│   │                          data, mai il messaggio) da `consumi_ai`. Rotta `/admin/piattaforma/consumi-ai`.
│   ├── manifest.js          ← (17/09/2026) manifest PWA dinamico, GET ?slug=... — così installando la guida di UNA
│   │                          struttura l'icona apre proprio quella, non una Home generica.
│   └── verifica-slug.js     ← pubblico, volutamente minimo: GET ?slug=... → { esiste: bool }, nient'altro. Usato da Struttura.tsx
│                              per il messaggio "guida in allestimento" senza esporre i dati di una struttura non pubblica.
├── lib/                     ← condiviso da più endpoint /api. FUORI da api/ apposta, così Vercel non lo tratta come
│   │                          endpoint serverless. Da qui in poi ha anche dei test (17-22/09/2026, prima non esisteva
│   │                          infrastruttura di test): `node:test`/`node:assert` di Node, nessuna dipendenza nuova —
│   │                          vedi "Testare le modifiche" sotto per come lanciarli.
│   ├── genera-descrizione-casa.js  ← condiviso da importa-casa.js e aggiorna-casa.js: legge il link, chiede a Claude {descrizione, citta}.
│   ├── configurazione-casa.js      ← `validaDatiCasa()`: valida i dati del wizard guidato/manuale (vedi ConfiguraGuida.tsx),
│   │                                  incluse le reti Wi-Fi (nome obbligatorio se c'è password/zona, tetti di lunghezza,
│   │                                  password conservata byte per byte). + `configurazione-casa.test.js`.
│   ├── consumi-ai.js               ← `registraConsumoAI()` (insert "fire and forget" su `consumi_ai`, non deve MAI far
│   │                                  fallire la chiamata AI che sta misurando) + normalizzatori per fornitore
│   │                                  (`usoGeminiGenerateContent`, `usoGeminiInteractions`, `usoAnthropic`,
│   │                                  `usoOpenAICompatibile` per OpenRouter) + `tipoErroreAI()` (classifica l'errore:
│   │                                  credito/limite, timeout, chiave, richiesta non valida, servizio non disponibile,
│   │                                  fornitore). Usato da gennarino.js, scout.js, traduci-guida.js, genera-descrizione-casa.js.
│   │                                  + `consumi-ai.test.js`.
│   ├── identita-luoghi.js          ← `possibileDuplicato(nome, nomiEsistenti)`: doppioni Scout, vedi nota su scout.js sopra.
│   │                                  + `identita-luoghi.d.ts` (tipi) + `identita-luoghi.test.js`.
│   └── proposte-scout.js           ← `distanzaGeograficaKm()`, `verificaNomiProposte()`/`nomePresenteNellaFonte()`,
│                                      `descrizioneGeoapify()`/`tipoLuogoGeoapify()` (descrizioni template da categorie
│                                      OSM quando non c'è AI). + `proposte-scout.test.js`, `scout-geoapify.test.js`.
├── src/
│   ├── main.tsx             ← entry point: BrowserRouter + StrictMode
│   ├── App.tsx              ← TUTTE le rotte generate da `useSezioni().tutte` (14 di sistema + custom). Non aggiungere rotte a mano per le sezioni
│   ├── index.css            ← `@import "tailwindcss"` + design system "g-*" della GUIDA OSPITI (token su .g-shell,
│   │                          non :root, così l'override inline di --g-accent fa ricalcolare i color-mix; dark via
│   │                          prefers-color-scheme). L'admin NON usa g-*: Tailwind grezzo + il "vestito" di admin/ui.tsx
│   │                          (14-16/09/2026, esteso a tutte le pagine — vedi admin/ui.tsx sotto).
│   ├── lingua.ts            ← multilingua guida ospiti: `Lingua`, `LINGUE`, `rilevaLingua()` (navigator.language + localStorage),
│   │                          `LinguaContext`/`useLingua()`, `campoTradotto()` (ripiego campo per campo su it), dizionario `T` dei testi fissi,
│   │                          `saluto(T[lingua], ora?)` (13/09/2026: Buongiorno/pomeriggio/sera/notte in base all'ora del telefono
│   │                          dell'ospite — nessuna identità, la guida resta anonima, solo il momento della giornata cambia)
│   ├── LinguaProvider.tsx   ← `<LinguaProvider>` (stato lingua + `<html lang>`); montato in Struttura.tsx. Diviso da lingua.ts per il fast-refresh
│   ├── SelettoreLingua.tsx  ← riga di 5 pastiglie (sigla, niente più bandiere emoji dal 13/09/2026), reso in Home.tsx sotto la copertina. Non c'è sulle sottopagine: la scelta è ricordata
│   ├── supabaseClient.ts    ← client Supabase con anon key (sicuro lato browser)
│   ├── immagine.ts          ← (13/09/2026) `ridimensionaImmagine()`: compressione lato client di una foto prima di caricarla
│   │                          (max 1920px, JPEG 0.85, rispetta l'EXIF) — condivisa da ModificaCasa.tsx (copertina struttura)
│   │                          e GestisciSezione.tsx (foto di un luogo). Un solo posto dove cambiare le regole di compressione
│   ├── sezioni.ts           ← le 14 sezioni DI SISTEMA: {chiave, icona, etichetta, tipo, descrizione?} + `CHIAVI_BUILTIN` (Set)
│   │                          + `filtraVisibili(tutte, sezioni_attive)` (filtro guida, usato da Home/TabBar/GennarinoFab).
│   │                          tipo: 'elenco' (lista da tabella luoghi) | 'testo' (pagina da tabella pagine) | 'chat' (Gennarino).
│   │                          `icona`: nome-icona lucide-react (es. 'home'), non più emoji (13/09/2026) — vedi icone.ts/Icona.tsx
│   ├── icone.ts             ← mappa `ICONE` (nome-icona → componente lucide-react) + `ICONE_SCELTA` (righe tematiche per il
│   │                          selettore in SezioniExtra.tsx). Un solo posto dove aggiungere una nuova icona scegliibile
│   ├── Icona.tsx            ← componente `<Icona nome={...} />`: nome mancante o non riconosciuto (vuoto, o vecchia emoji
│   │                          salvata in sezioni_extra.icona prima del 13/09/2026) ricade su un'icona generica, mai testo
│   │                          grezzo. Diviso da icone.ts per il fast-refresh (stesso motivo di lingua.ts/LinguaProvider.tsx)
│   ├── useSezioni.ts        ← hook: `SEZIONI` + righe di `sezioni_extra` (cache di modulo, 1 fetch/sessione, degrada se tabella assente).
│   │                          `invalidaCacheSezioni()` dopo crea/elimina RIALLINEA tutti i consumatori montati (pub/sub interno):
│   │                          serve perché App.tsx genera le rotte da qui e non si rimonta. Usato da App, Home, Admin, SezioniGuida.
│   ├── Struttura.tsx        ← rotta layout su /:slug — risolve lo slug in `strutture` (incl. `sezioni_attive`, `accento`, `copertina_url`,
│   │                          `lat`/`lng` per il meteo). Rende `.g-shell` (con --g-accent inline) + <Outlet context> + <GennarinoFab> + <TabBar>.
│   │                          Se non trova la riga (RLS pubblica: solo attivo=true), chiede a /api/verifica-slug se lo slug esiste
│   │                          comunque → "guida in allestimento" invece di "struttura non trovata" per una bozza non pubblicata.
│   ├── TabBar.tsx           ← (22/09/2026) barra fissa in basso: 3 tab fissi "Home | Esplora | Gennarino" — non più
│   │                          "Home + prime 2 sezioni 'elenco' visibili + Gennarino". Il tab centrale non porta più a
│   │                          una sezione specifica: scorre a `#esplora` sulla home (nuovo `id="esplora"` sull'intestazione
│   │                          della griglia in Home.tsx). `aria-current` gestito a mano (non più `NavLink`, serve
│   │                          distinguere "in home" da "in home con #esplora")
│   ├── GennarinoFab.tsx     ← bottone tondo galleggiante → /:slug/gennarino; nascosto sulla rotta chat, se la sezione chat
│   │                          è spenta, E (17-22/09/2026) sulla home stessa — la home ha già la sua casella "Chiedi a
│   │                          Gennarino", il pulsante flottante lì era ridondante. Icona: `<GennarinoAvatar>` (16/09/2026,
│   │                          prova) con una regola dedicata `.g-fab-avatar` in index.css che lo fa riempire tutto il
│   │                          cerchio da 52px (la regola generica è 24px, per le icone)
│   ├── Meteo.tsx            ← (13/09/2026) pallino meteo nell'hero della home: Open-Meteo (api.open-meteo.com), gratuito, senza
│   │                          chiave, chiamato diretto dal browser con `strutture.lat/lng`. Icona giorno/notte dal codice WMO.
│   │                          Nessuna coordinata o richiesta fallita → non rende nulla (non è un dato essenziale)
│   ├── Home.tsx             ← (13/09/2026, "dashboard concierge" — non più solo elenco sezioni; esteso 22/09/2026, vedi
│   │                          sotto) saluto per fascia oraria + <Meteo>
│   │                          nell'hero; `.g-ask` "Chiedi a Gennarino" (sempre in cima, oltre a FAB/TabBar) — non un link ma una
│   │                          vera casella di scrittura + 3 esempi cliccabili (`SUGGERIMENTI_GENNARINO` in lingua.ts): scrivere e
│   │                          inviare (o toccare un esempio) porta già dentro la chat con quella domanda in corso (passata via
│   │                          `navigate(..., {state:{domandaIniziale}})`, letta e auto-inviata da Gennarino.tsx), niente doppio
│   │                          passaggio "apri la chat poi riscrivi". Card `.g-today` "Oggi ti consiglio" — un luogo tra i meglio
│   │                          votati (`luoghi.voto`) delle sole sezioni visibili, scelto SENZA AI (ruota una volta al giorno:
│   │                          giorni-dall'epoch % candidati, niente stato da salvare) per non ripetere l'incidente di costo del
│   │                          31/08/2026; nulla se non ci sono luoghi votati. Il link porta a `#luogo-<id>`: SezionePage.tsx ci
│   │                          scorre sopra ed evidenzia quella scheda, non lascia l'ospite a cercarla nell'elenco. Sotto,
│   │                          invariata, la griglia `.g-tile` da `filtraVisibili()` (esclusa la voce chat) con l'etichetta
│   │                          "Esplora la guida". Non fatto in questo passaggio: un saluto che conosce l'ospite per nome (la guida
│   │                          resta anonima, servirebbe un'identità ospite — una feature a sé, non un ritocco grafico).
│   │                          **Esteso (22/09/2026)**: riga "quick actions" `.g-quick` sotto il selettore lingua
│   │                          (Wi-Fi/Info casa → `/:slug/casa`, solo se la sezione `casa` è visibile; WhatsApp host →
│   │                          `wa.me/<numero>`, solo se `host_telefono` è impostato); "Chiedi a Gennarino" e "Oggi ti
│   │                          consiglio" diventano `.g-home-featured`, due colonne da 900px in su (`:has()`, niente
│   │                          layout desktop dedicato prima); "Oggi ti consiglio" mostra `luoghi.foto_url` come
│   │                          intestazione quando c'è; testi di questo blocco spostati/aggiunti in `src/testiHome.ts`
│   │                          (`TESTI_HOME[lingua]`) invece che in `lingua.ts` — solo `suggerimenti` è stato spostato,
│   │                          il resto è testo nuovo. Link alla nuova pagina `/:slug/privacy` (box Gennarino + fondo
│   │                          pagina) — vedi `PaginaPrivacy.tsx`/`privacy.ts` sotto
│   ├── distanza.ts          ← (14/09/2026) `minutiDistanza(testo)` stima i minuti dal testo libero di `luoghi.distanza`
│   │                          (numeri così come scritti, "7 min" più vicino di "10 min" a piedi o in auto che sia — stessa
│   │                          convenzione del prompt di Gennarino; testo senza numeri → in fondo). `ordinaPerDistanza(righe,
│   │                          campo)` le riordina dal più vicino al più lontano. Usata da SezionePage.tsx (lato ospite) e
│   │                          GestisciSezione.tsx (lato admin, stesso ordine che vedrà l'ospite) al posto del solo `ordine`.
│   ├── SezionePage.tsx      ← sezioni 'elenco' — legge `luoghi` (+`prezzo`,`voto`,`categoria`); schede `.g-place` con pastiglie
│   ├── telefono.tsx         ← (13/09/2026) `reTelefono(includeEmergenza)` + `conTelefoni()` (numeri di testo → chip `.g-tel`,
│   │                          tel:) condivise da PaginaStatica.tsx e Gennarino.tsx; `contieneTelefono(testo, numero)` (confronto
│   │                          sulle ultime 9 cifre, non su tutto il numero — vedi bug 14/09/2026 sotto) solo per Gennarino.tsx,
│   │                          per sapere se una risposta nomina IL numero degli host
│   ├── PaginaStatica.tsx    ← sezioni 'testo' — legge `pagine`; `.g-peek` + `.g-prose`. Sotto il testo, tasti WhatsApp (verde
│   │                          #25D366 → wa.me) e Chiama (colore accento → tel:) se `strutture.host_telefono` c'è E la pagina è
│   │                          `contatti` o nomina WhatsApp/telefono (`FRASI_TELEFONO`). Nel testo, i numeri di telefono diventano chip
│   │                          `tel:` (`.g-tel`); i codici brevi 112/118… solo nella pagina `emergenze`
│   ├── PaginaPrivacy.tsx    ← (22/09/2026) rotta `/:slug/privacy`. Legge `src/privacy.ts` (`PRIVACY[lingua]`,
│   │                          IT/EN/FR/DE/ES): chat facoltativa, cosa arriva a Gemini, cosa può leggere l'host, 90 giorni
│   │                          + anonimizzazione ("non sono garantiti anonimi", onesto sul limite), sessionStorage
│   │                          locale, servizi terzi (Vercel/Supabase/Gemini/Google Fonts/Open-Meteo/host
│   │                          foto/Maps/WhatsApp). **Il file stesso si dichiara bozza**: mancano titolare, contatti
│   │                          privacy, basi giuridiche, trasferimenti extra-UE — da completare prima che sia
│   │                          un'informativa vera e propria. Linkata da Gennarino.tsx (piè della chat) e da Home.tsx
│   │                          (box "Chiedi a Gennarino" + fondo pagina).
│   ├── testiHome.ts         ← (22/09/2026) testi della home estesa (`TESTI_HOME[lingua]`, sopra): solo `suggerimenti`
│   │                          spostato da lingua.ts (che aveva anche `gennarinoPrivacy`, ora rimosso insieme — nessun
│   │                          file lo importava più, superato da PRIVACY[lingua].breve). Il resto (`casa`, `whatsapp`,
│   │                          `titolo`, `sottotitolo`, `scopri`, `esplora`) è testo nuovo per la home estesa.
│   ├── GennarinoAvatar.tsx  ← (16/09/2026, PROVA non confermata) piccolo avatar SVG disegnato a mano per Gennarino — non
│   │                          una foto realistica (rischio uncanny valley per un volto fatto a mano), viso geometrico
│   │                          (occhi a pallino, baffi, sorriso), cerchio con gradiente `--g-grad-a`/`--g-grad-b` (le stesse
│   │                          variabili CSS di `.g-ask`: segue sempre il colore d'accento scelto dalla struttura). `useId()`
│   │                          per l'id del gradiente SVG (niente collisioni se compare due volte nella stessa pagina). Al
│   │                          posto dell'icona `MessageCircle` generica in due punti "ritratto"-simili: intestazione della
│   │                          chat (Gennarino.tsx) e bottone flottante (GennarinoFab.tsx) — scartata invece per l'iconcina
│   │                          16px accanto al testo "Chiedi a Gennarino" in Home.tsx (troppo piccola per un volto).
│   ├── Gennarino.tsx        ← UI chat ospiti (`.g-chat`), chiama /api/gennarino. Storico in `sessionStorage` (chiave
│   │                          `haply-chat-<struttura.id>`, 14/09/2026): resta leggendo la guida nello stesso browser, si
│   │                          dimentica quando lo si chiude — così un ospite futuro sullo stesso dispositivo non trova la
│   │                          chat di quello precedente. Prima era solo stato React (spariva ad ogni cambio pagina).
│   │                          `invia(domandaDiretta?)`: se arriva da Home.tsx con una domanda già scritta, la legge da
│   │                          `location.state.domandaIniziale` e la invia da sola all'apertura (guardia via `useRef` contro un
│   │                          doppio invio, stato di navigazione ripulito subito dopo). Ogni risposta: numeri linkificati
│   │                          (`conTelefoni`, con i codici brevi emergenza sempre inclusi — in chat può uscire qualsiasi
│   │                          argomento); se nomina proprio il telefono degli host (`contieneTelefono`), sotto compaiono i
│   │                          tasti WhatsApp/Chiama (13/09/2026, stessa coppia di PaginaStatica). Wrapper `.g-msg` per
│   │                          allineare bolla + eventuali tasti come un unico blocco (prima l'allineamento stava su `.g-bubble`).
│   │                          Intestazione chat: `<GennarinoAvatar>` al posto di `MessageCircle` (16/09/2026, prova)
│   └── admin/
│       ├── Login.tsx            ← login via magic link email (Supabase OTP, nessuna password). `shouldCreateUser: false`:
│       │                          si accede solo con un'email GIÀ esistente in Supabase Auth. Le nuove email si
│       │                          abilitano a mano (Dashboard Supabase → Authentication → Users → Invite / Add user).
│       ├── RichiedeLogin.tsx    ← guardia di autenticazione: verifica sessione E risolve TUTTE le strutture di cui l'utente è
│       │                          owner_user_id (di solito una). Tiene quale sia "selezionata" (localStorage
│       │                          `haply-struttura-selezionata`, come la lingua della guida ospiti) e la passa con <Outlet context>
│       │                          come `struttura` (retrocompatibile: ogni pagina /admin/* la legge così, invariata) +
│       │                          `strutture`/`selezionaStruttura` per chi ne ha più di una. Niente rotte /admin/:id/...
│       ├── AdminShell.tsx       ← livello di layout (13/09/2026) tra RichiedeLogin e ogni pagina /admin/*: da 1024px (lg:) in su
│       │                          aggiunge una barra laterale (logo, cambio struttura, navigazione completa raggruppata da
│       │                          `useSezioni()`, esci); sotto i 1024px non rende nulla in più (`hidden lg:flex`) — ogni pagina
│       │                          resta identica a prima. Riceve `ContestoHost` da RichiedeLogin e lo ripassa invariato con un
│       │                          secondo `<Outlet context>`: nessuna pagina figlia sa che esiste, `useOutletContext` continua
│       │                          a funzionare com'era. Icone sezione via `<Icona>` (src/Icona.tsx), come ovunque nella guida.
│       │                          Sfondo chiaro esplicito (`bg-slate-50 lg:bg-slate-100`, 14/09/2026): senza, su un browser con
│       │                          tema scuro il pannello risultava nero e i testi scuri illeggibili — l'admin non segue il tema
│       │                          del sistema, resta sempre chiaro (a differenza della guida ospiti). Contenuto centrale
│       │                          `lg:px-6` (17-22/09/2026, insieme al `max-w-3xl` di ui.tsx/Admin.tsx sotto — pagine meno
│       │                          strette accanto alla barra laterale). **Un solo link "Vai alla piattaforma"** (22/09/2026,
│       │                          testo viola, in fondo alla barra) al posto del vecchio gruppo con 3 link diretti — vedi
│       │                          `PiattaformaShell.tsx` sotto: l'area piattaforma è stata separata del tutto, non è più
│       │                          raggiungibile dentro questa barra laterale.
│       ├── PiattaformaShell.tsx ← (22/09/2026) shell A SÉ per l'area piattaforma, rotta /admin/piattaforma/* — non un
│       │                          gruppo dentro AdminShell.tsx: colore diverso (barra laterale viola/indaco `bg-violet-950`,
│       │                          non slate-900) così è impossibile confondere "sto gestendo Villa Virginia" con "sto
│       │                          gestendo la piattaforma". Verifica SUBITO `isSuperadmin` e rimanda a `/admin` se non lo
│       │                          sei (un host che digita l'URL a mano non deve nemmeno vedere questa shell) — le pagine
│       │                          sotto hanno comunque ciascuna il proprio controllo, difesa doppia. Riceve lo stesso
│       │                          `ContestoHost` di RichiedeLogin/AdminShell e lo ripassa INVARIATO: InvitaHost.tsx,
│       │                          SezioniExtra.tsx, ConsumiAI.tsx continuano a leggere `session` da
│       │                          `useOutletContext<ContestoHost>()` come prima, non sanno di essere sotto una shell
│       │                          diversa. Sotto lg: non rende nulla (stesso principio di AdminShell), le pagine hanno il
│       │                          loro back-link (`<PaginaAdmin indietro="/admin/piattaforma">`).
│       ├── PiattaformaHome.tsx  ← (22/09/2026) rotta /admin/piattaforma (index): 3 card (Consumi AI, Invita host, Sezioni
│       │                          piattaforma) — su desktop la barra laterale di PiattaformaShell.tsx già naviga, questa
│       │                          pagina serve soprattutto su mobile e come punto d'arrivo di "Vai alla piattaforma".
│       ├── ui.tsx               ← (14/09/2026) "vestito" condiviso del pannello — punto 4 del redesign strategico, non un design
│       │                          system a parte come `g-*` (quello è della guida): `<PaginaAdmin titolo/sottotitolo>` (back-link
│       │                          con icona, intestazione, spaziatura — largo `max-w-xl` su desktop accanto alla barra laterale),
│       │                          `<Sezione titolo?/nota?>` (card bianca), `<Campo etichetta/aiuto?>` (label+aiuto attorno a un
│       │                          input), `classeCampo` (classe input/textarea/select condivisa), `<Pulsante variante=
│       │                          primario|secondario|pericolo>`, `<Esito ok>`. Palette: slate neutro + ambra (stesso accento
│       │                          del logo nella barra laterale) solo per il focus, bottoni primari scuri (`slate-900`, non
│       │                          ambra piena — contrasto migliore). `PaginaAdmin` allargata a `lg:max-w-3xl lg:px-8`
│       │                          (17-22/09/2026, "Centra i contenuti del pannello admin" — prima `lg:max-w-xl`, pagine
│       │                          strette accanto alla barra laterale). Esteso a TUTTE le pagine del pannello (16/09/2026,
│       │                          iniziato da ModificaCasa.tsx il 14/09 come prova). ⚠️ Tailwind v4 ha spostato il
│       │                          modificatore "important" da prefisso a suffisso (`classe!`, non più `!classe`): niente
│       │                          override di `<Pulsante>` con `!classe` in coda a `className` (sintassi vecchia, silenziosamente
│       │                          ignorata — e anche con la sintassi giusta l'ordine di generazione CSS di Tailwind non è
│       │                          garantito). Per un bottone con un colore diverso dal variante (es. il verde di
│       │                          "Accetta"/"Cerca nuovi luoghi" in GestisciSezione.tsx) si scrive un `<button>` semplice con
│       │                          le classi per esteso, non `<Pulsante>` più un override. `indietro` di `PaginaAdmin` accetta
│       │                          anche una stringa, non solo booleano (22/09/2026): le pagine sotto `/admin/piattaforma`
│       │                          (InvitaHost, SezioniExtra, ConsumiAI) tornano a `/admin/piattaforma`, non a `/admin` —
│       │                          quell'area è stata separata del tutto (shell propria, non più solo un colore diverso:
│       │                          un primo tentativo col solo badge viola "Modalità piattaforma" è stato scartato lo
│       │                          stesso giorno a favore di questa separazione vera — vedi `PiattaformaShell.tsx` sotto)
│       ├── Admin.tsx            ← dashboard host: bottoni "Gestisci X" / "Modifica X" generati da `useSezioni()`. Se l'host non ha ancora una struttura, mostra <CreaStruttura />.
│       │                          Se ne ha più di una: tendina "Struttura" in cima su mobile (cambia `selezionaStruttura`, niente
│       │                          reload; su desktop la stessa tendina è nella barra laterale di AdminShell, questa è `lg:hidden`).
│       │                          Link "+ Aggiungi un'altra struttura" → /admin/nuova-struttura sempre visibile (anche con una sola).
│       │                          Se la guida è spenta (attivo=false): card "Primi passi" (checklist con pagine/luoghi rilevati) + "Pubblica la guida".
│       │                          Se è online: pallino verde + "La guida è online" + "Metti offline" (conferma). Il flag va su
│       │                          `strutture.attivo` (UPDATE owner). L'elenco dei link (Modifica dati/Note/Domande/…) e il
│       │                          pulsante Esci sono `lg:hidden`: su desktop sono già nella barra laterale, qui restano solo i
│       │                          contenuti da dashboard (stato online, checklist, avviso traduzioni).
│       │                          Un solo link "Vai alla piattaforma" → /admin/piattaforma (solo se email === VITE_ADMIN_EMAIL;
│       │                          22/09/2026, prima 3 link diretti — vedi PiattaformaShell.tsx sotto per l'area separata).
│       │                          Vestito di ui.tsx (16/09/2026): niente `<PaginaAdmin>` (è già il pannello, nessun back-link);
│       │                          due helper locali non condivisi altrove — `Scorciatoia` (card bianca per i link di
│       │                          navigazione) e `Passo` (riga della checklist "Primi passi") — perché qui la struttura
│       │                          (griglie responsive, card di stato online/bozza) è troppo su misura per Sezione/Campo.
│       │                          Contenuto centrale `lg:max-w-3xl lg:px-8` (17-22/09/2026, vedi nota su ui.tsx sopra).
│       │                          `RiprendiConfigurazione` (17-22/09/2026): se esiste una riga in `configurazioni_guida`
│       │                          per la struttura selezionata, mostra un pulsante "Riprendi la configurazione" →
│       │                          `/admin/configurazione` — vedi `ConfiguraGuida.tsx` sotto per l'intero flusso guidato
│       ├── CreaStruttura.tsx    ← form onboarding, molto più grande dal 17-22/09/2026: prima scelta **guidata** (assistita da
│       │                          AI) vs **manuale** (vuota, zero AI — verificato nei test che ogni fetch resta su
│       │                          `database.test`); poi nome, indirizzo (via `IndirizzoAutomatico.tsx`), link (solo modalità
│       │                          guidata), check-in/out, host, WhatsApp, reti Wi-Fi (`RetiWifi.tsx`). Invia a
│       │                          /api/importa-casa con `modalita` + un `richiesta_id` (`crypto.randomUUID()`, `useRef`,
│       │                          generato una volta sola) che rende il submit sicuro anche su doppio click — l'RPC
│       │                          `crea_casa_configurata` (migration 0020) è idempotente su quell'id. La struttura nasce
│       │                          spenta; la segna come selezionata (localStorage) e window.location='/admin' (in modalità
│       │                          guidata, verso `/admin/configurazione` — vedi ConfiguraGuida.tsx). Prop `aggiuntiva`:
│       │                          riusato sia per la primissima struttura (da Admin.tsx, senza il prop) sia da
│       │                          /admin/nuova-struttura (con `aggiuntiva`) — stesso form, cambia solo il testo introduttivo
│       ├── ConfiguraGuida.tsx   ← (17-22/09/2026) rotta /admin/configurazione: passi 2-3 del wizard guidato (il passo 1, i
│       │                          dati casa, è già in CreaStruttura.tsx). Stato salvato SERVER-SIDE in `configurazioni_guida`
│       │                          (struttura_id pk, modalita, passo 2|3) apposta perché chiudere la scheda non perda il
│       │                          progresso — al montaggio legge quella riga e riparte dal passo giusto (da qui
│       │                          `RiprendiConfigurazione` in Admin.tsx). Passo 2: `SceltaSezioni.tsx` (quali sezioni
│       │                          mostrare, max 10 di tipo elenco in modalità guidata). Passo 3 (solo guidata): lancia UNA
│       │                          ricerca Scout per sezione **in sequenza** (`configurazione:true`, raggio fisso per sezione
│       │                          — vicinanze/trasporti 1km, mangiare/spiagge/divertimento 5km, visitare 15km, gite 30km —
│       │                          + `raggioCompleto:true`, niente esclusione dei postissimi vicini sulla prima passata),
│       │                          stato live "Cerco: <sezione>", poi le proposte come lista di spunte (stesso
│       │                          `salva_scelte_proposte` di GestisciSezione.tsx); segnala le pagine di testo mancanti;
│       │                          infine "Pubblica la guida" (bloccato finché restano proposte non riviste). La tabella
│       │                          `ricerche_configurazione` (struttura_id+sezione, stato in_corso|completata|errore) rende
│       │                          la prima ricerca idempotente e a tetto: l'RPC `prenota_ricerca_configurazione` blocca la
│       │                          riga, rifiuta se quella sezione è già prenotata (torna `false`, non errore — il frontend
│       │                          la salta) e impone **massimo 10 ricerche per struttura**. ⚠️ Wi-Fi lato ospite: ancora
│       │                          da decidere (vedi `docs/configurazione-guida.md`) — per ora resta solo nel pannello host.
│       ├── PassiConfigurazione.tsx ← indicatore visivo dei 3 passi del wizard (Casa → Sezioni → Ricerca), condiviso da
│       │                          CreaStruttura.tsx e ConfiguraGuida.tsx.
│       ├── SceltaSezioni.tsx    ← (17-22/09/2026) checklist sezioni raggruppata ("Informazioni sulla casa" / "Luoghi da
│       │                          scoprire" / "Il tuo concierge"), con tetto di 10 sezioni-elenco in modalità guidata.
│       │                          Estratta da ConfiguraGuida.tsx MA riusata anche dalla vecchia /admin/sezioni-guida
│       │                          (SezioniGuida.tsx sotto), che prima aveva una sua checkbox-list bespoke.
│       ├── RetiWifi.tsx         ← editor di 0-20 reti Wi-Fi ({nome, password, zona}, validate da
│       │                          `lib/configurazione-casa.js`), usato sia in CreaStruttura.tsx (creazione) sia in
│       │                          GestisciWifi.tsx sotto (modifica). Sostituisce concettualmente le vecchie colonne singole
│       │                          `strutture_segreti.wifi_rete`/`wifi_password` (non cancellate, solo superate — vedi schema).
│       ├── GestisciWifi.tsx     ← editor delle reti Wi-Fi di una struttura esistente, montato dentro ModificaCasa.tsx.
│       │                          Legge/scrive `strutture_segreti.reti_wifi` DIRETTAMENTE dal browser (RLS owner-scoped
│       │                          aggiunta in migration 0020 — prima `strutture_segreti` era SOLO service-role, zero
│       │                          accesso lato client, vedi schema sotto).
│       ├── IndirizzoAutomatico.tsx ← (17-22/09/2026) campo indirizzo con autocompletamento Geoapify (debounce 400ms, min 3
│       │                          caratteri, `AbortController` per annullare la richiesta precedente, `countrycode:it`).
│       │                          Chiamata diretta dal browser (`VITE_GEOAPIFY_API_KEY`). Senza la chiave degrada da solo a
│       │                          un campo di testo semplice con una nota — stesso principio di Meteo.tsx. Usato in
│       │                          CreaStruttura.tsx e ModificaCasa.tsx.
│       ├── ConsumiAI.tsx        ← (17-22/09/2026) rotta /admin/piattaforma/consumi-ai (22/09/2026, prima /admin/consumi-ai —
│       │                          vedi PiattaformaShell.tsx sopra), SOLO superadmin: dashboard di `api/consumi-ai.js`
│       │                          — totali Oggi/7gg/30gg, tabella per servizio/fornitore/modello, ultimi errori (solo tipo,
│       │                          mai il testo). Nota esplicita nella pagina: né Google né Anthropic espongono un vero
│       │                          saldo residuo via API, questi sono consumi osservati, non un credito rimanente.
│       ├── InvitaHost.tsx       ← rotta /admin/piattaforma/invita-host (22/09/2026, prima /admin/invita-host), SOLO
│       │                          superadmin: form (email, nome riferimento, piano, note) → POST /api/host-autorizzati
│       │                          → mostra il link di invito da copiare e mandare. Sotto, l'elenco degli host già autorizzati.
│       ├── ModificaCasa.tsx     ← rotta /admin/modifica-casa: form con TUTTI i dati struttura senza altro editor (nome, indirizzo
│       │                          via `IndirizzoAutomatico.tsx`, citta, descrizione_casa, host_nome, host_telefono, checkin,
│       │                          checkout, max_ospiti) → UPDATE diretto su `strutture` (RLS owner), più `GestisciWifi.tsx`
│       │                          per le reti Wi-Fi (17-22/09/2026). Prima pagina vestita con `./ui.tsx` (14/09/2026, poi
│       │                          esteso a tutte le altre — vedi sopra). Blocco "Aspetto della guida": 5 preset colore
│       │                          (`accento`) + foto copertina — `ridimensionaImmagine()` (da `../immagine.ts`, condivisa
│       │                          con GestisciSezione.tsx dal 13/09/2026) la porta lato client a un lato massimo 1920px +
│       │                          JPEG qualità 0.85 (`imageOrientation: 'from-image'` per l'EXIF) prima di caricarla; se
│       │                          fallisce usa il file originale. "Carica foto" (upload su Storage bucket `copertine`,
│       │                          salva SUBITO `copertina_url`) o link incollato (in `<details>`, staged). Riquadro
│       │                          "Rigenera la descrizione" → POST /api/aggiorna-casa
│       ├── NoteGennarino.tsx     ← rotta /admin/note (link nel pannello): textarea `strutture.note_gennarino` → UPDATE diretto.
│       │                          Info pratiche libere per Gennarino, NON una sezione della guida
│       ├── DomandeOspiti.tsx     ← rotta /admin/domande: elenco anonimizzato `domande`, tap per risposta; elimina una riga o
│       │                          tutto lo storico (migration 0014). Il testo dura al massimo 90 giorni.
│       ├── StatisticheDomande.tsx ← rotta /admin/statistiche: conteggi aggregati senza testo (totale, ultimi 30 giorni, lingue).
│       ├── TraduciGuida.tsx      ← rotta /admin/traduzioni (link nel pannello): pulsante "Traduci la guida" → POST /api/traduci-guida
│       ├── SezioniGuida.tsx     ← rotta /admin/sezioni-guida: spunte "mostra nella guida" (sistema + custom) → UPDATE `strutture.sezioni_attive`.
│       │                          Filtra SOLO la guida ospiti (Home.tsx), non il pannello. NULL = tutte le sistema, custom escluse.
│       │                          Checklist ora `SceltaSezioni.tsx` (17-22/09/2026, riusata dal wizard — vedi CreaStruttura.tsx),
│       │                          non più una checkbox-list scritta apposta per questa pagina
│       ├── SezioniExtra.tsx     ← rotta /admin/piattaforma/sezioni-extra (22/09/2026, prima /admin/sezioni-extra), SOLO
│       │                          superadmin: crea/elimina sezioni custom (etichetta, icona via
│       │                          selettore icone lucide-react — righe tematiche da ICONE_SCELTA, non più emoji (13/09/2026) —,
│       │                          descrizione, tipo testo|elenco, categoria per Scout se elenco) → POST/DELETE /api/sezioni-extra.
│       ├── GestisciSezione.tsx  ← UNICO componente riusato per tutte e 7 le sezioni 'elenco': elenco ordinato dal più vicino al più
│       │                          lontano (`ordinaPerDistanza`, 14/09/2026 — riordinato anche dopo un salvataggio inline, se la
│       │                          distanza cambia), con toggle attivo/spento,
│       │                          modifica inline + "Elimina questo luogo" (DELETE, dentro la modifica), "+ Aggiungi un luogo a mano"
│       │                          (INSERT), tendina "Raggio di ricerca" (`RAGGI`, 1/5/15/30/150 km) + "Cerca nuovi luoghi"
│       │                          (Scout, manda `raggio_km`). Proposte (17-22/09/2026, cambiate da Accetta/Rifiuta per-riga
│       │                          a): spunte + un unico "Salva le scelte" (RPC `salva_scelte_proposte`, vedi nota su
│       │                          scout.js sopra); avviso ambra "possibile duplicato" se il nome somiglia troppo a un
│       │                          luogo già in guida (`possibileDuplicato()`, ri-controllato anche per le proposte salvate
│       │                          PRIMA che questo controllo esistesse); pannello "Fonti e dettagli da verificare"
│       │                          (`proposte.verifica`) apribile per proposta. Campi condivisi modifica/nuovo:
│       │                          <CampiLuogo> (nome/descrizione/distanza/prezzo/voto/maps/telefono). Salva/aggiungi/accetta → `da_tradurre=true`.
│       │                          Foto del luogo (13/09/2026, solo in modifica — non nel form "nuovo luogo": serve un id già
│       │                          esistente): stesso schema di ModificaCasa (`ridimensionaImmagine()` da `../immagine.ts`), salvata
│       │                          SUBITO in `luoghi.foto_url` (non aspetta "Salva"), bucket `copertine` condiviso, percorso
│       │                          `luoghi/<struttura_id>/<luogo_id>-<timestamp>.jpg`. Miniatura anche nell'elenco "GIÀ PRESENTI".
│       │                          Vestito di ui.tsx (16/09/2026) — vedi la nota su ui.tsx sopra per i bottoni verdi (Scout/Accetta)
│       └── GestisciPagina.tsx   ← UNICO componente riusato per tutte e 6 le sezioni 'testo': editor titolo+contenuto su `pagine`.
│                                  Salva → upsert con `da_tradurre=true` + ricorda di rilanciare "Traduzioni della guida"
```

## Pattern architetturali importanti

1. **Le sezioni si iterano da `useSezioni().tutte`**, non da `SEZIONI` direttamente. `SEZIONI` (in `sezioni.ts`) sono le 14 di sistema; `useSezioni()` le unisce alle righe di `sezioni_extra` (custom del superadmin). `App.tsx`, `Home.tsx`, `Admin.tsx`, `SezioniGuida.tsx` generano rotte/bottoni da `tutte`. Una sezione di sistema nuova = una riga in `sezioni.ts`; una sezione custom = riga in `sezioni_extra` (dalla pagina `/admin/piattaforma/sezioni-extra`). Non toccare le rotte a mano. `App.tsx` ha una rotta `*` sotto `/admin` che tiene gli URL `/admin/...` sconosciuti dentro il pannello (loading → redirect a `/admin`) invece di farli cadere sulla rotta ospite `/:slug`.
2. **Multi-tenancy lato host**: `RichiedeLogin.tsx` risolve *tutte* le strutture con `owner_user_id = auth.uid()` (di solito una) e passa via `Outlet context` quella "selezionata" come `struttura` a tutte le pagine `/admin/*` — nessun componente admin deve cercare una struttura per slug fisso, tutti leggono `struttura` dal contesto e restano validi anche per un host con più proprietà. Un host con più strutture (10/09/2026, niente tabella ponte: `owner_user_id` è già una FK non-unica, un utente può possedere più righe di `strutture`) le cambia da una tendina in `Admin.tsx`; la scelta vive in `localStorage`, non nell'URL.
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
  attivo boolean,          -- guida pubblica (visibile agli ospiti) sì/no. importa-casa.js la crea a false;
  --                          l'host pubblica da Admin.tsx ("Pubblica la guida"). L'owner vede la propria anche se false (migration 0010)
  creato_il timestamptz,
  owner_user_id uuid references auth.users(id) on delete set null   -- ON DELETE SET NULL da migration 0002:
  --   cancellare un utente Auth NON cancella/blocca la sua struttura (diventa senza proprietario)
  -- ⚠️ link_riferimento: documentata in passato ma NON presente nel DB reale (verificato 30/08/2026).
  --    Il codice NON deve leggerla/scriverla finché non viene aggiunta con un ALTER TABLE.
)

strutture_segreti (
  struttura_id uuid pk references strutture(id) on delete cascade,
  wifi_rete text, wifi_password text,   -- superate da reti_wifi (sotto) ma NON droppate: dati storici, nessun codice le legge più
  reti_wifi jsonb not null default '[]'   -- migration 0020 (17-22/09/2026): array di {nome, password, zona}, max 20 (check
  --   constraint `reti_wifi_elenco`), backfillata dalle due colonne singole sopra al momento della migration.
  --   Editata da src/admin/GestisciWifi.tsx / RetiWifi.tsx. ⚠️ Non ancora mostrata nella guida ospiti (deciso apposta
  --   per ora, vedi docs/configurazione-guida.md — è indipendente dal Wi-Fi-per-soggiorno ancora da fare, vedi sotto)
  -- RLS: prima SOLO service role (zero policy). Dalla 0020 ANCHE una policy `for all` owner-scoped (come luoghi/pagine)
  --   + grant esplicito a `authenticated`, perché GestisciWifi.tsx lo legge/scrive diretto dal browser.
)

luoghi (
  id uuid pk, struttura_id uuid references strutture(id) on delete cascade,
  sezione text, nome text, icona text, etichetta text, categoria text,
  descrizione text, distanza text, maps text, telefono text,
  prezzo text, voto text,   -- migration 0005: fascia di prezzo (es. "15-25 €") e voto Google (es. "4,5"), da Scout
  foto_url text,   -- migration 0011 (13/09/2026): foto del singolo luogo, caricata a mano dall'host in
  --                  GestisciSezione.tsx (bucket Storage "copertine", percorso "luoghi/<struttura_id>/...")
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
domande (id uuid pk, struttura_id, domanda, risposta, lang default 'it', creato_il)  -- log Gennarino, scritto da api/gennarino.js con service role (lang = lingua rilevata). Prima del salvataggio oscura contatti/link/codici; testo max 90 giorni. RLS: SELECT+DELETE per host (0008+0014)
statistiche_domande_giornaliere (struttura_id, giorno, lingua, numero)  -- soli conteggi anonimi; restano oltre i 90 giorni. SELECT solo host (0015)

pagine (
  id uuid pk, struttura_id uuid references strutture(id) on delete cascade,
  chiave text, titolo text, contenuto text, traduzioni jsonb,   -- traduzioni: { en:{titolo,contenuto}, fr:{...}, ... }, popolato da api/traduci-guida.js
  da_tradurre boolean default false,   -- migration 0009: true se il testo è cambiato dopo l'ultima traduzione (come luoghi.da_tradurre)
  unique (struttura_id, chiave)
)

proposte (   -- output di Scout, in attesa di approvazione host
  id uuid pk, struttura_id uuid references strutture(id) on delete cascade,
  sezione text, nome text, descrizione text, distanza text, maps text, telefono text,
  prezzo text, voto text,   -- migration 0005: come luoghi; copiati nel luogo quando l'host accetta la proposta
  verifica jsonb,   -- migration 0017 (17-22/09/2026): fonti (url/titolo/testo di conferma), quali campi ogni fonte
  --   copre davvero, `non_verificato` (campi scartati per mancanza di fonte), `contraddizioni`, `domanda_host`
  --   (il modello può chiedere "quale sede intendevi?"). null sulle righe create prima di questa data.
  creato_il timestamptz
  -- salvataggio/scarto SOLO via RPC `salva_scelte_proposte` (migration 0018): transazione con `for update`,
  --   inserisce in luoghi solo le proposte scelte, elimina TUTTE quelle viste (scelte o no). security invoker,
  --   verifica ownership da sola, revocata da public/anon, concessa ad authenticated.
)

host_autorizzati (   -- email autorizzate dal superadmin a diventare host (vedi supabase/migrations/0001)
  email text pk, nome_riferimento text, piano text,   -- piano: 'guida' | 'concierge' | 'portfolio'
  note text, autorizzato_il timestamptz default now(),
  registrato_il timestamptz   -- popolato da importa-casa.js quando l'host crea la struttura (best-effort)
  -- RLS on, zero policy: solo server-side con service role, via api/host-autorizzati.js
)

sezioni_extra (   -- sezioni della guida create dal superadmin, oltre alle 14 di sistema (migration 0004)
  chiave text pk,   -- slug generato dall'etichetta
  icona text default '📄', etichetta text, descrizione text,
  --   ⚠️ default DB storico, mai usato in pratica: l'API scrive sempre un valore esplicito — nome-icona
  --      lucide-react scelto dal superadmin, o 'sparkles' se non sceglie (13/09/2026, vedi src/icone.ts).
  --      Righe create prima di questa data hanno ancora un'emoji: <Icona> non la riconosce e mostra
  --      un'icona generica (nessun crash, nessuna migration necessaria).
  tipo text default 'testo',   -- 'testo' (usa pagine) | 'elenco' (usa luoghi + Scout)
  categoria text,   -- solo per 'elenco': termine di ricerca per Scout
  ordine int default 100, creato_il timestamptz default now()
  -- RLS on: SELECT pubblico (serve a ogni guida); scrittura solo via api/sezioni-extra.js con service role
)

consumi_ai (   -- migration 0019 (17-22/09/2026): una riga per chiamata AI, per api/consumi-ai.js (/admin/piattaforma/consumi-ai)
  id uuid pk, servizio text, operazione text, fornitore text, modello text,
  esito text,   -- 'ok' | 'errore'
  errore_tipo text,   -- da tipoErroreAI(): credito o limite | timeout | chiave o permessi | richiesta non valida | servizio non disponibile | fornitore
  token_input int, token_output int, token_ragionamento int, token_cache int, token_strumenti int, token_totali int,
  durata_ms int, creato_il timestamptz default now()
  -- RLS on, ZERO policy (come strutture_segreti prima della 0020): solo service role, via registraConsumoAI()
)

configurazioni_guida (   -- migration 0020 (17-22/09/2026): stato del wizard di onboarding guidato/manuale
  struttura_id uuid pk references strutture(id) on delete cascade,
  modalita text check (modalita in ('guidata','manuale')),
  passo int check (passo between 2 and 3)   -- il passo 1 (dati casa) è CreaStruttura.tsx stesso, non tracciato qui
  -- RLS: for all, owner-scoped
)

ricerche_configurazione (   -- migration 0020: rende idempotente/a-tetto la prima ricerca Scout del wizard guidato
  struttura_id uuid references strutture(id) on delete cascade, sezione text,
  stato text,   -- 'in_corso' | 'completata' | 'errore'
  primary key (struttura_id, sezione)
  -- scritta solo via RPC prenota_ricerca_configurazione(): row-lock, rifiuta se già prenotata (torna false, non
  --   errore), tetto RIGIDO di 10 ricerche per struttura (raise exception oltre)
)
```

**Policy RLS attuali (stato finale, non cronologia):**
- `strutture`: SELECT pubblico (anon+authenticated) dove `attivo=true` **+** SELECT per `authenticated` dove `owner_user_id = auth.uid()` (migration 0010 — così l'host vede la propria struttura anche se `attivo=false`); UPDATE per `authenticated` dove `owner_user_id = auth.uid()`
- `strutture_segreti`: RLS on. Dalla 0020 anche `for all` owner-scoped (`struttura_id in (select id from strutture where owner_user_id = auth.uid())`) + grant a `authenticated`, per `GestisciWifi.tsx` — prima era solo service role, zero policy.
- `luoghi`: SELECT pubblico dove `attivo=true` **E** (migration 0013) la struttura è `attivo=true` **+** una policy `for all` per `authenticated` scoped a `struttura_id in (select id from strutture where owner_user_id = auth.uid())`
- `pagine`: SELECT pubblico dove la struttura è `attivo=true` (migration 0013, prima senza restrizioni) **+** policy `for all` per `authenticated` scoped come sopra
- `proposte`: solo la policy scoped per `authenticated` come sopra, nessun accesso pubblico. Scrittura/cancellazione normalmente solo via RPC `salva_scelte_proposte` (0018), non insert/delete diretti dal frontend.
- `domande`: RLS on; SELECT e DELETE per `authenticated` scoped a `struttura_id in (select id from strutture where owner_user_id = auth.uid())` (migration 0008 + 0014). Scrittura solo service role. Nessun accesso anon.
- `statistiche_domande_giornaliere`: RLS on; SELECT solo host proprietario. Contiene giorno, lingua e conteggio, mai testo. `registra_statistica_domanda()` è eseguibile solo da service role (0015).
- `consumi_ai`: RLS on, zero policy — solo service role, via `registraConsumoAI()`. Letto dall'host tramite `api/consumi-ai.js` (verifica superadmin lato server), mai direttamente dal browser (0019).
- `configurazioni_guida` / `ricerche_configurazione`: RLS `for all` owner-scoped. Le RPC `crea_casa_configurata` e `prenota_ricerca_configurazione` fanno i controlli extra (advisory lock, tetto ricerche) che una semplice policy non potrebbe esprimere (0020).
- `soggiorni`: (migration 0013) la vecchia policy pubblica per-soggiorno-attivo è stata **rimossa e non sostituita** — non esiste ancora un modello di accesso sicuro lato ospite per questa tabella. Resta comunque non usata dal frontend (vedi "Non ancora iniziato").
- `sezioni_extra`: SELECT pubblico senza restrizioni; nessuna policy di scrittura (solo service role via API)
- **Storage** `storage.objects`: bucket `copertine` (public), SELECT pubblico. INSERT/UPDATE/DELETE per `authenticated` — dalla **migration 0012** (17-22/09/2026, chiude il debito che questo file segnalava come aperto) delimitato al percorso: primo segmento del path deve essere `auth.uid()` (copertine struttura) OPPURE primo segmento `luoghi` e secondo un `struttura_id` posseduto dal chiamante (foto dei luoghi). Prima (migration 0006) qualunque `authenticated` poteva scrivere OVUNQUE nel bucket.

`supabase/migrations/`: `0001_host_autorizzati.sql`, `0002_strutture_owner_on_delete_set_null.sql`
(FK owner_user_id → SET NULL), `0003_strutture_sezioni_attive.sql` (colonna `sezioni_attive`),
`0004_sezioni_extra.sql` (tabella sezioni custom), `0005_guida_grafica.sql` (colonne `strutture.accento`
+ `strutture.copertina_url`, `luoghi.prezzo` + `luoghi.voto`, `proposte.prezzo` + `proposte.voto`;
lanciata su Supabase 03/09/2026), `0006_storage_copertine.sql` (bucket Storage pubblico `copertine`
+ policy su `storage.objects`: INSERT/UPDATE/DELETE per `authenticated`, SELECT pubblico; per il
pulsante "Carica foto" in ModificaCasa), `0007_note_gennarino.sql` (colonna `strutture.note_gennarino`,
letta da `api/gennarino.js` — SQL prima del push), `0008_domande_lettura_host.sql` (RLS su `domande` +
policy SELECT per l'host, per la pagina `/admin/domande`), `0009_pagine_da_tradurre.sql` (colonna
`pagine.da_tradurre` + azzera i flag vestigiali di `luoghi.da_tradurre`), `0010_strutture_select_owner.sql`
(policy SELECT `strutture` per l'owner), `0011_luoghi_foto.sql` (colonna `luoghi.foto_url`, 13/09/2026 —
lanciata dall'utente su Supabase su mia richiesta, prima del push del codice che la legge),
`0012_storage_copertine_per_host.sql` (upload Storage delimitato al proprietario),
`0013_rls_contenuti_solo_guide_pubblicate.sql` (contenuti pubblici solo di guide attive; toglie anche l'unica
policy pubblica di `soggiorni`, senza sostituirla), `0014_domande_eliminazione_host.sql` (DELETE dello storico
solo al rispettivo host), `0015_statistiche_domande_anonime.sql` (conteggi giornalieri anonimi + funzione
server-side), `0016_archivio_sezioni_extra.sql` (colonna `sezioni_extra.archiviata`), `0017_proposte_fonti.sql`
(colonna `proposte.verifica`), `0018_salva_scelte_proposte.sql` (RPC `salva_scelte_proposte`, salvataggio a
lotto delle proposte Scout), `0019_consumi_ai.sql` (tabella `consumi_ai`, RLS zero-policy) e
`0020_configurazione_wifi.sql` (`strutture_segreti.reti_wifi` + relativa policy owner-scoped,
`configurazioni_guida`, `ricerche_configurazione`, RPC `crea_casa_configurata` e
`prenota_ricerca_configurazione`) — tutte e 9 (0012-0020) lanciate/verificate nella finestra 17-22/09/2026,
lavoro fatto passando il progetto per ChatGPT/Codex. Lo schema sopra resta la fonte di verità scritta;
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
| `ANTHROPIC_API_KEY` | solo Vercel (tipo Secret) | `lib/genera-descrizione-casa.js`, `api/traduci-guida.js`; in `scout.js` è il 2° anello della cascata (17-22/09/2026, `MOTORE_SCOUT` rimosso — non più condizionata da un interruttore); `gennarino.js` solo se `MOTORE_GENNARINO='claude'` |
| `GEMINI_API_KEY` | `.env.local` + Vercel (tipo Secret) | `scout.js` (1° anello della cascata: Interactions + Maps grounding); ripiego per `gennarino.js` |
| `GEMINI_API_KEY_GENNARINO` | solo Vercel (tipo Secret) | chiave Gemini dedicata a `gennarino.js` (`generateContent`). Se assente → usa `GEMINI_API_KEY` |
| `VITE_ADMIN_EMAIL` | `.env.local` + Vercel (tutti gli env, tipo Config) | email del superadmin. Frontend (`import.meta.env`) per mostrare le sezioni "Invita host"/"Consumi AI"; `api/host-autorizzati.js`/`api/consumi-ai.js` (`process.env`) come vera guardia |
| `VITE_GEOAPIFY_API_KEY` | `.env.local` + Vercel (tipo Config, **non** Secret) | (17-22/09/2026) letta SIA lato browser (`IndirizzoAutomatico.tsx`, autocompletamento indirizzo) SIA lato server (`process.env`, stessa variabile, in `scout.js`: geocodifica, 4° anello della cascata, calcolo distanze reali). Essendo `VITE_`-prefixed finisce nel bundle pubblico: stesso livello di fiducia della anon key, non è davvero un segreto anche se usata anche server-side |
| `OPENROUTER_API_KEY` | solo Vercel (tipo Secret) | (17-22/09/2026) `scout.js`, 3° anello della cascata (modello gratuito `qwen/qwen3.8-27b:free` + `web_search` via Exa) |
| `EXA_API_KEY` | solo Vercel (tipo Secret) | (17-22/09/2026) `scout.js`, conferma via web dei candidati Geoapify (4° anello) — facoltativa: se assente, quei candidati non vengono mai confermati e quindi mai proposti, nessun errore |
| `CRON_SECRET` | solo Vercel (tipo Secret) | guardia di `api/pulisci-domande.js` (`Authorization: Bearer CRON_SECRET`), già in uso da metà settembre ma non ancora in questa tabella prima d'ora |

I valori reali vanno letti da `.env.local` (locale, gitignored) o dal dashboard Vercel — non richiederli/riscriverli qui.

## Testare le modifiche

- Solo frontend (componenti in `src/`, non `/api`): `npm run dev`, testare in locale prima del push. `npm run dev` punta comunque al Supabase remoto (non c'è un DB locale): una migration che aggiunge colonne lette in `select` va lanciata prima anche per i test locali.
- `vite.config.ts` legge `process.env.PORT` (default 5173): serve solo a poter avviare un secondo dev server su un'altra porta quando 5173 è occupata. Ininfluente per il build/deploy.
- Qualsiasi modifica a `/api/*.js` o `/lib/*.js`: **non testabile in locale**, `npm run dev` non esegue le funzioni serverless. Serve fare push e testare su `https://haplyhost.vercel.app/...` dopo che Vercel ha ridistribuito (circa un minuto).
- Trio standard di pubblicazione, sempre dalla radice del progetto: `git add .` / `git commit -m "..."` / `git push`. **Controllare sempre la cartella corrente prima**: in passato comandi git sono stati lanciati per errore da dentro `src/admin` o da una cartella `admin` vuota creata per sbaglio nella radice — questo fa sì che `git add .` non veda affatto le cartelle `api/` e `lib/`, con file mancanti nel push senza errori evidenti.
- Su Supabase SQL Editor può comparire un popup "Potential issue detected... enable RLS?": scegliere **"Run without RLS"** per script che fanno solo INSERT/UPDATE su tabelle esistenti; **"Run and enable RLS"** solo quando lo script contiene dei veri `CREATE TABLE`.
- Incidente noto: quel popup ha causato l'esecuzione doppia di uno script di import, duplicando 55 righe in `luoghi` — dopo un import massivo, controllare sempre il conteggio righe atteso.
- **Test automatici in `lib/`** (17-22/09/2026, prima non esisteva infrastruttura di test in questo repo): file `*.test.js`
  con `node:test`/`node:assert` — nessuna dipendenza nuova, si lanciano con `node --test lib/`. Coprono la logica pura
  (doppioni Scout, validazione dati configurazione, calcoli di `proposte-scout.js`), non le chiamate HTTP vere.

## Costi AI (incidente 31/08/2026)

L'account Anthropic è andato a saldo negativo (−0,37 USD) → tutte le funzioni AI ferme per qualche
ora (Gennarino V1 e V2, Scout, generazione descrizioni). Causa: account con poco credito iniziale +
una giornata di sviluppo pesante su Claude Sonnet 5 (Scout con ricerca web, "Casa da un link",
"Rigenera", retry). La V1 "StayFlow" (ancora live) è un consumo di sfondo minore, non la causa.

Mitigazioni fatte:
- Scout **spostato da Claude a Gemini 3.1 Flash-Lite + Google Maps grounding** (in `scout.js`). Costo
  ~1/10, grounding gratis fino a 5.000/mese. Scout riattivato (`RICERCHE_ATTIVE = true`).
- `vercel.json`: `maxDuration: 60` per `api/scout.js` (le chiamate Gemini+grounding durano ~10-18s).
- **Aggiornamento 17-22/09/2026**: `MOTORE_SCOUT` non esiste più — Scout ora prova Gemini, poi Claude,
  poi OpenRouter (**gratis**), poi Geoapify+Exa in cascata (vedi `api/scout.js` nella struttura del
  repo sopra), invece di un solo motore fisso. E soprattutto: **ora c'è visibilità reale sui consumi**
  — ogni chiamata AI (Gennarino, Scout, traduzioni, descrizioni) scrive una riga in `consumi_ai`
  (`lib/consumi-ai.js`), consultabile dal superadmin in `/admin/piattaforma/consumi-ai` (totali, per servizio/
  fornitore/modello, errori). Non è un saldo residuo (Google/Anthropic non lo espongono via API), ma
  prima di questo non c'era NESSUNA visibilità sui consumi finché non arrivava un errore o un saldo
  negativo — questo era il primo punto debole che ha causato l'incidente del 31/08.

Fatto (10/09/2026) su `gennarino.js`: **tetto a `domanda`/`storico`** (`domanda` ≤ 1500 char, `storico`
alle ultime 12 righe da 2000 char — `pulisciStorico`; `maxLength` anche sull'input in `Gennarino.tsx`)
+ **rate limit grezzo per struttura** (429 se >15 righe in `domande` nell'ultimo minuto — dosso, non muro).
**Bug corretto (14/09/2026)**: i tasti WhatsApp/Chiama in chat (vedi Gennarino.tsx sopra) non
comparivano mai. `struttura.host_telefono` è salvato con prefisso internazionale ("+39 335 173
3758") ma Gennarino lo scrive quasi sempre senza ("335 173 3758", verificato in prod) — il confronto
cercava il numero SALVATO per intero dentro al testo scritto dall'AI, e un testo più corto non può
mai contenere una stringa più lunga. `contieneTelefono()` ora confronta solo le ultime 9 cifre (il
prefisso internazionale è sempre davanti, non cambia la coda), funziona con o senza prefisso da
entrambi i lati. Trovato da uno screenshot reale della produzione, non dalla verifica in locale (il
test fatto allora usava lo stesso valore da entrambe le parti, quindi combaciava per costruzione
senza provare il caso vero).

Mitigazioni ancora da fare (in ordine): **rate limit per IP** vero su `/api/gennarino` (serve uno store
esterno tipo Upstash — quello per struttura non ferma un attacco distribuito o a raffica); ricarica
automatica Anthropic + tetto di spesa sulla Console; workspace/chiave API separati per sviluppo vs
produzione; cache del prompt (il system prompt con 69 luoghi + 6 pagine riparte intero a ogni messaggio —
su Claude si può usare `cache_control`, su Gemini il caching è implicito e ha una soglia minima di token);
cache 24h su `/api/consiglio` della V1; rigenerare la `GEMINI_API_KEY` (passata in chat il 01/09).

## Stato attuale (fine agosto 2026)

**Funzionante e pubblicato:**
- Routing multi-struttura da slug, con le 13 tessere della griglia (7 elenco + 6 testo)
- Contenuti reali di Villa Virginia importati da StayFlow V1 (55 luoghi + 6 pagine testuali)
- Gennarino: chat AI grounded sui dati reali della struttura, markdown disabilitato nel prompt, log su `domande`
- Pannello host: login magic-link, gestione on/off + modifica/elimina/**aggiungi a mano** luoghi su tutte le sezioni elenco (con distanza in lista), editor per le pagine testuali, link "Vedi la guida degli ospiti", pagina "Sezioni della guida" (scegli quali tessere mostrare agli ospiti — `strutture.sezioni_attive`)
- **Sezioni custom del superadmin**: pagina `/admin/piattaforma/sezioni-extra` (22/09/2026, prima `/admin/sezioni-extra`; solo superadmin) per creare e modificare sezioni oltre le 14 di sistema, tipo testo o elenco. Vivono in `sezioni_extra`, si uniscono ovunque via `useSezioni()`, nascono spente per tutti gli host. “Archivia” le nasconde senza cancellare i contenuti; “Ripristina” le riporta online. **Prerequisiti prod: migration 0004 + 0016.**
- Scout: ricerca nuovi luoghi con approvazione a lotto. Riattivato (`RICERCHE_ATTIVE`). Restituisce anche prezzo e voto Google (colonne `proposte.prezzo`/`voto`, copiati nel luogo alla scelta). Errori/esito veri mostrati nel pannello. **Raggio di ricerca (13/09/2026)**: tendina in `GestisciSezione.tsx` (1/5/15/30/150 km, default 5) → `raggio_km` nel prompt invece del generico "vicino a questo indirizzo". ⚠️ Vedi il bullet "Scout irrobustito (17-22/09/2026)" più sotto — il motore unico `MOTORE_SCOUT` di questa riga non esiste più, sostituito da una cascata di 4 fornitori.
- **Reskin della guida ospiti** (migration 0005, verificato in prod 03/09/2026): design system "g-*" in `src/index.css` (spirito StayFlow: Nunito, hero, griglia di tessere, barra in basso `TabBar`, FAB `GennarinoFab`, modalità chiara/scura). Due leve per l'host in ModificaCasa: colore d'accento (`strutture.accento`, 5 preset, iniettato come `--g-accent` inline sullo `.g-shell`) e foto di copertina — **"Carica foto"** (upload su Storage bucket `copertine`, migration 0006) o link incollato. Schede luogo con pastiglie prezzo/voto (`luoghi.prezzo`/`voto` da Scout). Selettore icone in SezioniExtra (13/09/2026, era emoji). "+ Aggiungi un luogo a mano" in GestisciSezione. Il pannello admin ha il suo vestito separato (`admin/ui.tsx`, 14-16/09/2026, vedi sotto). "Il consiglio di oggi": rimandato.
- **Caricamento più leggero (17/09/2026):** `App.tsx` carica chat, sezioni secondarie e pannello host solo quando vengono aperti (`lazy` + `Suspense`). La guida Home non scarica più in anticipo l'intero Admin: bundle iniziale da circa 566 KB a 271 KB, senza cambiare rotte o funzionalità.
- **Errori guida ospiti (17/09/2026):** `SezionePage.tsx` e `PaginaStatica.tsx` distinguono un contenuto davvero vuoto da un errore di caricamento Supabase. Nel secondo caso mostrano `T[lingua].erroreCaricamento`, invece di far pensare all'ospite che l'host non abbia inserito nulla.
- **Scout irrobustito (17-22/09/2026, lavoro fatto passando il progetto per ChatGPT/Codex)** — `MOTORE_SCOUT` rimosso: ora una cascata di 4 fornitori (Gemini → Claude → OpenRouter gratis → Geoapify+Exa), che salta chi non ha la chiave e passa oltre su errore o zero risultati verificati. Tre problemi reali corretti nello stesso lavoro: **doppioni** (Scout aveva proposto "Vaillum" quando esisteva già "Vatillum Pizzeria Paestum" — ora `lib/identita-luoghi.js` li blocca lato server, e ri-controlla anche le proposte più vecchie salvate prima di questo controllo); **fonti non verificate** (un nome dev'essere citato letteralmente nella fonte, non solo "una fonte esiste da qualche parte" — `proposte.verifica`, migration 0017, mostrata come pannello "Fonti e dettagli da verificare"); **distanza inventata dal modello** (ora sempre ricalcolata da coordinate vere via Geoapify, mai quella dichiarata dall'AI). Il flusso di approvazione è cambiato da Accetta/Rifiuta per-riga a spunte + un unico "Salva le scelte" (RPC `salva_scelte_proposte`, migration 0018, transazione atomica). Vedi `api/scout.js` e `lib/proposte-scout.js`/`lib/identita-luoghi.js` nella struttura del repo sopra per il dettaglio tecnico. **Prerequisiti prod aggiuntivi**: `VITE_GEOAPIFY_API_KEY` (già usata anche per l'autocompletamento indirizzo, vedi sotto), `OPENROUTER_API_KEY`, `EXA_API_KEY` (facoltativa) su Vercel.
- **Area piattaforma separata (22/09/2026)** — Invita host, Sezioni piattaforma e Consumi AI (le uniche pagine SOLO superadmin) sono state spostate sotto `/admin/piattaforma/*`, con una shell propria (`PiattaformaShell.tsx`, barra laterale viola/indaco, non slate) invece di stare dentro `AdminShell.tsx` come un gruppo di link. **Primo tentativo, scartato lo stesso giorno**: solo un badge viola "Modalità piattaforma" sulle pagine + tinta viola sul gruppo nella barra laterale, tutto ancora dentro `AdminShell.tsx` — troppo leggero, il cliente ha chiesto una separazione vera. `AdminShell.tsx` ora ha un solo link "Vai alla piattaforma"; `Admin.tsx` (dashboard, mobile) idem. `PiattaformaShell.tsx` verifica da sé `isSuperadmin` e rimanda a `/admin` altrimenti (un host non può nemmeno vederla digitando l'URL a mano) e ripassa lo stesso `ContestoHost` via `Outlet`, invariato — le tre pagine non hanno dovuto cambiare la loro logica, solo il target del back-link (`indietro="/admin/piattaforma"`, `PaginaAdmin` ora accetta anche una stringa oltre a `true/false`). Nuova pagina hub `PiattaformaHome.tsx` (indice di `/admin/piattaforma`, principalmente per mobile). Verificato in locale (mobile e desktop, contesto superadmin finto rimosso a fine verifica).
- **Consumi AI (17-22/09/2026)** — prima non c'era NESSUNA visibilità sui consumi delle chiamate AI finché non arrivava un errore o un saldo negativo (causa diretta dell'incidente del 31/08). Ora ogni chiamata (Gennarino, Scout, traduzioni, descrizione casa) registra una riga in `consumi_ai` (`lib/consumi-ai.js`, "fire and forget": non deve mai far fallire la chiamata che sta misurando); il superadmin la vede in `/admin/piattaforma/consumi-ai` — totali Oggi/7gg/30gg, per servizio/fornitore/modello, ultimi errori (solo tipo, mai testo). **Non è un saldo residuo**: Google e Anthropic non espongono un vero credito rimanente via API, la pagina lo dice esplicitamente.
- **Autocompletamento indirizzo (17-22/09/2026)** — `src/admin/IndirizzoAutomatico.tsx`, Geoapify, usato in CreaStruttura e ModificaCasa. Degrada da solo a un campo di testo semplice se manca la chiave, come già fa Meteo.tsx per il meteo.
- **Configurazione guidata della guida + reti Wi-Fi multiple (17-22/09/2026)** — la feature più grande di questa finestra. Onboarding di una nuova struttura ora scegli **guidata** (AI-assisted, con un wizard a 3 passi: dati casa → sezioni da mostrare → una ricerca Scout automatica per sezione con approvazione) o **manuale** (guida vuota, zero chiamate AI, verificato nei test). Progresso salvato **server-side** (`configurazioni_guida`, non nello stato del componente) apposta perché chiudere la scheda a metà non perda nulla — `Admin.tsx` mostra "Riprendi la configurazione" se la riga esiste. La ricerca automatica iniziale è a tetto rigido (**10 sezioni per struttura**, RPC `prenota_ricerca_configurazione`) e idempotente (non riparte due volte sulla stessa sezione). **Reti Wi-Fi multiple**: `strutture_segreti.reti_wifi` (jsonb, fino a 20 reti con nome/password/zona) sostituisce concettualmente le vecchie colonne singole (non cancellate, solo superate) — editabili sia in fase di creazione (`RetiWifi.tsx`) sia dopo (`GestisciWifi.tsx` dentro ModificaCasa.tsx), con una policy RLS nuova che apre `strutture_segreti` all'host proprietario (prima era raggiungibile SOLO da service role, zero accesso diretto). ⚠️ **Non ancora deciso**: se e come mostrare il Wi-Fi nella guida ospiti — per ora resta solo nel pannello host (vedi `docs/configurazione-guida.md`, non codice ma note dell'autore). Vedi `ConfiguraGuida.tsx`, `SceltaSezioni.tsx`, `PassiConfigurazione.tsx`, `RetiWifi.tsx`, `GestisciWifi.tsx` nella struttura del repo sopra.
- **Pannello admin più largo su desktop (17-22/09/2026)** — `PaginaAdmin`/`Admin.tsx`/`AdminShell.tsx` passano da `lg:max-w-xl` a `lg:max-w-3xl lg:px-8`: pagine meno strette accanto alla barra laterale. Puro layout, nessun cambio di comportamento.
- **Gennarino nascosto in home (17-22/09/2026)** — il bottone flottante di Gennarino (`GennarinoFab.tsx`) ora si nasconde anche sulla home stessa, non solo sulla rotta chat: la home ha già la sua casella "Chiedi a Gennarino", il flottante lì era ridondante.
- **Via le emoji, dentro icone professionali (13/09/2026)** — primo passo del redesign strategico discusso con l'host (mockup + 5 punti proposti). Libreria `lucide-react`. Le 14 icone di sistema passano da emoji a nomi-icona (`src/sezioni.ts`), renderizzate ovunque tramite `<Icona nome={...} />` (`src/Icona.tsx` + registro `src/icone.ts`): un nome mancante o non riconosciuto ricade su un'icona generica, mai testo grezzo — copre anche le vecchie sezioni custom con l'emoji ancora salvata in `sezioni_extra.icona`. Toccati: griglia Home, barra in basso, FAB Gennarino, intestazioni sezione/pagina, pulsanti WhatsApp/Chiama/Mappa, pulsante "Cerca nuovi luoghi", selettore lingua (ora solo sigla IT/EN/FR/DE/ES, niente più bandiere — stessa scelta in `/admin/domande` per la lingua della domanda), checklist "Primi passi" + indicatore online + link di navigazione del pannello host, selettore icone di `/admin/sezioni-extra`. **Lasciati apposta, non sono l'emoji del problema**: le stelline di voto (★, non un pittogramma colorato), i segni ✓/✕ nei testi di conferma ("Salvato ✓" e simili), e l'emoji dentro il testo libero di `luoghi.distanza` (convenzione dati esistente, es. "🚶 7 min a piedi" — cambiarla tocca i dati reali e il prompt di Scout, è un lavoro a parte). Verificato in locale sulla guida ospiti (browser); lato pannello host solo build + type-check + lint puliti (richiede login magic-link, non simulabile in automatico). Prossimi passi del redesign: vestito nuovo del pannello admin (barra laterale fatta, sotto), poi Home come dashboard concierge.
- **Pannello host: barra laterale su schermi larghi (13/09/2026)** — continuazione del redesign, direzione scelta a vista da un confronto A/B (mockup, non nel repo): mobile resta "sobrio" com'era, desktop diventa "dashboard SaaS". Nuovo `AdminShell.tsx` (vedi struttura del repo sopra): da 1024px in su ogni pagina di `/admin/*` ha una barra laterale con tutta la navigazione; sotto i 1024px zero cambiamenti, verificato confrontando il testo reso alle due larghezze. Verificato in locale con un contesto host finto (creato e rimosso nella stessa sessione, mai nel repo) perché il login vero richiede il link via email. Nella stessa sessione, subito dopo: su desktop la home (`Admin.tsx`) guadagna anche 3 tessere con numeri veri (luoghi in guida, pagine di testo, test da tradurre — dati già calcolati per la checklist, nessuna query nuova) + una griglia di 4 scorciatoie (Vedi la guida, Dati della casa, Sezioni della guida, Traduzioni), `hidden lg:grid`. Niente statistiche finte, come da principio deciso col cliente.
- **Pannello host: vestito grafico condiviso (14-16/09/2026)** — continuazione del punto 4, ora esteso a **tutte** le pagine del pannello. `src/admin/ui.tsx`: componenti comuni (`PaginaAdmin`, `Sezione`, `Campo`, `classeCampo`, `Pulsante`, `Esito`) — palette slate neutro + ambra solo per il focus, bottoni primari `slate-900` (non ambra piena, contrasto migliore). Prima pagina riscritta con questi componenti (14/09): `ModificaCasa.tsx`, come prova. Nel farlo, trovato e corretto un bug pre-esistente in `AdminShell.tsx`: senza uno sfondo chiaro esplicito, su un browser con tema scuro il pannello risultava nero e i testi scuri (compreso il titolo della pagina) quasi illeggibili — ora `bg-slate-50 lg:bg-slate-100` fisso, l'admin non segue mai il tema del sistema (a differenza della guida ospiti). Confermato dal cliente, esteso lo stesso giorno a `NoteGennarino`, `TraduciGuida`, `GestisciPagina`, `SezioniGuida`, `DomandeOspiti`, `InvitaHost`, `SezioniExtra`, `CreaStruttura`, `GestisciSezione` e `Admin.tsx` (dashboard: niente `<PaginaAdmin>`, due helper locali `Scorciatoia`/`Passo` per le sue griglie su misura — vedi struttura del repo sopra). **Lezione tecnica**: Tailwind v4 ha spostato il modificatore "important" da prefisso a suffisso (`classe!`, non più `!classe`) — un primo tentativo di ricolorare di verde i bottoni "Cerca nuovi luoghi"/"Accetta" in `GestisciSezione.tsx` sovrascrivendo `<Pulsante>` con `!bg-green-600` in coda a `className` non avrebbe funzionato (sintassi vecchia, ignorata silenziosamente); risolto con un `<button>` semplice a classi esplicite invece di forzare un override su `<Pulsante>`. Verificato in locale (mobile e desktop, chiaro e scuro, contesto finto rimosso a fine verifica): dashboard con dati reali (86 luoghi, 6 pagine), elenco e modifica inline di GestisciSezione (ordine per distanza confermato: 3, 5, 5, 5, 5, 5, 6, 7 minuti), note e traduzioni.
- **Avatar di Gennarino (16/09/2026, PROVA non confermata)** — `src/GennarinoAvatar.tsx` (vedi struttura del repo sopra), al posto dell'icona generica `MessageCircle` nell'intestazione della chat e nel bottone flottante. Scartata l'idea di una foto "reale" (rischio uncanny-valley per un personaggio senza un aspetto già definito da nessuna parte): scelto un volto geometrico minimale col gradiente d'accento della struttura, stesse variabili CSS di `.g-ask`. Nello stesso scambio, proposta ma non ancora costruita: foto di copertina a rotazione nella Home (riuserebbe `luoghi.foto_url`, nessuna infrastruttura nuova). Ricerca fatta (via web) sulle Google Places Photos per l'idea di pescare foto dei luoghi online: esclusa dai termini Google (non si possono conservare/"warehouse", vanno ri-scaricate ad ogni vista, serve attribuzione) — confermato che l'upload manuale già in produzione resta la scelta giusta. Verificato in locale (chat + FAB, screenshot). **Da chiedere al cliente dopo averlo visto**: tenerlo così, rifinirlo, o tornare all'icona generica.
- **Home ospiti come dashboard concierge (13/09/2026)** — punto 2 del redesign strategico (punto 5, Free+Commissioni, **abbandonato a parole dal cliente lo stesso giorno**: resta il modello a 3 piani). Hero: saluto per fascia oraria (`saluto()` in lingua.ts, in base all'ora del telefono — niente identità ospite) + pallino meteo (`Meteo.tsx`, Open-Meteo, gratis, senza chiave, da `strutture.lat/lng`). Sotto: scorciatoia `.g-ask` "Chiedi a Gennarino" sempre visibile, e card `.g-today` "Oggi ti consiglio" — un luogo tra i meglio votati delle sezioni visibili, **scelto senza AI** (ruota una volta al giorno, non ad ogni apertura) per non ripetere l'incidente di costo del 31/08/2026 che aveva già fatto togliere una versione IA di questa stessa idea. Griglia sezioni invariata sotto, con l'etichetta "Esplora la guida". Non fatto: saluto con il nome dell'ospite (servirebbe un'identità ospite, una feature a sé). Verificato in locale in italiano e inglese, chiaro e scuro. **Seguito, stesso giorno**: "Chiedi a Gennarino" da link a casella di scrittura con 3 esempi cliccabili — l'ospite scrive/tocca e si ritrova già in chat con la risposta in corso, invece di dover aprire la chat e riscrivere. "Oggi ti consiglio" ora scorre fino al luogo esatto ed evidenzia la scheda, non lascia più l'ospite a cercarlo nell'elenco della sezione.
- **Foto per singolo luogo (13/09/2026)** — punto 3 del redesign strategico, versione minima scelta apposta: upload manuale dell'host in `GestisciSezione.tsx` (uguale per tutte e 7 le sezioni elenco, nessuna sezione privilegiata via codice — l'host decide da dove iniziare), **niente fetch automatico** da API esterne (avrebbe voluto dire un altro fronte di costo, proprio dopo l'incidente del 31/08). Riusa in tutto e per tutto il meccanismo già in produzione per la copertina della struttura: `ridimensionaImmagine()` estratta in `src/immagine.ts` (prima viveva solo dentro ModificaCasa.tsx), stesso bucket Storage `copertine`. Migration `0011_luoghi_foto.sql` (`luoghi.foto_url`) lanciata dall'utente su richiesta, prima del push. Guest-side: `SezionePage.tsx` mostra la foto come intestazione della scheda `.g-place` (140px, object-fit cover) quando c'è, nessun cambiamento quando manca. **Debito noto, non affrontato qui**: la policy Storage del bucket `copertine` (migration 0006) non è scoped per host — un host autenticato potrebbe in teoria sovrascrivere il file di un altro se ne indovinasse il percorso esatto. Era già così per le copertine da quando esistono più host (10/09/2026); questa funzione aggiunge uso allo stesso bucket ma non peggiora la policy. Da chiudere con una vera policy scoped per `struttura_id` quando c'è tempo. **Verificato**: lettura lato ospite (query reale, nessun errore) e interfaccia admin (con dati reali di Villa Virginia, tramite un contesto finto rimosso a fine verifica) in locale; il caricamento vero di un file richiede una sessione autenticata reale (bucket Storage: policy INSERT per `authenticated`), non simulabile in automatico — verificato dall'utente dopo il push.
- **Multilingua della guida ospiti** (IT/EN/FR/DE/ES, nessuna migration): all'apertura la guida si mette nella lingua del telefono (`navigator.language`), con selettore in alto a destra (scelta ricordata in localStorage). Testi fissi da un dizionario (`src/lingua.ts` `T`); luoghi da `luoghi.traduzioni` con ripiego all'italiano; etichette sezioni tradotte (solo le 14 di sistema — le custom restano in italiano). Gennarino risponde nella lingua dell'ospite (`api/gennarino.js` accetta `lang`). Le pagine di testo e i luoghi senza traduzione si riempiono con **"Traduci la guida"** in ModificaCasa → `api/traduci-guida.js` (Haiku). Verificato frontend in locale 03/09/2026.
- Base multi-tenant: `owner_user_id`, RLS scoped per host, un host vede/modifica solo la propria struttura
- "Casa da un link": creazione struttura da {nome, indirizzo, link}, con generazione automatica di `descrizione_casa` + `citta`. Testato con successo anche con un annuncio Airbnb. **Aggiornato (09/09/2026)**: la struttura nasce `attivo=false` (bozza) e l'host la pubblica dal pannello; `host_autorizzati.registrato_il` viene segnato alla creazione.
- **Host con più strutture (10/09/2026)**: rimosso il blocco "ne hai già una" in `importa-casa.js` — un host può creare più
  strutture (limite di piano non ancora applicato). `RichiedeLogin.tsx` le risolve tutte e tiene quella "selezionata"
  (`localStorage`); `Admin.tsx` mostra una tendina per cambiarla quando sono più di una, e sempre il link
  "+ Aggiungi un'altra struttura" (`/admin/nuova-struttura`, riusa `<CreaStruttura aggiuntiva>`). Nessuna migration, nessuna
  policy RLS nuova: `owner_user_id` era già una FK non-unica e le policy scoped (`luoghi`/`pagine`/`proposte`/`domande`) erano
  già `struttura_id in (select ... where owner_user_id = auth.uid())`, quindi già multi-struttura di natura loro. Le altre
  pagine admin (GestisciSezione, ModificaCasa, ecc.) non toccate: leggono `struttura` dal contesto come sempre.
- **"Modifica Casa"** (`src/admin/ModificaCasa.tsx` + `api/aggiorna-casa.js` + `lib/genera-descrizione-casa.js`, rotta `/admin/modifica-casa`, pulsante nel pannello): l'host modifica tutti i dati della struttura (nome, indirizzo, citta, descrizione_casa, host_nome, host_telefono, checkin, checkout, max_ospiti) con UPDATE diretto, e può rigenerare descrizione+citta da un nuovo link. Testato in produzione 30/08/2026. **Foto di copertina (13/09/2026)**: ridimensionata e ricompressa lato client (canvas, max 1920px, JPEG 0,85) prima dell'upload — un JPEG da telefono da 8-15 MB ora passa; tetto grezzo 30 MB in ingresso, 8 MB dopo la compressione (non dovrebbe mai scattare). Verificato in locale (browser, nessun login richiesto: pura logica canvas).
- Gennarino ora include nella knowledge base anche `descrizione_casa`, `host_telefono`, `max_ospiti` (prima `descrizione_casa` non era usata da nessuno). Verificato: risponde con i dettagli della casa presi da `descrizione_casa`.
- **Redesign della Home ospiti + pagina Privacy (22/09/2026)** — verificato in locale (chiaro/scuro, mobile/desktop, IT/EN, console pulita, `npx tsc -b`/lint/build puliti), **non ancora pubblicato in produzione**. Nuova riga di scorciatoie sotto il selettore lingua (Wi-Fi/Info casa/WhatsApp host — quest'ultima verificata con `wa.me/<numero>` corretto); "Chiedi a Gennarino" e "Oggi ti consiglio" affiancati da 900px in su (`.g-home-featured`, prima nessun layout desktop dedicato, confermato in browser a 1200px: due colonne 1.2fr/1fr); "Oggi ti consiglio" mostra la foto del luogo quando c'è; `TabBar.tsx` passa da "Home + prime 2 sezioni + Gennarino" a tre tab fissi "Home | Esplora | Gennarino" (il centrale scorre a `#esplora` sulla home invece di aprire una sezione specifica, verificato che lo scroll avviene anche arrivando da un'altra pagina). Nuova pagina `/:slug/privacy` (`PaginaPrivacy.tsx` + `privacy.ts`, 5 lingue, testato IT/EN), linkata da Gennarino e dalla home — **il file stesso si dichiara bozza**: mancano titolare, contatti, basi giuridiche, trasferimenti extra-UE, da completare prima che sia un'informativa vera. Testi nuovi in `src/testiHome.ts`; ripulito `src/lingua.ts` dai due export ormai morti che questo lavoro aveva lasciato indietro (`SUGGERIMENTI_GENNARINO`, `gennarinoPrivacy`). File coinvolti: `src/Home.tsx`, `src/TabBar.tsx`, `src/index.css`, `src/App.tsx`, `api/sezioni-extra.js` (route `privacy` riservata), `src/Gennarino.tsx`, `src/lingua.ts`, + i nuovi `src/PaginaPrivacy.tsx`/`src/privacy.ts`/`src/testiHome.ts`.

- **Wi-Fi per soggiorno (23/09/2026)** — verificato in locale (build, `tsc -b`, 29 test `lib/`, browser con risposte del server simulate), **non ancora pubblicato**. La password Wi-Fi compare nella pagina `casa` ("Casa & Wi-Fi") con tasto Copia **solo dal giorno del check-in al giorno del check-out (compreso, fuso Europe/Rome)** e solo con il **link personale del soggiorno** (`/<slug>?s=<token>`): la guida resta anonima, il token è la chiave. Pezzi: migration `0021_soggiorni_link_wifi.sql` (`soggiorni.token` generato dal DB, unique, check `checkout >= checkin`, policy `for all` owner-scoped + grant a `authenticated`; nessun accesso anon, come da 0013); `lib/soggiorni.js` (`statoSoggiorno()`, `oggiInItalia()`, `tokenValido()`, + `.d.ts` e test); `api/wifi.js` (pubblico, GET `?slug&s`, service role: 404 se token/slug/guida non valida o guida in bozza, `presto` → solo la data di check-in, `scaduto` → niente, `in_corso` → reti da `strutture_segreti.reti_wifi`; `Cache-Control: no-store`); `src/BloccoWifi.tsx` + `src/testiWifi.ts` (5 lingue) + stili `.g-wifi*` in index.css, montato da `PaginaStatica.tsx` quando `chiave==='casa'`; `src/soggiornoOspite.ts` + `Struttura.tsx` (cattura `?s=`, lo salva in localStorage per struttura e lo toglie dall'URL); pannello host `src/admin/Soggiorni.tsx` (rotta `/admin/soggiorni`: crea soggiorno con nome/check-in/check-out, copia link, elimina). Senza link personale la pagina mostra solo come ottenere la password. Gennarino non vede mai le password. **Prerequisito prod: lanciare 0021 su Supabase PRIMA del push** (il codice legge `soggiorni.token`). Nota: `node --test lib/` fallisce su Windows anche prima di questa modifica (tratta `lib/` come file) — usare `node --test lib/*.test.js`.

**Ancora sul disco, non deciso (non collegato al redesign sopra):**
- **`AGENTS.md`** (radice del repo, untracked): copia di questo file congelata a metà settembre (prima della finestra 17-22/09), con ogni occorrenza di "Claude" sostituita meccanicamente con "Codex" — anche dentro nomi di modello che così non esistono davvero (es. non è mai esistito un modello chiamato "Codex-haiku-4-5"). Probabilmente generato una tantum dal tooling Codex CLI e mai più aggiornato. Da decidere: cancellarlo o tenerlo sincronizzato apposta per chi usa quello strumento su questo stesso repo.

**Gate registrazione host + invito superadmin (pubblicato, testato in prod 31/08/2026):**
- `Login.tsx` con `shouldCreateUser: false` — si accede solo con email già in Supabase Auth. Email sconosciuta → messaggio, non il link.
- **Invito host**: tabella `host_autorizzati` + `api/host-autorizzati.js` (GET/POST/DELETE) + `src/admin/InvitaHost.tsx` (rotta `/admin/piattaforma/invita-host`, 22/09/2026 — prima `/admin/invita-host` — raggiungibile solo dall'area piattaforma, vedi PiattaformaShell.tsx, solo se `email === VITE_ADMIN_EMAIL`). Il superadmin autorizza un'email, genera il link di invito e può rimuovere un host: prima le sue strutture passano al superadmin, poi l'account Auth viene eliminato. Questo evita strutture senza proprietario (17/09/2026).
- Serve `VITE_ADMIN_EMAIL` su Vercel + `.env.local` = email del superadmin (oggi `bernardinocalifano@gmail.com`, che possiede Villa Virginia).
- **Incremento B — fatto (09-10/09/2026)**: `importa-casa.js` popola `registrato_il` E verifica `host_autorizzati` (403 se l'email non è in elenco; carve-out per il superadmin `VITE_ADMIN_EMAIL`). Ora il flusso è chiuso su due livelli: login (`shouldCreateUser: false`) + questo check. Un account Auth creato a mano, saltando "Invita host", non riesce più a creare la struttura.
- **Guida in bozza + pubblicazione (09/09/2026)**: nuove strutture nascono `attivo=false`. `Admin.tsx` mostra la card "Primi passi" (checklist: pagine di testo ○/✓, luoghi ○/✓; + link a dati casa, colore/foto, sezioni, traduzioni) e il pulsante "Pubblica la guida" (→ `attivo=true`). Quando è online: "🟢 La guida è online" + "Metti offline" (con conferma). L'host vede/apre la propria guida anche da spenta (migration 0010). **Aggiornato (13/09/2026)**: un ospite anonimo che apre lo slug di una guida non pubblica ora vede "Questa guida non è ancora pubblica" invece di "Struttura non trovata" — `api/verifica-slug.js` (endpoint pubblico, ritorna solo `{esiste}`) fa la distinzione senza esporre i dati della struttura.

**Debiti tecnici aperti:**
- **PWA guida ospiti (17/09/2026):** ogni guida pubblicata espone un manifest dinamico (`/api/manifest?slug=...`), quindi se l'ospite la installa dal browser l'icona apre proprio quella struttura, non una Home generica. Il service worker conserva solo la pagina di cortesia offline: non salva contenuti della guida o chat sul dispositivo, per evitare dati vecchi o lasciati al prossimo ospite. Da provare su un telefono reale dopo il deploy.
- Colonna `strutture.link_riferimento`: documentata ma NON presente nel DB reale. Il codice non la tocca più. Da aggiungere con `ALTER TABLE` (in una migration) + reintrodurre in ModificaCasa/importa-casa/aggiorna-casa per ricordare l'ultimo link usato.
- ~~`soggiorni`: nessun modello di accesso sicuro lato ospite~~ — **risolto in locale (migration 0021, 23/09/2026)**: l'ospite non legge mai la tabella; passa da `api/wifi.js` con un token segreto per soggiorno. Vedi "Wi-Fi per soggiorno".
- ~~Storage bucket `copertine` non scoped per host~~ — **risolto (migration 0012, 17-22/09/2026)**: ora INSERT/UPDATE/DELETE richiedono che il percorso inizi con `auth.uid()` (copertine) o con `luoghi/<una struttura_id posseduta>` (foto dei luoghi).

**Non ancora iniziato:**
  - **Sezioni custom, follow-up**: modifica UI fatta (17/09/2026: nome, icona, descrizione e categoria; il tipo non cambia per non nascondere contenuti). Archiviazione recuperabile fatta (migration 0016): nessun dato viene cancellato, con pulsante “Ripristina”. Restano: riordino da UI (per ora campo `ordine` solo via SQL) e assegnare una sezione custom solo a certi host.
- **Onboarding v2** (gate + "Invita host" + scelta sezioni host [b] + `registrato_il` + verifica `host_autorizzati` +
  bozza/pubblicazione + (d) pagina "in allestimento" fatti; (c) Scout di partenza per sezione, lanciato dal frontend,
  ora fatto anche questo — vedi "Configurazione guidata della guida" sotto "Funzionante e pubblicato" — resta solo:
  - struttura pre-compilata nell'invito (nome/indirizzo già in `host_autorizzati`), opzionale.
- ~~Wi-Fi legato al soggiorno attivo~~ — **fatto in locale (23/09/2026), non ancora pubblicato**: vedi "Wi-Fi per soggiorno" sotto "Funzionante e pubblicato".
- Multilingua, follow-up: traduzione delle etichette delle sezioni **custom** (`sezioni_extra`, oggi solo italiano). Il segnale "traduzione da rifare" è fatto (`da_tradurre` su pagine+luoghi → avviso ambra in `/admin` e in `/admin/traduzioni`; `traduci-guida.js` lo azzera).
- Pulizia dei file orfani nel bucket `copertine` non fatta (quando si cambia/rimuove la foto, il file vecchio resta su Storage).
- Visualizzazione dei sotto-blocchi "Aperitivi" e "Stellati" dentro la pagina "Dove Mangiare" (dati presenti in `luoghi` con quelle sezioni, nessuna UI dedicata — oggi sarebbero raggiungibili solo con un URL manuale tipo `/villavirginia/aperitivi`, non linkato da nessuna parte)
- ~~Reskin del pannello admin~~ — **fatto (14-16/09/2026)**, vedi "Pannello host: vestito grafico condiviso" sotto "Funzionante e pubblicato".
- Foto di copertina a rotazione nella Home (riuso di `luoghi.foto_url`, proposto il 16/09/2026 insieme all'avatar di Gennarino, non ancora costruito).
- **"Il consiglio di oggi"**: c'era nel mockup del reskin (chiamata AI a costo), rimosso su richiesta. Da riprendere quando c'è budget AI e cache.
- Passaggio da Vercel Hobby a Pro (obbligatorio prima di fatturare a un cliente vero, per via dei termini d'uso non-commerciali del piano gratuito)
- ~~Gestione di un host con più strutture~~ — **fatto (10/09/2026)**, vedi "Funzionante e pubblicato". Follow-up
  possibile: un tetto al numero di strutture in base al piano (`host_autorizzati.piano`), oggi illimitato per
  chiunque sia autorizzato.
