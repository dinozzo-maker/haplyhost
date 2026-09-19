-- Un'unica transazione: aggiunge le scelte e chiude solo le proposte visualizzate.
create or replace function public.salva_scelte_proposte(
  p_struttura_id uuid, p_sezione text, p_proposte uuid[], p_scelte uuid[]
) returns integer
language plpgsql security invoker set search_path = public
as $$
declare
  numero_proposte integer;
  numero_inseriti integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.strutture where id = p_struttura_id and owner_user_id = auth.uid()
  ) then
    raise exception 'Struttura non autorizzata';
  end if;
  if p_proposte is null or p_scelte is null or cardinality(p_proposte) = 0
    or cardinality(p_proposte) > 1000 or not (p_scelte <@ p_proposte)
    or array_position(p_proposte, null) is not null or array_position(p_scelte, null) is not null then
    raise exception 'Selezione non valida';
  end if;

  -- Blocca le righe fino al commit; un secondo invio non può duplicare i luoghi.
  perform id from public.proposte
    where struttura_id = p_struttura_id and sezione = p_sezione and id = any(p_proposte)
    order by id for update;
  get diagnostics numero_proposte = row_count;
  if numero_proposte <> cardinality(p_proposte) then
    raise exception 'Le proposte sono cambiate: ricarica la pagina';
  end if;

  insert into public.luoghi (
    struttura_id, sezione, nome, descrizione, distanza, prezzo, voto, maps, telefono,
    attivo, ordine, da_tradurre
  ) select struttura_id, sezione, nome, descrizione, distanza, prezzo, voto, maps, telefono,
    true, 999, true
    from public.proposte
    where struttura_id = p_struttura_id and sezione = p_sezione and id = any(p_scelte);
  get diagnostics numero_inseriti = row_count;

  delete from public.proposte
    where struttura_id = p_struttura_id and sezione = p_sezione and id = any(p_proposte);
  return numero_inseriti;
end;
$$;

revoke all on function public.salva_scelte_proposte(uuid, text, uuid[], uuid[]) from public, anon;
grant execute on function public.salva_scelte_proposte(uuid, text, uuid[], uuid[]) to authenticated;
