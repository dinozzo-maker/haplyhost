import test from 'node:test'
import assert from 'node:assert/strict'
import { leggiUnita, verificaUnita, eErroreLimiteUnita } from './unita.js'

test('legge le unità da numeri e testi, con 1 come valore di partenza', () => {
  assert.equal(leggiUnita(5), 5)
  assert.equal(leggiUnita('5'), 5)
  assert.equal(leggiUnita(' 12 '), 12)
  assert.equal(leggiUnita(''), 1)
  assert.equal(leggiUnita(undefined), 1)
  assert.equal(leggiUnita(null, 3), 3)
})

test('rifiuta unità non valide', () => {
  for (const x of [0, -1, 1.5, '1.5', 'abc', 1000, NaN, '5 camere', [], {}]) {
    assert.throws(() => leggiUnita(x), /non è valido/, String(x))
  }
})

test('entro il limite passa, anche esattamente al limite', () => {
  assert.equal(verificaUnita({ usate: 0, incluse: 5, richieste: 5 }).ok, true)
  assert.equal(verificaUnita({ usate: 2, incluse: 5, richieste: 3 }).ok, true)
  assert.equal(verificaUnita({ usate: 2, incluse: 5, richieste: 3 }).disponibili, 3)
})

test('oltre il limite blocca e spiega quante ne restano', () => {
  const r = verificaUnita({ usate: 3, incluse: 5, richieste: 3 })
  assert.equal(r.ok, false)
  assert.equal(r.disponibili, 2)
  assert.match(r.messaggio, /include 5 unità/)
  assert.match(r.messaggio, /già usate 3/)
  assert.match(r.messaggio, /te ne restano 2/)
})

test('con tutte le unità già usate il messaggio parla di piano più grande', () => {
  const r = verificaUnita({ usate: 5, incluse: 5, richieste: 1 })
  assert.equal(r.ok, false)
  assert.equal(r.disponibili, 0)
  assert.match(r.messaggio, /tutte le 5 unità/)
  assert.match(r.messaggio, /piano più grande/)
})

test('senza limite (null o 999) passa sempre', () => {
  assert.equal(verificaUnita({ usate: 500, incluse: null, richieste: 400 }).ok, true)
  assert.equal(verificaUnita({ usate: 500, incluse: 999, richieste: 400 }).ok, true)
  assert.equal(verificaUnita({ usate: 500, incluse: 999, richieste: 400 }).disponibili, null)
})

test('riconosce l\'errore del trigger del database', () => {
  assert.equal(eErroreLimiteUnita({ message: 'LIMITE_UNITA: 5/5 unità già usate' }), true)
  assert.equal(eErroreLimiteUnita({ message: 'duplicate key' }), false)
  assert.equal(eErroreLimiteUnita(null), false)
  assert.equal(eErroreLimiteUnita(undefined), false)
})
