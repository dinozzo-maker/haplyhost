-- 0007_note_gennarino.sql
-- Testo libero dell'host con info pratiche sulla casa che non stanno nelle pagine
-- strutturate ("le luci del giardino si accendono dietro la porta della cucina…").
-- NON è visibile agli ospiti come sezione: lo leggono solo l'host (per scriverlo,
-- da /admin/note) e api/gennarino.js, che lo mette nel prompt di Gennarino.
-- NULL / vuoto = niente info extra.

alter table strutture add column if not exists note_gennarino text;
