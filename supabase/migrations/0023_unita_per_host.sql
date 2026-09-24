-- Limite di "unità" per host. Un'unità è una camera o un alloggio prenotabile: un B&B da
-- 5 camere ne ha 5, una villa 1. Il piano base ne include 5; se l'host ne vuole di più
-- il superadmin alza `unita_incluse` (upgrade del piano). L'host dichiara le unità di
-- ogni sua struttura in "Dati della casa"; la somma su tutte le sue strutture non può
-- superare quelle incluse. Nessun limite se l'email non è in host_autorizzati (il
-- superadmin) o se il limite è >= 999.
begin;

alter table public.strutture
  add column if not exists unita integer not null default 1 check (unita between 1 and 999);
alter table public.host_autorizzati
  add column if not exists unita_incluse integer not null default 5 check (unita_incluse between 1 and 999);

-- Il superadmin non ha limiti (l'email è quella indicata in CLAUDE.md).
update public.host_autorizzati set unita_incluse = 999 where lower(email) = 'bernardinocalifano@gmail.com';

-- Rete di sicurezza lato database: anche una richiesta diretta alle API di Supabase non
-- può portare un host oltre il limite. Scatta SOLO su una nuova struttura o quando
-- `unita` AUMENTA: non blocca mai le modifiche di un host già oltre il limite (es. dopo
-- un abbassamento) né i trasferimenti di proprietà fatti dall'amministratore.
create or replace function public.limita_unita_host()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_incluse integer;
  v_usate integer;
begin
  if NEW.owner_user_id is null then return NEW; end if;
  if TG_OP = 'UPDATE' and NEW.unita <= OLD.unita then return NEW; end if;

  select lower(email) into v_email from auth.users where id = NEW.owner_user_id;
  select unita_incluse into v_incluse from public.host_autorizzati where lower(email) = v_email;
  if v_incluse is null or v_incluse >= 999 then return NEW; end if;

  select coalesce(sum(unita), 0) into v_usate
    from public.strutture where owner_user_id = NEW.owner_user_id and id <> NEW.id;
  if v_usate + NEW.unita > v_incluse then
    raise exception 'LIMITE_UNITA: %/% unità già usate, questa struttura ne richiede %',
      v_usate, v_incluse, NEW.unita using errcode = 'P0001';
  end if;
  return NEW;
end; $$;

drop trigger if exists strutture_limite_unita on public.strutture;
create trigger strutture_limite_unita
  before insert or update of unita on public.strutture
  for each row execute function public.limita_unita_host();

-- Quante unità ha usato l'host che chiama e quante ne include il suo piano
-- (`incluse` null = nessun limite). Serve al contatore nel pannello.
create or replace function public.mie_unita()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_email text;
  v_incluse integer;
  v_usate integer;
begin
  if auth.uid() is null then return null; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  select unita_incluse into v_incluse from public.host_autorizzati where lower(email) = v_email;
  if v_incluse >= 999 then v_incluse := null; end if;
  select coalesce(sum(unita), 0) into v_usate from public.strutture where owner_user_id = auth.uid();
  return jsonb_build_object('usate', v_usate, 'incluse', v_incluse);
end; $$;
revoke all on function public.mie_unita() from public, anon;
grant execute on function public.mie_unita() to authenticated;

-- Stessa funzione di 0020, con in più le unità della nuova struttura (da p_dati->'unita').
create or replace function public.crea_casa_configurata(p_id uuid, p_owner uuid, p_slug text, p_dati jsonb, p_modalita text)
returns uuid language plpgsql security invoker set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  if exists(select 1 from public.strutture where id = p_id and owner_user_id = p_owner) then return p_id; end if;
  insert into public.strutture(id, owner_user_id, slug, nome, indirizzo, citta, descrizione_casa,
    checkin, checkout, host_nome, host_telefono, max_ospiti, attivo, sezioni_attive, unita)
  values(p_id, p_owner, p_slug, p_dati->>'nome', p_dati->>'indirizzo', p_dati->>'citta',
    p_dati->>'descrizione_casa', p_dati->>'checkin', p_dati->>'checkout',
    p_dati->>'host_nome', p_dati->>'host_telefono', null, false,
    case when p_modalita = 'guidata' then '["casa","mangiare","vicinanze","visitare","trasporti","contatti","gennarino"]'::jsonb else null end,
    coalesce(nullif(p_dati->>'unita', '')::integer, 1));
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

commit;
