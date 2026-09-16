-- 0012_storage_copertine_per_host.sql
--
-- Il bucket `copertine` e' pubblico in lettura: serve alle guide ospiti senza login.
-- Prima, pero', ogni utente autenticato poteva scrivere, sostituire o cancellare
-- QUALSIASI file del bucket. Con piu' host questo non e' accettabile.
--
-- Percorsi consentiti:
--   <auth.uid>/<struttura_id>-<timestamp>.jpg       copertine della propria struttura
--   luoghi/<struttura_id>/<luogo_id>-<timestamp>.jpg foto luogo della propria struttura
--
-- Per le foto luogo la policy verifica nel database che auth.uid() sia davvero
-- owner_user_id della struttura presente nel percorso. INSERT, UPDATE e DELETE
-- usano lo stesso controllo: un host non puo' agire sui file di un altro.

drop policy if exists "copertine: gli host caricano" on storage.objects;
drop policy if exists "copertine: gli host sostituiscono" on storage.objects;
drop policy if exists "copertine: gli host rimuovono" on storage.objects;

create policy "copertine: l'host carica solo le proprie"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'copertine'
    and (
      -- Copertina: primo livello uguale all'utente autenticato.
      (storage.foldername(name))[1] = auth.uid()::text
      or
      -- Foto luogo: la struttura nel secondo livello deve appartenere all'host.
      (
        (storage.foldername(name))[1] = 'luoghi'
        and exists (
          select 1
          from public.strutture
          where strutture.id::text = (storage.foldername(name))[2]
            and strutture.owner_user_id = auth.uid()
        )
      )
    )
  );

create policy "copertine: l'host aggiorna solo le proprie"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'copertine'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'luoghi'
        and exists (
          select 1
          from public.strutture
          where strutture.id::text = (storage.foldername(name))[2]
            and strutture.owner_user_id = auth.uid()
        )
      )
    )
  )
  with check (
    bucket_id = 'copertine'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'luoghi'
        and exists (
          select 1
          from public.strutture
          where strutture.id::text = (storage.foldername(name))[2]
            and strutture.owner_user_id = auth.uid()
        )
      )
    )
  );

create policy "copertine: l'host elimina solo le proprie"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'copertine'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'luoghi'
        and exists (
          select 1
          from public.strutture
          where strutture.id::text = (storage.foldername(name))[2]
            and strutture.owner_user_id = auth.uid()
        )
      )
    )
  );
