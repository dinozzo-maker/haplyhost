-- Rimuove la struttura di prova "Villa Demo (dati di esempio)" creata da villa-demo.sql.
-- Cancella anche i suoi soggiorni e le sue statistiche (on delete cascade).
-- Non tocca nessun'altra struttura: filtra SOLO sullo slug `villademo`.
delete from public.strutture where slug = 'villademo';

-- Controllo: deve tornare 0.
select count(*) as rimaste from public.strutture where slug = 'villademo';
