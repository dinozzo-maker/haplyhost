import test from 'node:test'
import assert from 'node:assert/strict'
import {
  passiAllargamento, raggioAllargamentoValido, serveAllargare, quantiAncoraServono, leggiLimite,
  messaggioPochiLuoghi, SOGLIA_ALLARGAMENTO, TETTO_LUOGHI, RAGGIO_MASSIMO_KM, MAX_ALLARGAMENTI,
} from './allargamento-ricerca.js'

test('le regole scelte con l\'utente: sotto 8 si allarga, mai oltre 10 luoghi né oltre 30 km', () => {
  assert.equal(SOGLIA_ALLARGAMENTO, 8)
  assert.equal(TETTO_LUOGHI, 10)
  assert.equal(RAGGIO_MASSIMO_KM, 30)
  assert.equal(MAX_ALLARGAMENTI, 2)
})

test('i raggi da provare dopo quello iniziale, mai oltre 30 km e mai più di 2 giri', () => {
  assert.deepEqual(passiAllargamento(1), [15, 30]) // vicinanze, trasporti
  assert.deepEqual(passiAllargamento(5), [15, 30]) // mangiare, spiagge, divertimento
  assert.deepEqual(passiAllargamento(15), [30]) // visitare
  assert.deepEqual(passiAllargamento(30), []) // gite: già al massimo
  assert.deepEqual(passiAllargamento(150), [])
  for (const iniziale of [1, 5, 15, 30]) {
    const passi = passiAllargamento(iniziale)
    assert.ok(passi.length <= MAX_ALLARGAMENTI)
    assert.ok(passi.every((r) => r > iniziale && r <= RAGGIO_MASSIMO_KM))
  }
})

test('si allarga solo sotto la soglia: 7 sì, 8 no (Firenze non spende niente in più)', () => {
  assert.equal(serveAllargare(0), true)
  assert.equal(serveAllargare(1), true) // Villa le Panche: un solo ristorante
  assert.equal(serveAllargare(7), true)
  assert.equal(serveAllargare(8), false)
  assert.equal(serveAllargare(10), false)
})

test('non si chiedono mai più luoghi di quelli che servono per arrivare a 10', () => {
  assert.equal(quantiAncoraServono(0), 10)
  assert.equal(quantiAncoraServono(1), 9)
  assert.equal(quantiAncoraServono(7), 3)
  assert.equal(quantiAncoraServono(10), 0)
  assert.equal(quantiAncoraServono(14), 0) // mai negativo
})

test('il server accetta solo gli allargamenti previsti (non i 150 km, non valori strani)', () => {
  assert.equal(raggioAllargamentoValido(15), true)
  assert.equal(raggioAllargamentoValido('30'), true)
  for (const x of [1, 5, 150, 20, 0, -15, 'boh', null, undefined, NaN]) assert.equal(raggioAllargamentoValido(x), false, String(x))
})

test('il numero di luoghi richiesto è un intero da 1 a 10, altrimenti il predefinito (5)', () => {
  assert.equal(leggiLimite(10), 10)
  assert.equal(leggiLimite('7'), 7)
  assert.equal(leggiLimite(1), 1)
  for (const x of [0, 11, 100, -3, 2.5, 'tanti', null, undefined, NaN, [], {}]) assert.equal(leggiLimite(x), 5, String(x))
  assert.equal(leggiLimite(undefined, 3), 3)
})

test('messaggio onesto per l\'host, al singolare e al plurale', () => {
  assert.match(messaggioPochiLuoghi({ etichetta: 'Dove Mangiare', trovati: 1, raggio: 30 }), /solo 1 luogo verificato entro 30 km/)
  assert.match(messaggioPochiLuoghi({ etichetta: 'Dove Mangiare', trovati: 4, raggio: 30 }), /solo 4 luoghi verificati/)
  assert.match(messaggioPochiLuoghi({ etichetta: 'Spiagge', trovati: 0, raggio: 15 }), /non ho trovato luoghi verificati entro 15 km/)
  assert.match(messaggioPochiLuoghi({ etichetta: 'Dove Mangiare', trovati: 4, raggio: 30 }), /aggiungerne altri a mano/)
})
