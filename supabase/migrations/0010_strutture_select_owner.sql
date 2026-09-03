-- 0010_strutture_select_owner.sql
-- L'host deve vedere la PROPRIA struttura nel pannello anche se è spenta (attivo=false).
-- Oggi la trova solo grazie alla policy pubblica "SELECT dove attivo=true": se spegne
-- la struttura, sparisce dal suo stesso pannello. Questa policy si aggiunge a quella
-- pubblica (le policy SELECT sono in OR): riga visibile se attivo=true OPPURE se sei l'owner.

drop policy if exists "strutture: l'owner vede la propria" on strutture;
create policy "strutture: l'owner vede la propria"
  on strutture for select to authenticated
  using (owner_user_id = auth.uid());
