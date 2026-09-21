import test from 'node:test'
import assert from 'node:assert/strict'
import { validaDatiCasa } from './configurazione-casa.js'

test('tre reti distinte: conserva password e nomi esattamente, zona facoltativa', () => {
  const reti = ['Terra', 'Primo', 'Giardino'].map(nome => ({ nome, password: ' p@ss spazi ', zona: '' }))
  assert.deepEqual(validaDatiCasa({ nome: 'Casa', indirizzo: 'Via Roma 1', reti_wifi: reti }).reti_wifi, reti)
})
test('nessuna rete obbligatoria; rete aperta ammessa, password orfana rifiutata', () => {
  assert.deepEqual(validaDatiCasa({ nome: 'Casa', indirizzo: 'Via Roma' }).reti_wifi, [])
  assert.equal(validaDatiCasa({ nome: 'Casa', indirizzo: 'Via Roma', reti_wifi: [{ nome: 'Ospiti', password: '', zona: '' }] }).reti_wifi.length, 1)
  assert.throws(() => validaDatiCasa({ nome: 'Casa', indirizzo: 'Via Roma', reti_wifi: [{ nome: '', password: 'segreta', zona: '' }] }))
})
test('rifiuta input malformato, link non web e reti oltre limite', () => {
  const base = { nome: 'Casa', indirizzo: 'Via Roma' }
  for (const extra of [{ nome: {} }, { link: 'file:///privato' }, { reti_wifi: 'rete' }, { reti_wifi: Array(21).fill({}) }]) {
    assert.throws(() => validaDatiCasa({ ...base, ...extra }))
  }
})
