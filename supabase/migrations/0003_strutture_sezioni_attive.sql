-- 0003_strutture_sezioni_attive.sql
-- Quali sezioni della guida sono visibili agli ospiti, per singola struttura.
-- Array jsonb delle `chiave` da mostrare (le stesse di src/sezioni.ts), es.
--   ["casa","piscina","mangiare","gennarino"]
-- NULL = mostra tutte le sezioni (comportamento storico). Le strutture esistenti
-- restano a NULL: nessun backfill necessario.

alter table strutture add column if not exists sezioni_attive jsonb;
