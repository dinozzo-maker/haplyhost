-- Istruzioni di arrivo RISERVATE: come entrare (codice porta o cassetta chiavi), parcheggio, prime
-- cose da sapere. Come la password del Wi-Fi, compaiono all'ospite SOLO dal giorno del check-in al
-- giorno del check-out e SOLO con il suo link personale (api/ospite.js, azione `arrivo`).
--
-- Stanno in `strutture_segreti` apposta, non in `pagine`: `pagine` è pubblica per ogni guida
-- online, mentre `strutture_segreti` non ha nessuna lettura pubblica (solo l'host proprietario,
-- policy della 0020, e il server). Non le legge nemmeno Gennarino, così un codice porta non può
-- finire in una risposta della chat.
alter table public.strutture_segreti
  add column if not exists info_arrivo text
  check (info_arrivo is null or char_length(info_arrivo) <= 4000);
