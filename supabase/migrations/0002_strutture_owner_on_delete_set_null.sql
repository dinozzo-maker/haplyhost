-- 0002_strutture_owner_on_delete_set_null.sql
-- La FK strutture.owner_user_id -> auth.users(id) era senza regola ON DELETE:
-- cancellare un utente da Supabase Auth falliva ("Database error deleting user")
-- se quell'utente possedeva una struttura.
-- Con ON DELETE SET NULL la struttura resta (diventa senza proprietario) e l'utente
-- si può cancellare. NON usiamo CASCADE apposta: cancellare un account non deve
-- portarsi via tutta la guida di quel cliente.

do $$
declare
  nome_vincolo text;
begin
  select conname into nome_vincolo
  from pg_constraint
  where conrelid = 'public.strutture'::regclass
    and contype = 'f'
    and pg_get_constraintdef(oid) ilike '%owner_user_id%';

  if nome_vincolo is not null then
    execute format('alter table public.strutture drop constraint %I', nome_vincolo);
  end if;
end $$;

alter table public.strutture
  add constraint strutture_owner_user_id_fkey
  foreign key (owner_user_id) references auth.users(id) on delete set null;
