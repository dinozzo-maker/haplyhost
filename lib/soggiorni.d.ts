export function oggiInItalia(adesso?: Date): string
export function statoSoggiorno(checkin: string, checkout: string, oggi?: string): 'presto' | 'in_corso' | 'scaduto'
export function aggiungiGiorni(data: string, giorni: number): string
export function tokenValido(token: unknown): boolean
