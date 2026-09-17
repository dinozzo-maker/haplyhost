-- 0014_domande_eliminazione_host.sql
-- L'host puo' cancellare lo storico delle domande della propria struttura:
-- singola riga o intero elenco dalla pagina /admin/domande.
-- Nessun accesso per anon; la scrittura iniziale resta solo in api/gennarino.js
-- tramite service role.

alter table public.domande enable row level security;

drop policy if exists "domande: l'host elimina le proprie" on public.domande;
create policy "domande: l'host elimina le proprie"
  on public.domande for delete to authenticated
  using (
    struttura_id in (
      select id from public.strutture where owner_user_id = auth.uid()
    )
  );
