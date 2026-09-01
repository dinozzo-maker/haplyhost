-- 0004_sezioni_extra.sql
-- Sezioni della guida create dal superadmin, in aggiunta alle 14 di sistema (src/sezioni.ts).
-- Platform-wide: ogni host le vede nella propria pagina "Sezioni della guida" e sceglie se
-- attivarle (via strutture.sezioni_attive). Nascono spente per tutti.

create table if not exists sezioni_extra (
  chiave text primary key,               -- slug ^[a-z][a-z0-9-]{1,30}$, mai uguale a una chiave di sistema
  icona text not null default '📄',       -- emoji
  etichetta text not null,
  descrizione text,                      -- mostrata in "Sezioni della guida"
  tipo text not null default 'testo',    -- 'testo' (pagina, tabella pagine) | 'elenco' (lista, tabella luoghi)
  categoria text,                        -- solo per 'elenco': cosa cerca Scout, es. "noleggi barche e gommoni"
  ordine int not null default 100,
  creato_il timestamptz not null default now()
);

alter table sezioni_extra enable row level security;

-- Lettura pubblica: serve a ogni guida ospite e a ogni pannello host.
create policy "sezioni_extra: lettura pubblica" on sezioni_extra for select using (true);
-- Nessuna policy di scrittura: crea/elimina solo lato server con service role, via api/sezioni-extra.js.
