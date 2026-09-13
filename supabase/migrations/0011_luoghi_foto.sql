-- Foto per singolo luogo (punto 3 del redesign: più fotografia reale nella guida).
-- Caricata dall'host in GestisciSezione.tsx sul bucket Storage esistente "copertine"
-- (percorso "luoghi/<struttura_id>/..."), stessa logica già usata per la foto di
-- copertina della struttura. RLS pubblica di luoghi non cambia: chi vede il luogo
-- vede anche la sua foto.
alter table luoghi add column if not exists foto_url text;
