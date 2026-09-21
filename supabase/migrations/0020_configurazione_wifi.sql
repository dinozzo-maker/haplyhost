-- Configurazione riprendibile e reti multiple. Nessuna password nelle tabelle pubbliche.
begin;
alter table public.strutture_segreti add column if not exists reti_wifi jsonb;
update public.strutture_segreti set reti_wifi = case when coalesce(wifi_rete, '') <> ''
  then jsonb_build_array(jsonb_build_object('nome', wifi_rete, 'password', coalesce(wifi_password, ''), 'zona', ''))
  else '[]'::jsonb end where reti_wifi is null;
alter table public.strutture_segreti alter column reti_wifi set default '[]'::jsonb;
alter table public.strutture_segreti alter column reti_wifi set not null;
alter table public.strutture_segreti add constraint reti_wifi_elenco check (
  jsonb_typeof(reti_wifi) = 'array' and jsonb_array_length(reti_wifi) <= 20
);

create policy "L'host gestisce le proprie reti" on public.strutture_segreti
for all to authenticated using (
  exists(select 1 from public.strutture s where s.id = struttura_id and s.owner_user_id = auth.uid())
) with check (
  exists(select 1 from public.strutture s where s.id = struttura_id and s.owner_user_id = auth.uid())
);
grant select, insert, update, delete on public.strutture_segreti to authenticated;

create table public.configurazioni_guida (
  struttura_id uuid primary key references public.strutture(id) on delete cascade,
  modalita text not null check (modalita in ('guidata', 'manuale')),
  passo integer not null default 2 check (passo between 2 and 3)
);
alter table public.configurazioni_guida enable row level security;
create policy "Configurazione del proprietario" on public.configurazioni_guida
for all to authenticated using (
  exists(select 1 from public.strutture s where s.id = struttura_id and s.owner_user_id = auth.uid())
) with check (
  exists(select 1 from public.strutture s where s.id = struttura_id and s.owner_user_id = auth.uid())
);
grant select, insert, update, delete on public.configurazioni_guida to authenticated;
grant all on public.configurazioni_guida to service_role;

-- Una ricerca iniziale per sezione: il vincolo evita doppie chiamate anche da due schede.
create table public.ricerche_configurazione (
  struttura_id uuid not null references public.strutture(id) on delete cascade,
  sezione text not null,
  stato text not null default 'in_corso' check (stato in ('in_corso', 'completata', 'errore')),
  iniziata_il timestamptz not null default now(),
  primary key (struttura_id, sezione)
);
alter table public.ricerche_configurazione enable row level security;
create policy "L'host legge le proprie ricerche" on public.ricerche_configurazione
for select to authenticated using (
  exists(select 1 from public.strutture s where s.id = struttura_id and s.owner_user_id = auth.uid())
);
grant select on public.ricerche_configurazione to authenticated;
grant all on public.ricerche_configurazione to service_role;

-- Creazione atomica: mai una casa salvata senza le reti o lo stato del percorso.
create function public.crea_casa_configurata(p_id uuid, p_owner uuid, p_slug text, p_dati jsonb, p_modalita text)
returns uuid language plpgsql security invoker set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  if exists(select 1 from public.strutture where id = p_id and owner_user_id = p_owner) then return p_id; end if;
  insert into public.strutture(id, owner_user_id, slug, nome, indirizzo, citta, descrizione_casa,
    checkin, checkout, host_nome, host_telefono, max_ospiti, attivo, sezioni_attive)
  values(p_id, p_owner, p_slug, p_dati->>'nome', p_dati->>'indirizzo', p_dati->>'citta',
    p_dati->>'descrizione_casa', p_dati->>'checkin', p_dati->>'checkout',
    p_dati->>'host_nome', p_dati->>'host_telefono', null, false,
    case when p_modalita = 'guidata' then '["casa","mangiare","vicinanze","visitare","trasporti","contatti","gennarino"]'::jsonb else null end);
  insert into public.strutture_segreti(struttura_id, reti_wifi) values(p_id, p_dati->'reti_wifi');
  insert into public.configurazioni_guida(struttura_id, modalita) values(p_id, p_modalita);
  if concat_ws('', p_dati->>'descrizione_casa', p_dati->>'checkin', p_dati->>'checkout') <> '' then
    insert into public.pagine(struttura_id, chiave, titolo, contenuto, da_tradurre)
    values(p_id, 'casa', 'La casa', concat_ws(E'\n\n', nullif(p_dati->>'descrizione_casa', ''),
      case when coalesce(p_dati->>'checkin', '') <> '' then 'Check-in: ' || (p_dati->>'checkin') end,
      case when coalesce(p_dati->>'checkout', '') <> '' then 'Check-out: ' || (p_dati->>'checkout') end), true);
  end if;
  if coalesce(p_dati->>'host_telefono', '') <> '' then
    insert into public.pagine(struttura_id, chiave, titolo, contenuto, da_tradurre)
    values(p_id, 'contatti', 'Contatti', concat_ws(E'\n', nullif(p_dati->>'host_nome', ''),
      'Per contattarci, invia un messaggio WhatsApp al ' || (p_dati->>'host_telefono')), true);
  end if;
  return p_id;
end; $$;
revoke all on function public.crea_casa_configurata(uuid, uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.crea_casa_configurata(uuid, uuid, text, jsonb, text) to service_role;
create function public.prenota_ricerca_configurazione(p_struttura_id uuid, p_sezione text)
returns boolean language plpgsql security invoker set search_path = public as $$
begin
  perform id from public.strutture where id = p_struttura_id for update;
  if not exists(select 1 from public.configurazioni_guida where struttura_id = p_struttura_id and modalita = 'guidata' and passo = 3)
    or not exists(select 1 from public.strutture where id = p_struttura_id and sezioni_attive ? p_sezione) then
    raise exception 'Configurazione non pronta';
  end if;
  if exists(select 1 from public.ricerche_configurazione where struttura_id = p_struttura_id and sezione = p_sezione) then return false; end if;
  if (select count(*) from public.ricerche_configurazione where struttura_id = p_struttura_id) >= 10 then
    raise exception 'Limite di ricerche iniziali raggiunto';
  end if;
  insert into public.ricerche_configurazione(struttura_id, sezione) values(p_struttura_id, p_sezione);
  return true;
end; $$;
revoke all on function public.prenota_ricerca_configurazione(uuid, text) from public, anon, authenticated;
grant execute on function public.prenota_ricerca_configurazione(uuid, text) to service_role;
commit;
