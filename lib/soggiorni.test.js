import test from 'node:test'
import assert from 'node:assert/strict'
import { oggiInItalia, statoSoggiorno, tokenValido } from './soggiorni.js'

test('la password compare dal giorno del check-in al giorno del check-out compreso', () => {
  assert.equal(statoSoggiorno('2026-09-25', '2026-09-28', '2026-09-24'), 'presto')
  assert.equal(statoSoggiorno('2026-09-25', '2026-09-28', '2026-09-25'), 'in_corso')
  assert.equal(statoSoggiorno('2026-09-25', '2026-09-28', '2026-09-27'), 'in_corso')
  assert.equal(statoSoggiorno('2026-09-25', '2026-09-28', '2026-09-28'), 'in_corso')
  assert.equal(statoSoggiorno('2026-09-25', '2026-09-28', '2026-09-29'), 'scaduto')
})

test('un soggiorno di un solo giorno funziona', () => {
  assert.equal(statoSoggiorno('2026-09-25', '2026-09-25', '2026-09-25'), 'in_corso')
})

test('"oggi" segue il fuso italiano, non UTC', () => {
  // 23:30 UTC del 24 = 01:30 del 25 in Italia (ora legale): l'ospite è già nel giorno del check-in
  assert.equal(oggiInItalia(new Date('2026-09-24T23:30:00Z')), '2026-09-25')
  // 21:30 UTC = 23:30 in Italia: ancora lo stesso giorno
  assert.equal(oggiInItalia(new Date('2026-09-24T21:30:00Z')), '2026-09-24')
  // d'inverno (ora solare, UTC+1)
  assert.equal(oggiInItalia(new Date('2026-01-10T23:30:00Z')), '2026-01-11')
})

test('accetta solo token nella forma generata dal database', () => {
  assert.equal(tokenValido('a'.repeat(64)), true)
  assert.equal(tokenValido('0123456789abcdef'.repeat(4)), true)
  for (const x of ['', 'abc', 'A'.repeat(64), 'g'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), null, undefined, 42, ['a'.repeat(64)]]) {
    assert.equal(tokenValido(x), false)
  }
})
