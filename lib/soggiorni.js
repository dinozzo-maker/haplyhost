// Logica delle date di un soggiorno, condivisa da api/ospite.js (azione wifi) e testata a parte.
// Le date del soggiorno sono giorni di calendario ("2026-09-25"), senza orario:
// si confrontano come stringhe YYYY-MM-DD, che in questo formato si ordinano bene.

// Data di oggi in Italia. Su Vercel il server è in UTC: senza fuso, tra mezzanotte e
// le 2 di notte "oggi" sarebbe ancora ieri e l'ospite arrivato il giorno del check-in
// non vedrebbe la password.
export function oggiInItalia(adesso = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(adesso)
}

// 'presto'    = il check-in non è ancora arrivato: niente password
// 'in_corso'  = dal giorno del check-in al giorno del check-out compreso
// 'scaduto'   = check-out passato: niente password
export function statoSoggiorno(checkin, checkout, oggi = oggiInItalia()) {
  if (oggi < checkin) return 'presto'
  if (oggi > checkout) return 'scaduto'
  return 'in_corso'
}

// Aggiunge (o toglie, con un numero negativo) giorni a una data "YYYY-MM-DD" senza passare
// dai fusi orari: si lavora in UTC solo per il calcolo del calendario.
export function aggiungiGiorni(data, giorni) {
  const [a, m, g] = data.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, g + giorni)).toISOString().slice(0, 10)
}

// Il token è generato dal database (due uuid v4 senza trattini = 64 caratteri esadecimali).
// Controllarne la forma prima di interrogare il DB scarta subito i tentativi a caso.
export function tokenValido(token) {
  return typeof token === 'string' && /^[0-9a-f]{64}$/.test(token)
}
