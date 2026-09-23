-- Foto automatiche dei luoghi da Wikimedia Commons: le licenze CC BY / CC BY-SA
-- chiedono di indicare l'autore, quindi la guida mostra un piccolo credito sotto la foto.
-- Restano NULL per le foto caricate a mano dall'host (nessun credito da mostrare).
alter table public.luoghi
  add column if not exists foto_credito text,
  add column if not exists foto_credito_url text;
