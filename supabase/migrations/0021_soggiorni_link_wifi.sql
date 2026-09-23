-- Wi-Fi visibile all'ospite solo nei giorni del suo soggiorno.
-- Ogni soggiorno ha un token segreto: il link personale che l'host manda all'ospite
-- (https://<sito>/<slug>?s=<token>). La password NON passa mai da tabelle pubbliche:
-- la legge solo api/wifi.js (service role), che controlla token e date.
begin;

alter table public.soggiorni add column if not exists token text;
update public.soggiorni
  set token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
  where token is null;
alter table public.soggiorni
  alter column token set default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  alter column token set not null;
alter table public.soggiorni add constraint soggiorni_token_unico unique (token);
alter table public.soggiorni add constraint soggiorni_date_coerenti check (checkout >= checkin);

create index if not exists soggiorni_struttura_checkin on public.soggiorni (struttura_id, checkin);

-- L'host gestisce solo i soggiorni delle proprie strutture. Nessun accesso anon:
-- un soggiorno contiene nominativi e date, non è un dato pubblico (vedi 0013).
create policy "L'host gestisce i propri soggiorni" on public.soggiorni
for all to authenticated using (
  exists(select 1 from public.strutture s where s.id = struttura_id and s.owner_user_id = auth.uid())
) with check (
  exists(select 1 from public.strutture s where s.id = struttura_id and s.owner_user_id = auth.uid())
);
grant select, insert, update, delete on public.soggiorni to authenticated;
grant all on public.soggiorni to service_role;

commit;
