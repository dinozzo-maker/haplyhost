-- 0005_guida_grafica.sql
-- Reskin della guida ospiti.
--
-- 1) Personalizzazione per struttura, due sole leve:
--    - accento: colore d'accento della guida (hex, es. '#12A69B'). NULL = teal di default.
--    - copertina_url: link a un'immagine per l'hero. NULL = gradiente generato dal colore.
-- 2) prezzo/voto dei luoghi diventano colonne proprie (prima Scout li infilava nella
--    descrizione). Popolati da api/scout.js, mostrati come pastiglie nella scheda luogo.
--
-- Le strutture/luoghi esistenti restano a NULL: nessun backfill. La guida degrada da sola
-- (gradiente al posto della foto, niente pastiglie se prezzo/voto mancano).

alter table strutture add column if not exists accento text;
alter table strutture add column if not exists copertina_url text;

alter table luoghi   add column if not exists prezzo text;
alter table luoghi   add column if not exists voto text;

alter table proposte add column if not exists prezzo text;
alter table proposte add column if not exists voto text;
