# Configurazione iniziale della guida

Il percorso locale comprende scelta guidata/manuale, dati casa con reti Wi-Fi multiple,
selezione sezioni e riepilogo con preparazione, approvazione dei luoghi, anteprima e pubblicazione.

## Attivazione

1. Eseguire `supabase/migrations/0020_configurazione_wifi.sql` sul progetto Supabase V2,
   dopo le migrazioni precedenti (in particolare 0018, usata per approvare le proposte).
2. Pubblicare il codice e verificare l’endpoint `/api/importa-casa` su una nuova struttura di prova.
3. Verificare salvataggio/rilettura di tre reti, ritorno al percorso dal pannello, una ricerca reale
   e approvazione dei risultati. Lasciare la struttura di prova in bozza fino alla verifica.

La migrazione è stata verificata su un database PostgreSQL temporaneo tramite PGlite.
L’utente ha confermato l’aggiornamento del database remoto prima del commit.
Nessun push o modifica ai dati di Villa Virginia.

## Comportamento

- Nuove strutture: `CreaStruttura` crea casa, reti e stato del percorso in una transazione.
  L’id della richiesta evita creazioni duplicate quando si ripete l’invio nello stesso modulo.
- Manuale: nessuna chiamata AI o lettura del link; scelta sezioni e accesso al pannello.
- Guidata: descrizione dal link solo se fornito; scelta sezioni da `useSezioni().tutte`.
  `SceltaSezioni` è condiviso anche con la pagina di gestione delle sezioni esistente.
- `/admin/configurazione`: riprende il passo salvato per la struttura selezionata.
  I dati vengono salvati premendo Salva e continua; i campi non ancora inviati del primo
  passaggio non sono conservati dopo la chiusura o il ricaricamento della pagina.
- Preparazione: una richiesta Scout per ciascuna sezione elenco selezionata, in sequenza.
  Massimo 10 sezioni ricercate per struttura, prenotazione atomica sul server, nessuna ripetizione
  automatica delle sezioni già avviate. In caso di errore o timeout: aggiornare il riepilogo e,
  se necessario, usare la ricerca della singola sezione. Le altre sezioni possono essere riprese.
  Il limite riguarda il numero di ricerche iniziali, non un importo in euro.
- La ricerca iniziale usa tutto il raggio (1/5/15/30 km per categoria), inclusi i luoghi vicini.
  Le ricerche manuali esistenti mantengono le loro fasce non sovrapposte.
- Le proposte non sono selezionate automaticamente: la selezione dell’host e il pulsante
  Salva approvano i luoghi. Le altre proposte del riepilogo visibile sono scartate.
  La transazione esistente `salva_scelte_proposte` viene riusata per ciascuna sezione.
- La pagina iniziale Casa e la pagina Contatti sono compilate solo con i dati effettivamente
  forniti (ed eventuale descrizione generata). Le altre pagine vuote sono segnalate.
  Le traduzioni restano un’azione esplicita, dopo l’approvazione.

## Reti Wi-Fi

`strutture_segreti.reti_wifi` contiene un elenco di nome/password/zona, fino a 20 reti.
Le reti sono modificabili anche in Dati della casa. Nomi e password mantengono gli spazi.
La migrazione conserva la vecchia rete singola nella prima voce, senza cancellare le colonne storiche.

RLS: solo il proprietario può leggere o modificare le reti. Nessuna lettura pubblica,
nessun invio delle password ai modelli AI, nessuna copia nelle pagine pubbliche.
La scelta sulla visibilità agli ospiti è ancora da confermare con l’utente; l’interfaccia
specifica che per ora le reti rimangono nel pannello host.

## Verifiche eseguite

- Compilazione TypeScript e build Vite riuscite.
- 25 test Node riusciti: validazione reti, creazione senza AI in manuale, autorizzazione,
  idempotenza, regressioni dei controlli su fonti/nomi/distanze Scout.
- PostgreSQL temporaneo: migrazione della rete storica, tre reti, creazione atomica e rollback,
  idempotenza, guida in bozza, pagine iniziali, isolamento owner/altro host/anon,
  permessi delle RPC e limite di 10 ricerche.
- Browser su desktop e telefono: scelta iniziale, tre reti e rimozione della rete intermedia,
  selezione sezioni, preparazione simulata, approvazione, pubblicazione simulata,
  percorso manuale senza pulsante AI. Nessuna ricerca a pagamento durante i test.
- `npm run lint` bloccato dalla policy Windows Application Control sul modulo nativo oxlint.
  Non sono state modificate le protezioni del sistema.
- Da verificare dopo la migrazione e il deploy: integrazione reale Supabase/Vercel e fornitori Scout.
