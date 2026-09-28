export const LIMITE_PREDEFINITO: number
export const TETTO_LUOGHI: number
export const SOGLIA_ALLARGAMENTO: number
export const RAGGIO_MASSIMO_KM: number
export const MAX_ALLARGAMENTI: number
export function passiAllargamento(raggioIniziale: number): number[]
export function raggioAllargamentoValido(raggio: unknown): boolean
export function serveAllargare(totaleTrovati: number): boolean
export function quantiAncoraServono(totaleTrovati: number): number
export function leggiLimite(valore: unknown, predefinito?: number): number
export function messaggioPochiLuoghi(dati: { etichetta: string; trovati: number; raggio: number }): string
