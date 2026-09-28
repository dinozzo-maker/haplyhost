// Regole della ricerca automatica dei luoghi (wizard di configurazione) per le case isolate.
// Problema reale (Villa le Panche): con un raggio fisso di 5 km la sezione «Dove mangiare» trovava UN
// solo ristorante, mentre in centro a Firenze ce ne sono 50. Soluzione: NON chiedere all'AI «almeno
// 10» (la spingerebbe a inventare o ad abbassare i controlli sulle fonti: proprio i difetti corretti a
// settembre), ma ALLARGARE il raggio finché i luoghi VERIFICATI sono abbastanza, fino a un tetto.
// Se anche a 30 km ce ne sono pochi, si accetta il numero vero e lo si dice all'host.
// Usato da api/scout.js (validazione) e src/admin/ConfiguraGuida.tsx (il ciclo di ricerca).

export const LIMITE_PREDEFINITO = 5 // ricerca manuale: come prima
export const TETTO_LUOGHI = 10 // massimo di luoghi proposti per sezione nel wizard
export const SOGLIA_ALLARGAMENTO = 8 // sotto questo numero di luoghi verificati si allarga
export const RAGGIO_MASSIMO_KM = 30 // oltre non è più «dove mangiare»: è una gita
export const MAX_ALLARGAMENTI = 2 // giri in più per sezione, imposti anche dal database (migration 0026)

const RAGGI_ALLARGAMENTO = [15, 30]

// I raggi (km) da provare DOPO quello iniziale, in ordine. 1 o 5 km → 15, poi 30; 15 → 30; 30 → nessuno.
// Ogni giro cerca da 0 km al nuovo raggio: i luoghi già trovati vengono esclusi dal server.
export function passiAllargamento(raggioIniziale) {
  return RAGGI_ALLARGAMENTO.filter((r) => r > raggioIniziale && r <= RAGGIO_MASSIMO_KM).slice(0, MAX_ALLARGAMENTI)
}

// Un allargamento è valido solo verso uno dei raggi previsti: il server non accetta altro (né i 150 km).
export function raggioAllargamentoValido(raggio) {
  return RAGGI_ALLARGAMENTO.includes(Number(raggio))
}

export function serveAllargare(totaleTrovati) {
  return totaleTrovati < SOGLIA_ALLARGAMENTO
}

// Quanti luoghi chiedere al prossimo giro, per non superare mai il tetto per sezione.
export function quantiAncoraServono(totaleTrovati) {
  return Math.max(0, TETTO_LUOGHI - totaleTrovati)
}

// Legge il numero richiesto dal corpo della richiesta: intero 1..TETTO_LUOGHI, altrimenti il predefinito.
export function leggiLimite(valore, predefinito = LIMITE_PREDEFINITO) {
  const numero = Number(valore)
  return Number.isInteger(numero) && numero >= 1 && numero <= TETTO_LUOGHI ? numero : predefinito
}

// Messaggio onesto per l'host quando, anche dopo aver allargato, i luoghi verificati sono pochi.
export function messaggioPochiLuoghi({ etichetta, trovati, raggio }) {
  if (trovati === 0) {
    return `In «${etichetta}» non ho trovato luoghi verificati entro ${raggio} km. Puoi aggiungerli a mano dal pannello.`
  }
  const luoghi = trovati === 1 ? '1 luogo verificato' : `${trovati} luoghi verificati`
  return `In «${etichetta}» ho trovato solo ${luoghi} entro ${raggio} km: sono quelli che esistono davvero in zona. Puoi aggiungerne altri a mano dal pannello.`
}
