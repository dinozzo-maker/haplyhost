-- Allargamento automatico della ricerca dei luoghi per le case isolate (wizard di configurazione).
-- Se in una sezione vengono trovati meno di 8 luoghi verificati, il pannello ripete la ricerca con
-- un raggio più ampio (15, poi 30 km). Ogni allargamento costa una ricerca AI in più: per non
-- perdere il controllo dei costi (incidente del 31/08) il tetto è nel DATABASE, non solo nel
-- pannello: massimo 2 allargamenti per sezione, e solo dopo che la prima ricerca è completata.
-- Caso peggiore per struttura: 10 sezioni × (1 ricerca + 2 allargamenti) = 30 ricerche.
begin;

alter table public.ricerche_configurazione
  add column if not exists allargamenti smallint not null default 0
  check (allargamenti between 0 and 2);

-- Prenota (atomicamente) un allargamento per una sezione. Ritorna true se concesso, false se la
-- sezione non ha una ricerca completata o ha già usato i 2 allargamenti. Un unico UPDATE
-- condizionato: due richieste insieme non superano il tetto. Solo il server (service role).
create or replace function public.prenota_allargamento_configurazione(p_struttura_id uuid, p_sezione text)
returns boolean language plpgsql security invoker set search_path = public as $$
declare
  v_righe integer;
begin
  update public.ricerche_configurazione
    set allargamenti = allargamenti + 1
    where struttura_id = p_struttura_id
      and sezione = p_sezione
      and stato = 'completata'
      and allargamenti < 2;
  get diagnostics v_righe = row_count;
  return v_righe > 0;
end; $$;

revoke all on function public.prenota_allargamento_configurazione(uuid, text) from public, anon, authenticated;
grant execute on function public.prenota_allargamento_configurazione(uuid, text) to service_role;

commit;
