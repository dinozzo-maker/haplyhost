-- HaplyHost V2 - schema iniziale di riferimento
--
-- USO: solo per creare un nuovo progetto Supabase VUOTO.
-- NON eseguire su produzione: la produzione esiste gia' e riceve solo le migrazioni.
--
-- Ordine di ricostruzione di un ambiente nuovo:
--   1. esegui questo file
--   2. esegui, in ordine, tutte le migrazioni in supabase/migrations/ (0001 -> 0013)
--
-- Questo file ricostruisce la base storica della V2. Le migrazioni successive
-- aggiungono onboarding host, sezioni configurabili, grafica, foto, traduzioni
-- e le protezioni multi-tenant piu' recenti.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Strutture e dati strettamente collegati
-- ---------------------------------------------------------------------------

create table public.strutture (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  indirizzo text default '',
  citta text default '',
  lat numeric,
  lng numeric,
  checkin text default '15:00',
  checkout text default '10:00',
  max_ospiti integer default 6,
  host_nome text default '',
  host_telefono text default '',
  descrizione_casa text default '',
  regole text default '',
  attivo boolean not null default true,
  creato_il timestamptz not null default now(),
  -- La migration 0002 sostituisce questo vincolo con ON DELETE SET NULL.
  owner_user_id uuid references auth.users(id)
);

create table public.strutture_segreti (
  struttura_id uuid primary key references public.strutture(id) on delete cascade,
  wifi_rete text default '',
  wifi_password text default ''
);

create table public.luoghi (
  id uuid primary key default gen_random_uuid(),
  struttura_id uuid not null references public.strutture(id) on delete cascade,
  sezione text not null,
  nome text not null,
  icona text default '',
  etichetta text default '',
  categoria text default '',
  descrizione text default '',
  distanza text default '',
  maps text default '',
  telefono text default '',
  ordine integer default 0,
  attivo boolean not null default true,
  traduzioni jsonb default '{}'::jsonb,
  da_tradurre boolean not null default true
);

create table public.pagine (
  id uuid primary key default gen_random_uuid(),
  struttura_id uuid not null references public.strutture(id) on delete cascade,
  chiave text not null,
  titolo text default '',
  contenuto text default '',
  traduzioni jsonb default '{}'::jsonb,
  unique (struttura_id, chiave)
);

create table public.proposte (
  id uuid primary key default gen_random_uuid(),
  struttura_id uuid not null references public.strutture(id) on delete cascade,
  sezione text not null,
  nome text not null,
  descrizione text default '',
  distanza text default '',
  maps text default '',
  telefono text default '',
  creato_il timestamptz not null default now()
);

create table public.domande (
  id uuid primary key default gen_random_uuid(),
  struttura_id uuid references public.strutture(id) on delete cascade,
  domanda text not null,
  risposta text default '',
  lang text default 'it',
  creato_il timestamptz not null default now()
);

-- Tabelle gia' presenti nel database, non ancora collegate alla UI attuale.
-- Restano qui per rendere lo schema riproducibile senza perdere le basi future.
create table public.annunci (
  id uuid primary key default gen_random_uuid(),
  struttura_id uuid not null references public.strutture(id) on delete cascade,
  testo text not null,
  attivo boolean not null default true,
  creato_il timestamptz not null default now()
);

create table public.eventi (
  id uuid primary key default gen_random_uuid(),
  struttura_id uuid not null references public.strutture(id) on delete cascade,
  data date not null,
  titolo text not null,
  descrizione text default '',
  attivo boolean not null default true
);

create table public.soggiorni (
  id uuid primary key default gen_random_uuid(),
  struttura_id uuid not null references public.strutture(id) on delete cascade,
  nome text not null,
  checkin date not null,
  checkout date not null,
  con_bambini boolean not null default false
);

-- ---------------------------------------------------------------------------
-- RLS di base storica. Le migrazioni 0008, 0010 e 0013 le completano/rafforzano.
-- ---------------------------------------------------------------------------

alter table public.strutture enable row level security;
alter table public.strutture_segreti enable row level security;
alter table public.luoghi enable row level security;
alter table public.pagine enable row level security;
alter table public.proposte enable row level security;
alter table public.domande enable row level security;
alter table public.annunci enable row level security;
alter table public.eventi enable row level security;
alter table public.soggiorni enable row level security;

create policy "lettura pubblica strutture"
  on public.strutture for select to anon, authenticated
  using (attivo = true);

create policy "host aggiorna propria struttura"
  on public.strutture for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "lettura pubblica luoghi"
  on public.luoghi for select to anon, authenticated
  using (attivo = true);

create policy "host luoghi"
  on public.luoghi for all to authenticated
  using (
    struttura_id in (
      select id from public.strutture where owner_user_id = auth.uid()
    )
  )
  with check (
    struttura_id in (
      select id from public.strutture where owner_user_id = auth.uid()
    )
  );

create policy "lettura pubblica pagine"
  on public.pagine for select to anon, authenticated
  using (true);

create policy "host pagine"
  on public.pagine for all to authenticated
  using (
    struttura_id in (
      select id from public.strutture where owner_user_id = auth.uid()
    )
  )
  with check (
    struttura_id in (
      select id from public.strutture where owner_user_id = auth.uid()
    )
  );

create policy "host proposte"
  on public.proposte for all to authenticated
  using (
    struttura_id in (
      select id from public.strutture where owner_user_id = auth.uid()
    )
  )
  with check (
    struttura_id in (
      select id from public.strutture where owner_user_id = auth.uid()
    )
  );

create policy "lettura pubblica annunci"
  on public.annunci for select to anon, authenticated
  using (attivo = true);

create policy "lettura pubblica eventi"
  on public.eventi for select to anon, authenticated
  using (attivo = true);

-- La migration 0013 rimuove questa lettura: un soggiorno non e' un dato pubblico.
create policy "solo soggiorno in corso"
  on public.soggiorni for select to anon, authenticated
  using (current_date >= checkin and current_date <= checkout);
