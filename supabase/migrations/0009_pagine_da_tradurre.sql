-- 0009_pagine_da_tradurre.sql
-- Segnale "traduzione da rifare". Quando l'host modifica un testo (pagina o luogo)
-- il frontend mette da_tradurre = true; api/traduci-guida.js lo rimette a false
-- dopo aver tradotto. Il pannello mostra un avviso finché ci sono flag attivi.
--
-- luoghi.da_tradurre esiste già (import V1) ma è pieno di flag vestigiali su righe
-- che in realtà sono tradotte: li azzeriamo, così il flag diventa significativo.

alter table pagine add column if not exists da_tradurre boolean default false;
update pagine set da_tradurre = false where da_tradurre is null;

update luoghi set da_tradurre = false;
