export const SOGLIA_POCHI_DATI: number
export function calcolaAdozione(
  soggiorni: { checkin: string; checkout: string; aperture?: number | null }[],
  oggi: string,
  giorni?: number
): {
  soggiorni: number
  aperti: number
  percentuale: number | null
  apertureMedie: number | null
  inCasaSenzaGuida: number
  pochiDati: boolean
}
