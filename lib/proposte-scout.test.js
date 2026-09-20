import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizzaProposte, citazioniGemini, citazioniClaude, distanzaGeograficaKm, chiaveUrl } from './proposte-scout.js'

const url = 'https://esempio.it/menu'
const candidato = {
  nome: 'Pizzeria Esempio', indirizzo: 'Via Roma 1, Sorrento',
  descrizione: 'Pizzeria in via Roma con pizze al forno a legna.',
  fonti: [{ url, titolo: 'Menu ufficiale', conferma: 'Nome e forno a legna', campi: ['nome', 'descrizione'] }],
}

test('scarta fonti inventate e URL non web', () => {
  assert.equal(normalizzaProposte([candidato], []).length, 0)
  const falso = { ...candidato, fonti: [{ ...candidato.fonti[0], url: 'javascript:alert(1)' }] }
  assert.equal(normalizzaProposte([falso], ['javascript:alert(1)']).length, 0)
})

test('non tronca descrizioni lunghe e richiede indirizzo e supporto della descrizione', () => {
  assert.equal(normalizzaProposte([{ ...candidato, descrizione: 'a'.repeat(201) }], [url]).length, 0)
  assert.equal(normalizzaProposte([{ ...candidato, indirizzo: '' }], [url]).length, 0)
  assert.equal(normalizzaProposte([{ ...candidato, fonti: [{ ...candidato.fonti[0], campi: ['nome'] }] }], [url]).length, 0)
})

test('omette valori senza riscontro e conserva fonti e dubbi', () => {
  const [proposta] = normalizzaProposte([{ ...candidato, prezzo: '10-20 €', distanza: '5 min', domanda_host: 'Quale sede intendi?', contraddizioni: ['Due indirizzi diversi'] }], [url])
  assert.equal(proposta.prezzo, '')
  assert.equal(proposta.distanza, '')
  assert.equal(proposta.verifica.non_verificato.length, 2)
  assert.equal(proposta.verifica.fonti[0].url, url)
  assert.equal(proposta.verifica.domanda_host, 'Quale sede intendi?')
})

test('esclude duplicati, già presenti e JSON malformato', () => {
  assert.equal(normalizzaProposte([candidato, candidato], [url]).length, 1)
  assert.equal(normalizzaProposte([candidato], [url], ['PIZZERIA ESEMPIO']).length, 0)
  assert.throws(() => normalizzaProposte({}, [url]))
  assert.deepEqual(normalizzaProposte([null, 3, {}], [url]), [])
})

test('legge solo citazioni dei motori, non URL nel testo generato', () => {
  assert.deepEqual(citazioniGemini({ steps: [{ type: 'model_output', content: [{ type: 'text', text: 'https://inventato.it', annotations: [{ type: 'url_citation', url }] }] }] }), [url])
  assert.deepEqual(citazioniClaude({ content: [{ type: 'text', citations: [{ url }] }] }), [url])
})

test('la fascia 15–30 esclude i luoghi vicini, i confini inferiori e le distanze senza fonte', () => {
  const fonte = { ...candidato.fonti[0], campi: ['nome', 'descrizione', 'distanza_km'] }
  for (const distanza_km of [0, 5, 15, 31, null, '20', NaN, Infinity]) {
    assert.equal(normalizzaProposte([{ ...candidato, distanza_km, fonti: [fonte] }], [url], [], 30).length, 0)
  }
  assert.equal(normalizzaProposte([{ ...candidato, distanza_km: 20 }], [url], [], 30).length, 0)
  for (const distanza_km of [15.01, 30]) {
    assert.equal(normalizzaProposte([{ ...candidato, distanza_km, fonti: [fonte] }], [url], [], 30).length, 1)
  }
})

test('calcola la distanza geografica senza affidarla al modello AI', () => {
  assert.equal(distanzaGeograficaKm(40, 14, 40, 14), 0)
  assert.ok(Math.abs(distanzaGeograficaKm(40, 14, 40.1, 14) - 11.1) < 0.2)
})

test('riconosce la stessa fonte ignorando solo tracciamento e slash finale', () => {
  assert.equal(chiaveUrl('https://esempio.it/menu/?utm_source=google'), 'https://esempio.it/menu')
  assert.equal(normalizzaProposte([candidato], ['https://esempio.it/menu/?utm_source=google']).length, 1)
  assert.equal(normalizzaProposte([candidato], ['https://esempio.it/altra-pagina']).length, 0)
})
