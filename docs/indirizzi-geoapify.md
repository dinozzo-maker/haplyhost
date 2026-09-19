# Completamento degli indirizzi

`src/admin/IndirizzoAutomatico.tsx` è il campo condiviso da creazione struttura e modifica casa.
Usa direttamente Address Autocomplete di Geoapify, in italiano, con preferenza per l’Italia
(senza escludere indirizzi esteri). Dopo almeno 3 caratteri attende 400 ms prima della ricerca,
annulla le richieste superate e mostra al massimo 5 suggerimenti. La scelta compila anche la città.
Il numero civico resta da controllare; l’inserimento manuale è sempre possibile.

## Attivazione

1. In https://myprojects.geoapify.com crea un progetto Haplyhost e apri **API Keys**.
2. Configura le origini consentite per la chiave browser: il dominio di produzione effettivo
   (`https://haplyhost.vercel.app`) e, per sviluppo, `http://localhost:5173` e
   `http://127.0.0.1:5173`. Aggiungi eventuali domini personalizzati o preview usati per i test.
3. Aggiungi `VITE_GEOAPIFY_API_KEY=<chiave>` a `.env.local` e alle variabili Vercel degli ambienti desiderati.
   Non inserire il valore in file versionati. È una chiave browser, visibile al client:
   limitarla alle origini previste nella console Geoapify.
4. Riavvia Vite in locale e ricostruisci/ridistribuisci su Vercel: le variabili `VITE_` entrano nella build.

Senza chiave viene mostrato un avviso e il campo continua a funzionare manualmente.
Con chiave errata, quota esaurita o rete non disponibile, la ricerca mostra un errore recuperabile.
Il campo mostra l’attribuzione a Geoapify e OpenStreetMap. La ricerca invia il testo digitato
a Geoapify solo mentre si usa il campo nel pannello host, non dalla guida ospiti.

## Verifica con chiave attiva

- In **Aggiungi struttura** e **Modifica dati della casa**, digitare via e città; selezionare con
  mouse/tocco e con frecce/Invio. Controllare indirizzo e città prima del salvataggio.
- Digitare velocemente, cancellare, premere Esc o uscire dal campo: una risposta precedente
  non deve ripresentare risultati non pertinenti.
- Verificare ricerca vuota, errore di rete e inserimento manuale, anche da telefono.
- Nella creazione, l’API conserva la città selezionata; senza selezione usa quella ricavata
  dalla generazione della descrizione. Questo passaggio serverless si verifica dopo il deploy.

Documentazione: https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/
