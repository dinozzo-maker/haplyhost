-- 0016_archivio_sezioni_extra.sql
-- Le sezioni create dalla piattaforma non vengono piu' cancellate in modo
-- irreversibile: l'archivio le nasconde dalle guide ma conserva i contenuti
-- degli host, cosi' il superadmin puo' ripristinarle in futuro.

alter table public.sezioni_extra
  add column if not exists archiviata boolean not null default false;

