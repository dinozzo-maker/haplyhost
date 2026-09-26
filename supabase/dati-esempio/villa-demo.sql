-- ============================================================================
-- DATI DI ESEMPIO — NON SONO DATI REALI.
-- Crea (o ricrea) una struttura di prova "Villa Demo (dati di esempio)" con soggiorni,
-- aperture della guida e domande a Gennarino PLAUSIBILI, per vedere il pannello popolato
-- (cruscotto «Adozione della guida», elenco soggiorni, messaggi pronti, QR).
--
-- Regole:
--  • È una struttura SEPARATA da Villa Virginia (slug `villademo`): non tocca nessun dato vero.
--  • Non è pubblica (attivo = false): gli ospiti non possono aprirla.
--  • Non usare questi numeri come risultati reali di adozione: sono un esempio. Se li mostri a
--    qualcuno, dì che sono dati di prova.
--  • Le date sono relative a OGGI: rilancia lo script per "rinfrescarle". È idempotente: prima
--    cancella la struttura di prova precedente (i soggiorni e le statistiche spariscono con lei).
--  • Per toglierla: villa-demo-rimuovi.sql.
--
-- Come si lancia: Supabase → SQL Editor → incolla → Run. Se compare il popup sull'RLS, scegli
-- «Run without RLS» (lo script non crea tabelle).
-- Prerequisito: migration 0024 già lanciata (colonne `aperture`, `prima_apertura`, `ultima_apertura`).
-- ============================================================================
do $$
declare
  v_owner uuid;
  v_id uuid;
begin
  select id into v_owner from auth.users where lower(email) = 'bernardinocalifano@gmail.com';
  if v_owner is null then
    raise exception 'Utente bernardinocalifano@gmail.com non trovato in Supabase Auth';
  end if;

  -- Ricomincia da zero (i figli seguono con on delete cascade).
  delete from public.strutture where slug = 'villademo';

  insert into public.strutture (slug, nome, citta, indirizzo, owner_user_id, attivo, unita, host_nome, checkin, checkout, max_ospiti)
  values ('villademo', 'Villa Demo (dati di esempio)', 'Paestum', 'Via di prova 1', v_owner, false, 4, 'Annamaria', 'dalle 15:00', 'entro le 10:00', 6)
  returning id into v_id;

  -- Soggiorni: (nome, giorni dall'oggi per l'arrivo, notti, aperture della guida).
  -- 12 arrivati negli ultimi 30 giorni, 8 con la guida aperta (67%), 24 aperture in tutto
  -- (media 3,0); 1 ospite in casa che non l'ha ancora aperta; 2 in arrivo.
  insert into public.soggiorni (struttura_id, nome, checkin, checkout, aperture, prima_apertura, ultima_apertura)
  select
    v_id, r.nome, current_date + r.arrivo, current_date + r.arrivo + r.notti, r.aperture,
    case when r.aperture > 0 then (current_date + r.arrivo - 1)::timestamptz + interval '18 hours' end,
    case when r.aperture > 0 then
      least(
        now() - interval '10 minutes',
        (current_date + r.arrivo - 1)::timestamptz + interval '18 hours'
          + (least(r.aperture - 1, r.notti) * interval '20 hours')
      )
    end
  from (values
    ('Famiglia Rossi',      -1, 4, 3),
    ('Coppia Martin',       -2, 3, 0),
    ('Famiglia Müller',     -4, 5, 5),
    ('Smith family',        -7, 4, 2),
    ('Famiglia De Luca',    -9, 3, 0),
    ('Gruppo Ferrari',     -12, 7, 7),
    ('Coppia Esposito',    -15, 3, 1),
    ('Famiglia Schmidt',   -17, 4, 0),
    ('Famiglia Romano',    -20, 5, 3),
    ('Coppia Bianchi',     -23, 3, 1),
    ('Famiglia Conti',     -26, 4, 0),
    ('Gruppo Greco',       -29, 6, 2),
    ('Famiglia Pellegrini',  2, 4, 0),
    ('Coppia Dubois',        6, 3, 0)
  ) as r(nome, arrivo, notti, aperture);

  -- Domande a Gennarino, per giorno e lingua (solo conteggi, come nella tabella vera).
  insert into public.statistiche_domande_giornaliere (struttura_id, giorno, lingua, numero)
  select v_id, d::date, l.lingua, l.n
  from generate_series(current_date - 29, current_date, interval '1 day') as d
  cross join lateral (values
    ('it', (extract(day from d)::int * 7) % 4),
    ('en', (extract(day from d)::int * 5) % 3),
    ('de', case when (extract(day from d)::int * 3) % 5 = 0 then 1 else 0 end)
  ) as l(lingua, n)
  where l.n > 0;
end $$;

-- Controllo rapido: dovrebbe mostrare 14 soggiorni (12 recenti + 2 in arrivo).
select count(*) as soggiorni_creati from public.soggiorni s
  join public.strutture t on t.id = s.struttura_id where t.slug = 'villademo';
