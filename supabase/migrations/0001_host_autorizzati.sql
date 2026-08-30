-- 0001_host_autorizzati.sql
-- Elenco delle email autorizzate a diventare host della piattaforma.
-- Il superadmin autorizza un'email dalla pagina /admin/invita-host; la registrazione
-- vera e propria (login + "Crea la tua struttura") resta bloccata da shouldCreateUser:false
-- in Login.tsx per tutte le email non ancora create in Supabase Auth.

create table if not exists host_autorizzati (
  email text primary key,
  nome_riferimento text,
  piano text,                       -- 'guida' | 'concierge' | 'portfolio'
  note text,
  autorizzato_il timestamptz not null default now(),
  registrato_il timestamptz         -- popolato quando l'host crea la sua struttura (Incremento B)
);

alter table host_autorizzati enable row level security;
-- Nessuna policy: la tabella si raggiunge solo lato server con la service role key
-- (stesso pattern di strutture_segreti).

-- Seed: sostituire con l'email con cui il superadmin accede al pannello.
insert into host_autorizzati (email, nome_riferimento, piano, registrato_il)
values ('EMAIL_DEL_SUPERADMIN', 'Superadmin / Villa Virginia', 'portfolio', now())
on conflict (email) do nothing;
