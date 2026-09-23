import test from 'node:test'
import assert from 'node:assert/strict'
import { confrontaNomi, scegliVoce, informazioniFoto, cercaFotoLuogo } from './foto-wikimedia.js'

const PAESTUM = { lat: 40.4057, lng: 14.996 }

test('riconosce lo stesso luogo scritto in modo un po\' diverso', () => {
  assert.equal(confrontaNomi('Il Granato', 'Granato'), 'esatto')
  assert.equal(confrontaNomi('Velia (Elea)', 'Velia (città antica)'), 'incluso')
  assert.equal(confrontaNomi('Museo Archeologico di Paestum', 'Museo archeologico nazionale di Paestum'), 'incluso')
  assert.equal(confrontaNomi('Parco Archeologico di Paestum', 'Paestum'), 'incluso')
  assert.equal(confrontaNomi('Pompei', 'Scavi archeologici di Pompei'), 'incluso')
})

test('non abbina luoghi diversi né nomi fatti solo di parole generiche', () => {
  assert.equal(confrontaNomi('Pizzeria La Basilica', 'Basilica di San Pietro'), null)
  assert.equal(confrontaNomi('Lido Nettuno', 'Ristorante'), null)
  assert.equal(confrontaNomi('Tabacchi', 'Tabacchi'), null)
  assert.equal(confrontaNomi('Bar', 'Bar'), null)
  assert.equal(confrontaNomi('Nonna Sceppa', 'Jolanda Granato'), null)
})

test('senza coordinate vicine non si sceglie nulla, anche con lo stesso nome (caso "Il Granato")', () => {
  const voci = [{ titolo: 'Granato', immagine: 'Melograno.jpg' }]
  assert.equal(scegliVoce('Il Granato', voci, PAESTUM), null)
})

test('scarta la stessa voce se è lontana dalla struttura, la tiene se è vicina', () => {
  const lontana = { titolo: 'San Salvatore', immagine: 'a.jpg', lat: 45.07, lng: 7.68 } // Torino
  const vicina = { titolo: 'San Salvatore', immagine: 'b.jpg', lat: 40.42, lng: 15.0 }
  assert.equal(scegliVoce('San Salvatore', [lontana], PAESTUM), null)
  assert.equal(scegliVoce('San Salvatore', [lontana, vicina], PAESTUM), vicina)
})

test('salta le voci senza immagine e non lavora senza le coordinate della struttura', () => {
  const voce = { titolo: 'Agropoli', immagine: null, lat: 40.35, lng: 15.0 }
  assert.equal(scegliVoce('Agropoli', [voce], PAESTUM), null)
  const buona = { ...voce, immagine: 'x.jpg' }
  assert.equal(scegliVoce('Agropoli', [buona], PAESTUM), buona)
  assert.equal(scegliVoce('Agropoli', [buona], { lat: null, lng: null }), null)
})

const commons = (mime, licenza, artista = '<a href="x">Mario Rossi</a>') => ({
  imageinfo: [{
    mime,
    thumburl: 'https://upload.wikimedia.org/thumb.jpg',
    url: 'https://upload.wikimedia.org/full.jpg',
    descriptionurl: 'https://commons.wikimedia.org/wiki/File:X.jpg',
    extmetadata: { LicenseShortName: { value: licenza }, Artist: { value: artista } },
  }],
})

test('accetta solo JPEG con licenza libera e ne ricava il credito', () => {
  const ok = informazioniFoto(commons('image/jpeg', 'CC BY-SA 4.0'))
  assert.equal(ok.credito, 'Mario Rossi · CC BY-SA 4.0')
  assert.equal(ok.url, 'https://upload.wikimedia.org/thumb.jpg')
  assert.ok(informazioniFoto(commons('image/jpeg', 'Public domain')))
  assert.ok(informazioniFoto(commons('image/jpeg', 'CC0')))
  assert.equal(informazioniFoto(commons('image/svg+xml', 'CC BY-SA 4.0')), null) // cartine, bandiere
  assert.equal(informazioniFoto(commons('image/png', 'CC BY-SA 4.0')), null) // loghi
  assert.equal(informazioniFoto(commons('image/jpeg', 'Fair use')), null)
  assert.equal(informazioniFoto(commons('image/jpeg', '')), null)
  assert.equal(informazioniFoto({}), null)
  assert.equal(informazioniFoto(undefined), null)
})

test('senza autore indicato il credito ripiega su Wikimedia Commons', () => {
  assert.equal(informazioniFoto(commons('image/jpeg', 'CC BY 4.0', '')).credito, 'Wikimedia Commons · CC BY 4.0')
})

test('ricerca completa con rete simulata: trova Castellabate e non inventa "Il Granato"', async () => {
  const fetchFinto = async (url) => {
    const u = new URL(url)
    let corpo
    if (u.hostname === 'it.wikipedia.org') {
      const termine = u.searchParams.get('gsrsearch')
      corpo = termine.startsWith('Castellabate')
        ? { query: { pages: { 1: { title: 'Castellabate', index: 1, pageimage: 'Castellabate.jpg', coordinates: [{ lat: 40.28, lon: 14.95 }] } } } }
        : { query: { pages: { 1: { title: 'Granato', index: 1, pageimage: 'Melograno.jpg' } } } }
    } else {
      corpo = { query: { pages: { 9: commons('image/jpeg', 'CC BY-SA 3.0') } } }
    }
    return { ok: true, json: async () => corpo }
  }
  const trovata = await cercaFotoLuogo({ nome: 'Castellabate', citta: 'Paestum', struttura: PAESTUM }, fetchFinto)
  assert.equal(trovata.voce, 'Castellabate')
  assert.equal(trovata.credito, 'Mario Rossi · CC BY-SA 3.0')
  assert.equal(await cercaFotoLuogo({ nome: 'Il Granato', citta: 'Paestum', struttura: PAESTUM }, fetchFinto), null)
})
