export type TipoSezione = 'elenco' | 'testo' | 'chat'

export type Sezione = {
  chiave: string
  icona: string
  etichetta: string
  tipo: TipoSezione
  descrizione?: string // vuota per le sezioni di sistema; usata dalle sezioni custom (superadmin)
}

export const SEZIONI: Sezione[] = [
  { chiave: 'casa', icona: '🏠', etichetta: 'Casa & Wi-Fi', tipo: 'testo' },
  { chiave: 'piscina', icona: '🏊', etichetta: 'Piscina', tipo: 'testo' },
  { chiave: 'spiagge', icona: '🏖️', etichetta: 'Spiagge', tipo: 'elenco' },
  { chiave: 'mangiare', icona: '🍝', etichetta: 'Dove Mangiare', tipo: 'elenco' },
  { chiave: 'vicinanze', icona: '🛒', etichetta: 'Nelle Vicinanze', tipo: 'elenco' },
  { chiave: 'visitare', icona: '🏛️', etichetta: 'Cosa Visitare', tipo: 'elenco' },
  { chiave: 'divertimento', icona: '🎡', etichetta: 'Svago e Attività', tipo: 'elenco' },
  { chiave: 'gite', icona: '🗺️', etichetta: 'Gite e Escursioni', tipo: 'elenco' },
  { chiave: 'trasporti', icona: '🚌', etichetta: 'Trasporti', tipo: 'elenco' },
  { chiave: 'differenziata', icona: '♻️', etichetta: 'Differenziata', tipo: 'testo' },
  { chiave: 'regole', icona: '📋', etichetta: 'Regole Casa', tipo: 'testo' },
  { chiave: 'emergenze', icona: '🚨', etichetta: 'Emergenze', tipo: 'testo' },
  { chiave: 'contatti', icona: '📞', etichetta: 'Contatti', tipo: 'testo' },
  { chiave: 'gennarino', icona: '🤵', etichetta: 'Chiedi a Gennarino', tipo: 'chat' },
]

// Chiavi delle sezioni di sistema — usate per distinguerle dalle sezioni custom (sezioni_extra).
export const CHIAVI_BUILTIN = new Set(SEZIONI.map((s) => s.chiave))

// Sezioni visibili nella guida ospiti di una struttura.
// sezioniAttive = lista esplicita di chiavi da mostrare; null = tutte le sezioni
// di sistema (le custom vanno comunque attivate a mano dall'host).
// Usata da Home, TabBar e GennarinoFab: unica fonte del filtro.
export function filtraVisibili(tutte: Sezione[], sezioniAttive: string[] | null): Sezione[] {
  return tutte.filter((s) =>
    sezioniAttive ? sezioniAttive.includes(s.chiave) : CHIAVI_BUILTIN.has(s.chiave)
  )
}