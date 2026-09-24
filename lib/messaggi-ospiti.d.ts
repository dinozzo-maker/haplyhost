export type MomentoMessaggio = 'prima' | 'arrivo' | 'meta' | 'partenza' | 'dopo'
export const MOMENTI: MomentoMessaggio[]
export const LINGUE_MESSAGGI: { codice: string; etichetta: string }[]
export function momentoConsigliato(checkin: string, checkout: string, oggi: string): MomentoMessaggio
export function costruisciMessaggio(
  momento: MomentoMessaggio,
  lingua: string,
  dati: {
    nome: string
    casa: string
    link: string
    checkin: string
    checkout: string
    orarioCheckin?: string | null
    orarioCheckout?: string | null
    host?: string | null
  }
): string
