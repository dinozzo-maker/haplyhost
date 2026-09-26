// Quanto viene usata la guida: numeri per il cruscotto «Adozione della guida» (src/admin/AdozioneGuida.tsx).
// Si basa sul conteggio delle aperture per soggiorno (migration 0024). Volutamente prudente: la
// stessa cifra serve all'host per capire se la guida funziona e per raccontarlo ad altri, quindi
// non deve mai gonfiarsi (un soggiorno senza aperture pesa nel denominatore, mai escluso).
import { aggiungiGiorni } from './soggiorni.js'

// Sotto questo numero di soggiorni una percentuale dice poco: il cruscotto lo segnala.
export const SOGLIA_POCHI_DATI = 5

// `soggiorni`: [{ checkin, checkout, aperture }], date "YYYY-MM-DD". `oggi`: "YYYY-MM-DD".
// Si contano i soggiorni ARRIVATI negli ultimi `giorni` giorni (oggi compreso): quelli futuri non
// hanno ancora avuto modo di aprire la guida e falserebbero la percentuale al ribasso.
export function calcolaAdozione(soggiorni, oggi, giorni = 30) {
  const da = aggiungiGiorni(oggi, -giorni)
  const considerati = (soggiorni || []).filter((s) => s.checkin <= oggi && s.checkin >= da)

  const conAperture = considerati.filter((s) => (s.aperture || 0) > 0)
  const totaleAperture = conAperture.reduce((somma, s) => somma + s.aperture, 0)
  // Ospiti che sono in casa ora e non hanno mai aperto la guida: sono quelli da sollecitare.
  const inCasaSenzaGuida = considerati.filter((s) => s.checkout >= oggi && !((s.aperture || 0) > 0)).length

  return {
    soggiorni: considerati.length,
    aperti: conAperture.length,
    percentuale: considerati.length ? Math.round((conAperture.length / considerati.length) * 100) : null,
    // media SOLO tra chi l'ha aperta, una cifra decimale
    apertureMedie: conAperture.length ? Math.round((totaleAperture / conAperture.length) * 10) / 10 : null,
    inCasaSenzaGuida,
    pochiDati: considerati.length < SOGLIA_POCHI_DATI,
  }
}
