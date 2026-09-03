-- 0006_storage_copertine.sql
-- Bucket per le foto di copertina delle guide.
-- L'host in Modifica Casa preme "Carica foto", il file finisce qui e il sistema
-- scrive il link pubblico in strutture.copertina_url.

-- 1. Il bucket. public = true → le immagini sono servite dall'endpoint pubblico
--    di Supabase (la guida ospiti è anonima), senza bisogno di policy di lettura.
insert into storage.buckets (id, name, public)
values ('copertine', 'copertine', true)
on conflict (id) do nothing;

-- 2. Scrittura: solo utenti autenticati (gli host), solo dentro il bucket copertine.
--    Non è ristretta al singolo host: a oggi ce n'è uno solo. Hardening futuro:
--    limitare al prefisso di cartella uguale a auth.uid().
drop policy if exists "copertine: gli host caricano" on storage.objects;
create policy "copertine: gli host caricano"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'copertine');

drop policy if exists "copertine: gli host sostituiscono" on storage.objects;
create policy "copertine: gli host sostituiscono"
  on storage.objects for update to authenticated
  using (bucket_id = 'copertine');

drop policy if exists "copertine: gli host rimuovono" on storage.objects;
create policy "copertine: gli host rimuovono"
  on storage.objects for delete to authenticated
  using (bucket_id = 'copertine');

-- 3. Lettura esplicita (oltre all'endpoint pubblico): innocua, utile per anteprime lato SDK.
drop policy if exists "copertine: lettura pubblica" on storage.objects;
create policy "copertine: lettura pubblica"
  on storage.objects for select to public
  using (bucket_id = 'copertine');
