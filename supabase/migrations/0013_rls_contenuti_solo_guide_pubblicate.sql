-- 0013_rls_contenuti_solo_guide_pubblicate.sql
--
-- Le guide in bozza (strutture.attivo = false) non devono esporre nessun
-- contenuto attraverso l'API pubblica di Supabase. Prima pagine e luoghi
-- controllavano solo la propria riga, non lo stato della struttura madre.
--
-- Anche annunci ed eventi seguono la stessa regola, pronta per quando verranno
-- collegati alla guida. I soggiorni, invece, non hanno un accesso ospite sicuro
-- implementato: togliamo la lettura pubblica per non esporre nomi e date.

drop policy if exists "lettura pubblica pagine" on public.pagine;
drop policy if exists "lettura pubblica pagine di guide online" on public.pagine;
create policy "lettura pubblica pagine di guide online"
  on public.pagine for select to anon, authenticated
  using (
    exists (
      select 1
      from public.strutture
      where strutture.id = pagine.struttura_id
        and strutture.attivo = true
    )
  );

drop policy if exists "lettura pubblica luoghi" on public.luoghi;
drop policy if exists "lettura pubblica luoghi di guide online" on public.luoghi;
create policy "lettura pubblica luoghi di guide online"
  on public.luoghi for select to anon, authenticated
  using (
    luoghi.attivo = true
    and exists (
      select 1
      from public.strutture
      where strutture.id = luoghi.struttura_id
        and strutture.attivo = true
    )
  );

drop policy if exists "lettura pubblica annunci" on public.annunci;
drop policy if exists "lettura pubblica annunci di guide online" on public.annunci;
create policy "lettura pubblica annunci di guide online"
  on public.annunci for select to anon, authenticated
  using (
    annunci.attivo = true
    and exists (
      select 1
      from public.strutture
      where strutture.id = annunci.struttura_id
        and strutture.attivo = true
    )
  );

drop policy if exists "lettura pubblica eventi" on public.eventi;
drop policy if exists "lettura pubblica eventi di guide online" on public.eventi;
create policy "lettura pubblica eventi di guide online"
  on public.eventi for select to anon, authenticated
  using (
    eventi.attivo = true
    and exists (
      select 1
      from public.strutture
      where strutture.id = eventi.struttura_id
        and strutture.attivo = true
    )
  );

-- Nessun ospite deve leggere soggiorni e nominativi finche' non esiste un
-- accesso individuale, esplicito e progettato per questa funzione.
drop policy if exists "solo soggiorno in corso" on public.soggiorni;
