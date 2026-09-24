-- Quante volte l'ospite ha aperto la guida col suo link personale (api/ospite.js).
-- Solo un conteggio e due date PER SOGGIORNO: nessun IP, nessun dispositivo, nessun dato
-- su chi apre. Lo legge l'host proprietario (stessa policy di `soggiorni`, migration 0021)
-- per capire a chi mandare un promemoria.
begin;

alter table public.soggiorni
  add column if not exists aperture integer not null default 0,
  add column if not exists prima_apertura timestamptz,
  add column if not exists ultima_apertura timestamptz;

-- Registra un'apertura. Conta come nuova solo se l'ultima è di oltre 30 minuti fa:
-- sfogliare le pagine, ricaricare o riaprire subito non gonfia il numero (una "visita"
-- è una sessione, non una pagina). Un unico UPDATE condizionato: due richieste insieme
-- non contano due volte. Ritorna true se ha contato, false se era troppo presto o il
-- soggiorno non esiste. Solo il server (service role) la può chiamare.
create or replace function public.registra_apertura_soggiorno(p_id uuid)
returns boolean language plpgsql security invoker set search_path = public as $$
declare
  v_righe integer;
begin
  update public.soggiorni
    set aperture = aperture + 1,
        prima_apertura = coalesce(prima_apertura, now()),
        ultima_apertura = now()
    where id = p_id
      and (ultima_apertura is null or ultima_apertura < now() - interval '30 minutes');
  get diagnostics v_righe = row_count;
  return v_righe > 0;
end; $$;

revoke all on function public.registra_apertura_soggiorno(uuid) from public, anon, authenticated;
grant execute on function public.registra_apertura_soggiorno(uuid) to service_role;

commit;
