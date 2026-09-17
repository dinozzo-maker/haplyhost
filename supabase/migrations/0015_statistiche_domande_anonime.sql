-- 0015_statistiche_domande_anonime.sql
-- Statistiche aggregate delle domande a Gennarino: nessun testo, nessun dato
-- dell'ospite. Restano disponibili anche quando la cronologia testuale viene
-- rimossa dopo 90 giorni.

create table if not exists public.statistiche_domande_giornaliere (
  struttura_id uuid not null references public.strutture(id) on delete cascade,
  giorno date not null,
  lingua text not null default 'it',
  numero integer not null default 0 check (numero >= 0),
  primary key (struttura_id, giorno, lingua)
);

alter table public.statistiche_domande_giornaliere enable row level security;

drop policy if exists "statistiche domande: host legge le proprie" on public.statistiche_domande_giornaliere;
create policy "statistiche domande: host legge le proprie"
  on public.statistiche_domande_giornaliere for select to authenticated
  using (
    struttura_id in (
      select id from public.strutture where owner_user_id = auth.uid()
    )
  );

-- Incremento atomico: due domande contemporanee non si perdono a vicenda.
create or replace function public.registra_statistica_domanda(
  p_struttura_id uuid,
  p_lingua text,
  p_giorno date
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.statistiche_domande_giornaliere (struttura_id, giorno, lingua, numero)
  values (p_struttura_id, p_giorno, coalesce(nullif(p_lingua, ''), 'it'), 1)
  on conflict (struttura_id, giorno, lingua)
  do update set numero = public.statistiche_domande_giornaliere.numero + 1;
$$;

revoke all on function public.registra_statistica_domanda(uuid, text, date) from public;
grant execute on function public.registra_statistica_domanda(uuid, text, date) to service_role;

-- Storico iniziale: conta solo giorno e lingua, senza copiare il testo delle domande.
insert into public.statistiche_domande_giornaliere (struttura_id, giorno, lingua, numero)
select struttura_id, (creato_il at time zone 'Europe/Rome')::date, coalesce(nullif(lang, ''), 'it'), count(*)::integer
from public.domande
group by struttura_id, (creato_il at time zone 'Europe/Rome')::date, coalesce(nullif(lang, ''), 'it')
on conflict (struttura_id, giorno, lingua)
do nothing;

create index if not exists domande_struttura_creato_il_idx
  on public.domande (struttura_id, creato_il desc);
