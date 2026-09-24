// Limite di "unità" per host (camere o alloggi prenotabili) — regole condivise da
// api/importa-casa.js (blocca PRIMA di spendere AI) e dal pannello. La rete di sicurezza
// vera sta nel database (migration 0023, trigger `limita_unita_host`): qui si spiega
// all'host cosa succede invece di mostrargli un errore tecnico.

// Da questo valore in su il limite è considerato assente (superadmin, accordi speciali).
export const LIMITE_ILLIMITATO = 999

// Legge il numero di unità scritto in un modulo (numero o testo). Ritorna un intero
// 1..999, oppure `predefinito` se il campo è vuoto/assente; lancia se non è un intero valido.
export function leggiUnita(valore, predefinito = 1) {
  if (valore === undefined || valore === null || valore === '') return predefinito
  const numero = typeof valore === 'number' ? valore : Number(String(valore).trim())
  if (!Number.isInteger(numero) || numero < 1 || numero > LIMITE_ILLIMITATO) {
    throw new Error('Il numero di camere o alloggi non è valido: scrivi un numero intero da 1 in su.')
  }
  return numero
}

// `usate` = unità delle strutture che l'host ha già; `incluse` = quelle del suo piano
// (null o >= 999 = nessun limite); `richieste` = quelle della struttura da creare/modificare
// (in modifica, `usate` va calcolato SENZA la struttura che si sta modificando).
export function verificaUnita({ usate, incluse, richieste }) {
  if (incluse == null || incluse >= LIMITE_ILLIMITATO) return { ok: true, disponibili: null, messaggio: '' }
  const disponibili = Math.max(0, incluse - usate)
  if (usate + richieste <= incluse) return { ok: true, disponibili, messaggio: '' }
  const messaggio =
    disponibili === 0
      ? `Hai già usato tutte le ${incluse} unità incluse nel tuo piano. Per aggiungerne altre serve un piano più grande: scrivi all'amministratore di Haplyhost.`
      : `Il tuo piano include ${incluse} unità e ne hai già usate ${usate}: te ne restano ${disponibili}, ma questa struttura ne richiede ${richieste}. Riduci le unità oppure scrivi all'amministratore di Haplyhost per un piano più grande.`
  return { ok: false, disponibili, messaggio }
}

// Il trigger del database segnala il superamento con un errore che contiene questo testo.
export function eErroreLimiteUnita(errore) {
  return typeof errore?.message === 'string' && errore.message.includes('LIMITE_UNITA')
}

export const MESSAGGIO_LIMITE_GENERICO =
  "Hai raggiunto il limite di unità del tuo piano. Scrivi all'amministratore di Haplyhost per passare a un piano più grande."
