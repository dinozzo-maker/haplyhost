-- 0008_domande_lettura_host.sql
-- L'host può vedere le domande fatte a Gennarino per la propria struttura
-- (pagina /admin/domande). La scrittura resta solo lato server con service role
-- (api/gennarino.js). Nessun accesso per anon.

alter table domande enable row level security;

drop policy if exists "domande: l'host legge le proprie" on domande;
create policy "domande: l'host legge le proprie"
  on domande for select to authenticated
  using (struttura_id in (select id from strutture where owner_user_id = auth.uid()));
