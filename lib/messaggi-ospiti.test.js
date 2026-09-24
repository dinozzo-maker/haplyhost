import test from 'node:test'
import assert from 'node:assert/strict'
import { MOMENTI, LINGUE_MESSAGGI, momentoConsigliato, costruisciMessaggio } from './messaggi-ospiti.js'

const LINK = 'https://haplyhost.vercel.app/villavirginia?s=' + 'a'.repeat(64)
const base = {
  nome: 'Famiglia Rossi', casa: 'Villa Virginia', link: LINK, checkin: '2026-09-25', checkout: '2026-09-28',
  orarioCheckin: 'dalle 15:00', orarioCheckout: 'entro le 10', host: 'Annamaria',
}

test('ogni messaggio in ogni lingua ha nome, casa e firma, e nessun segnaposto rimasto', () => {
  for (const { codice } of LINGUE_MESSAGGI) {
    for (const momento of MOMENTI) {
      const t = costruisciMessaggio(momento, codice, base)
      const dove = `${codice}/${momento}`
      assert.ok(t.includes('Famiglia Rossi'), `${dove}: manca il nome`)
      assert.ok(t.endsWith('\n\nAnnamaria'), `${dove}: manca la firma`)
      for (const vietato of ['undefined', 'null', 'NaN', '${', '{d.', '[object']) {
        assert.ok(!t.includes(vietato), `${dove}: contiene "${vietato}"`)
      }
    }
  }
})

test('il link personale c\'è in tutti i messaggi tranne quello dopo la partenza', () => {
  for (const { codice } of LINGUE_MESSAGGI) {
    for (const momento of MOMENTI) {
      const t = costruisciMessaggio(momento, codice, base)
      assert.equal(t.includes(LINK), momento !== 'dopo', `${codice}/${momento}`)
    }
  }
})

test('la casa compare dove serve (arrivo del giorno prima, partenza, dopo)', () => {
  for (const { codice } of LINGUE_MESSAGGI) {
    for (const momento of ['prima', 'partenza', 'dopo']) {
      assert.ok(costruisciMessaggio(momento, codice, base).includes('Villa Virginia'), `${codice}/${momento}`)
    }
  }
})

test('la data d\'arrivo è nella lingua del messaggio', () => {
  assert.match(costruisciMessaggio('prima', 'it', base), /venerdì 25 settembre/)
  assert.match(costruisciMessaggio('prima', 'en', base), /Friday, September 25/)
  assert.match(costruisciMessaggio('prima', 'fr', base), /vendredi 25 septembre/)
  assert.match(costruisciMessaggio('prima', 'de', base), /Freitag, 25\. September/)
  assert.match(costruisciMessaggio('prima', 'es', base), /viernes, 25 de septiembre/)
})

test('orari: in italiano com\'è scritto, nelle altre lingue solo l\'ora', () => {
  assert.match(costruisciMessaggio('prima', 'it', base), /Check-in: dalle 15:00\./)
  assert.match(costruisciMessaggio('partenza', 'it', base), /Check-out: entro le 10\./)
  assert.match(costruisciMessaggio('prima', 'en', base), /Check-in from 15:00\./)
  assert.match(costruisciMessaggio('partenza', 'en', base), /Check-out by 10:00\./)
  assert.match(costruisciMessaggio('prima', 'de', base), /Check-in ab 15:00 Uhr\./)
  assert.match(costruisciMessaggio('partenza', 'fr', base), /Départ avant 10:00\./)
  assert.match(costruisciMessaggio('prima', 'es', base), /a partir de las 15:00\./)
  // niente parole italiane nelle altre lingue
  assert.ok(!costruisciMessaggio('prima', 'en', base).includes('dalle'))
  assert.ok(!costruisciMessaggio('partenza', 'de', base).includes('entro'))
})

test('orari vuoti, senza cifre o assurdi: nessuna frase a metà', () => {
  for (const orario of ['', null, undefined, '   ', 'al mattino', '99:99']) {
    for (const { codice } of LINGUE_MESSAGGI) {
      if (codice === 'it' && orario && orario.trim() && orario !== '99:99') continue // in italiano il testo libero si riporta com'è
      const t = costruisciMessaggio('prima', codice, { ...base, orarioCheckin: orario })
      assert.ok(!/Check-in[^\n]*\.\s*\n/.test(t) || codice === 'it', `${codice} "${orario}": frase orario inattesa`)
      assert.ok(!t.includes('  '), `${codice} "${orario}": doppio spazio`)
    }
  }
  const senza = costruisciMessaggio('prima', 'it', { ...base, orarioCheckin: '' })
  assert.ok(!senza.includes('Check-in'))
  assert.match(senza, /venerdì 25 settembre\.\n\nQuesta è la guida/)
})

test('senza nome dell\'host non c\'è firma; con spazi attorno viene ripulita', () => {
  assert.ok(!costruisciMessaggio('meta', 'it', { ...base, host: '' }).endsWith('\n\n'))
  assert.ok(costruisciMessaggio('meta', 'it', { ...base, host: null }).endsWith('siamo qui.'))
  assert.ok(costruisciMessaggio('meta', 'it', { ...base, host: '  Anna  ' }).endsWith('\n\nAnna'))
})

test('lingua sconosciuta ripiega sull\'italiano; momento sconosciuto è un errore', () => {
  assert.equal(costruisciMessaggio('meta', 'xx', base), costruisciMessaggio('meta', 'it', base))
  assert.throws(() => costruisciMessaggio('boh', 'it', base), /Momento sconosciuto/)
})

test('quale messaggio mandare oggi', () => {
  const c = (oggi) => momentoConsigliato('2026-09-25', '2026-09-30', oggi)
  assert.equal(c('2026-09-20'), 'prima') // ancora lontano
  assert.equal(c('2026-09-24'), 'prima') // il giorno prima dell'arrivo
  assert.equal(c('2026-09-25'), 'arrivo') // giorno dell'arrivo
  assert.equal(c('2026-09-26'), 'meta')
  assert.equal(c('2026-09-28'), 'meta')
  assert.equal(c('2026-09-29'), 'partenza') // il giorno prima del check-out
  assert.equal(c('2026-09-30'), 'partenza') // giorno del check-out
  assert.equal(c('2026-10-01'), 'dopo')
})

test('soggiorni brevi: notte singola e cambio mese/anno', () => {
  // una notte: arrivo il 25, partenza il 26
  assert.equal(momentoConsigliato('2026-09-25', '2026-09-26', '2026-09-25'), 'arrivo')
  assert.equal(momentoConsigliato('2026-09-25', '2026-09-26', '2026-09-26'), 'partenza')
  // stesso giorno
  assert.equal(momentoConsigliato('2026-09-25', '2026-09-25', '2026-09-25'), 'arrivo')
  // il giorno prima del check-out attraversa il mese
  assert.equal(momentoConsigliato('2026-09-25', '2026-10-01', '2026-09-30'), 'partenza')
  assert.equal(momentoConsigliato('2026-12-28', '2027-01-02', '2027-01-01'), 'partenza')
  assert.equal(momentoConsigliato('2026-12-28', '2027-01-04', '2026-12-31'), 'meta')
})
