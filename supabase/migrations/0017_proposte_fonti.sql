-- Fonti e dubbi restano nelle proposte private dell'host, non nel testo della guida.
alter table public.proposte add column if not exists verifica jsonb;
comment on column public.proposte.verifica is
  'Fonti citate dalla ricerca Scout, indirizzo identificato, dettagli non verificati e domande per l’host. NULL per proposte precedenti.';
