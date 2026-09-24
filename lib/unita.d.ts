export const LIMITE_ILLIMITATO: number
export function leggiUnita(valore: unknown, predefinito?: number): number
export function verificaUnita(dati: { usate: number; incluse: number | null; richieste: number }): {
  ok: boolean
  disponibili: number | null
  messaggio: string
}
export function eErroreLimiteUnita(errore: unknown): boolean
export const MESSAGGIO_LIMITE_GENERICO: string
