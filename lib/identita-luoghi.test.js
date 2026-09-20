import test from 'node:test'
import assert from 'node:assert/strict'
import { possibileDuplicato } from './identita-luoghi.js'

test('riconosce il caso reale anche senza tipologia e località nel nome proposto', () => {
  const esistenti = ['Vatillum Pizzeria Paestum']
  for (const nome of ['Vaillum', 'Vatillum', 'VATILLUM PIZZERIA PAESTUM', 'Pizzeria Vaillum']) {
    assert.equal(possibileDuplicato(nome, esistenti), esistenti[0])
  }
  assert.equal(possibileDuplicato('Las Vegas', esistenti), null)
})

test('non considera duplicati nomi distinti che condividono parole generiche', () => {
  for (const [nome, esistente] of [
    ['Pizzeria', 'Pizzeria Vatillum'], ['Bar', 'Bar Roma'], ['La Botte', 'La Bottega'],
    ['Da Mario', 'Da Dario'], ['Pizzeria Napoli', 'Pizzeria Roma'],
    ['Bella Napoli 1', 'Bella Napoli 2'], ['Ristorante Nettuno', 'Hotel Nettuno'],
  ]) assert.equal(possibileDuplicato(nome, [esistente]), null, `${nome} / ${esistente}`)
  assert.equal(possibileDuplicato('', ['Vatillum']), null)
})

test('gestisce solo un refuso lungo e non modifica i nomi originali', () => {
  const nomi = ['Vatillum Pizzeria Paestum']
  assert.equal(possibileDuplicato('Vaillum Paestun', nomi), null)
  assert.deepEqual(nomi, ['Vatillum Pizzeria Paestum'])
  assert.equal(possibileDuplicato('Vaillum', []), null)
})
