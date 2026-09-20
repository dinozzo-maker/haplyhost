-- Registro tecnico indipendente dal fornitore. Non contiene prompt, risposte,
-- domande, indirizzi IP o identità degli ospiti.
create table if not exists public.consumi_ai (
  id bigint generated always as identity primary key,
  struttura_id uuid references public.strutture(id) on delete set null,
  servizio text not null,
  operazione text not null,
  fornitore text not null,
  modello text not null,
  esito text not null check (esito in ('ok', 'errore')),
  errore_tipo text,
  token_input bigint not null default 0 check (token_input >= 0),
  token_output bigint not null default 0 check (token_output >= 0),
  token_ragionamento bigint not null default 0 check (token_ragionamento >= 0),
  token_cache bigint not null default 0 check (token_cache >= 0),
  token_strumenti bigint not null default 0 check (token_strumenti >= 0),
  token_totali bigint not null default 0 check (token_totali >= 0),
  durata_ms integer not null default 0 check (durata_ms >= 0),
  creato_il timestamptz not null default now()
);

create index if not exists consumi_ai_creato_il_idx on public.consumi_ai (creato_il desc);
create index if not exists consumi_ai_servizio_creato_il_idx on public.consumi_ai (servizio, creato_il desc);
alter table public.consumi_ai enable row level security;
-- Nessuna policy: scrittura e lettura avvengono solo nelle API server con service role.

