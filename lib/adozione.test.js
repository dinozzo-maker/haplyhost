import test from 'node:test'
import assert from 'node:assert/strict'
import { calcolaAdozione, SOGLIA_POCHI_DATI } from './adozione.js'
import { aggiungiGiorni } from './soggiorni.js'

const OGGI = '2026-09-26'
const s = (checkin, checkout, aperture) => ({ checkin, checkout, aperture })

test('nessun soggiorno: nessuna percentuale inventata', () => {
  const r = calcolaAdozione([], OGGI)
  assert.equal(r.soggiorni, 0)
  assert.equal(r.percentuale, null)
  assert.equal(r.apertureMedie, null)
  assert.equal(r.inCasaSenzaGuida, 0)
  assert.equal(r.pochiDati, true)
  assert.deepEqual(calcolaAdozione(undefined, OGGI), r)
})

test('percentuale e media: chi non l\'ha aperta pesa nel denominatore, ma non nella media', () => {
  const r = calcolaAdozione([
    s('2026-09-10', '2026-09-13', 3),
    s('2026-09-12', '2026-09-15', 1),
    s('2026-09-14', '2026-09-18', 0),
    s('2026-09-16', '2026-09-19', 0),
  ], OGGI)
  assert.equal(r.soggiorni, 4)
  assert.equal(r.aperti, 2)
  assert.equal(r.percentuale, 50)
  assert.equal(r.apertureMedie, 2) // (3 + 1) / 2, senza contare i due a zero
})

test('la media ha una cifra decimale e la percentuale è arrotondata', () => {
  const r = calcolaAdozione([
    s('2026-09-10', '2026-09-12', 2),
    s('2026-09-11', '2026-09-13', 1),
    s('2026-09-12', '2026-09-14', 1),
  ], OGGI)
  assert.equal(r.percentuale, 100)
  assert.equal(r.apertureMedie, 1.3) // 4 / 3 = 1,33…
  const b = calcolaAdozione([s('2026-09-10', '2026-09-12', 1), s('2026-09-11', '2026-09-13', 0), s('2026-09-12', '2026-09-14', 0)], OGGI)
  assert.equal(b.percentuale, 33) // 1/3 = 33,3
})

test('soggiorni futuri e più vecchi di 30 giorni non contano', () => {
  const r = calcolaAdozione([
    s('2026-09-27', '2026-09-30', 0), // arriva domani: non ha avuto modo di aprirla
    s('2026-10-15', '2026-10-18', 0),
    s('2026-08-26', '2026-08-29', 4), // esattamente 31 giorni fa: fuori
    s('2026-08-27', '2026-08-30', 2), // esattamente 30 giorni fa: dentro
    s('2026-09-26', '2026-09-28', 1), // arriva oggi: dentro
  ], OGGI)
  assert.equal(r.soggiorni, 2)
  assert.equal(r.aperti, 2)
})

test('ospiti in casa che non hanno mai aperto la guida', () => {
  const r = calcolaAdozione([
    s('2026-09-24', '2026-09-28', 0), // in casa, mai aperta → da sollecitare
    s('2026-09-25', '2026-09-27', 2), // in casa, aperta
    s('2026-09-20', '2026-09-23', 0), // già partiti senza aprirla: non è più sollecitabile
    s('2026-09-22', '2026-09-26', 0), // parte oggi: ancora in casa
  ], OGGI)
  assert.equal(r.inCasaSenzaGuida, 2)
  assert.equal(r.soggiorni, 4)
})

test('valori mancanti o nulli valgono zero aperture', () => {
  const r = calcolaAdozione([{ checkin: '2026-09-20', checkout: '2026-09-22' }, s('2026-09-21', '2026-09-23', null)], OGGI)
  assert.equal(r.aperti, 0)
  assert.equal(r.percentuale, 0)
  assert.equal(r.apertureMedie, null)
})

test('pochi dati sotto la soglia, non sopra', () => {
  const tanti = Array.from({ length: SOGLIA_POCHI_DATI }, (_, i) => s('2026-09-20', '2026-09-22', i % 2))
  assert.equal(calcolaAdozione(tanti, OGGI).pochiDati, false)
  assert.equal(calcolaAdozione(tanti.slice(1), OGGI).pochiDati, true)
})

test('aggiungiGiorni attraversa mesi e anni', () => {
  assert.equal(aggiungiGiorni('2026-09-26', -30), '2026-08-27')
  assert.equal(aggiungiGiorni('2026-12-31', 1), '2027-01-01')
  assert.equal(aggiungiGiorni('2027-03-01', -1), '2027-02-28')
  assert.equal(aggiungiGiorni('2028-03-01', -1), '2028-02-29') // anno bisestile
})
