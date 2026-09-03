import type { Lingua } from './lingua'

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

// Etichette delle 14 sezioni di sistema nelle lingue della guida (l'italiano è già `etichetta`).
// Le sezioni custom (sezioni_extra) non sono qui: restano con l'etichetta italiana.
const ETICHETTE_TRAD: Record<string, Partial<Record<Lingua, string>>> = {
  casa: { en: 'Home & Wi-Fi', fr: 'Logement & Wi-Fi', de: 'Wohnung & WLAN', es: 'Alojamiento y Wi-Fi' },
  piscina: { en: 'Pool', fr: 'Piscine', de: 'Pool', es: 'Piscina' },
  spiagge: { en: 'Beaches', fr: 'Plages', de: 'Strände', es: 'Playas' },
  mangiare: { en: 'Where to Eat', fr: 'Où Manger', de: 'Essen gehen', es: 'Dónde Comer' },
  vicinanze: { en: 'Nearby', fr: 'À Proximité', de: 'In der Nähe', es: 'Cerca de aquí' },
  visitare: { en: 'What to See', fr: 'À Visiter', de: 'Sehenswertes', es: 'Qué Visitar' },
  divertimento: { en: 'Fun & Activities', fr: 'Loisirs & Activités', de: 'Freizeit & Aktivitäten', es: 'Ocio y Actividades' },
  gite: { en: 'Trips & Excursions', fr: 'Sorties & Excursions', de: 'Ausflüge & Touren', es: 'Excursiones' },
  trasporti: { en: 'Transport', fr: 'Transports', de: 'Verkehrsmittel', es: 'Transporte' },
  differenziata: { en: 'Recycling', fr: 'Tri des Déchets', de: 'Mülltrennung', es: 'Reciclaje' },
  regole: { en: 'House Rules', fr: 'Règlement Intérieur', de: 'Hausordnung', es: 'Normas de la Casa' },
  emergenze: { en: 'Emergencies', fr: 'Urgences', de: 'Notfälle', es: 'Emergencias' },
  contatti: { en: 'Contacts', fr: 'Contacts', de: 'Kontakte', es: 'Contactos' },
  gennarino: { en: 'Ask Gennarino', fr: 'Demander à Gennarino', de: 'Gennarino fragen', es: 'Pregunta a Gennarino' },
}

export function etichettaSezione(s: Sezione, lingua: Lingua): string {
  if (lingua === 'it') return s.etichetta
  return ETICHETTE_TRAD[s.chiave]?.[lingua] ?? s.etichetta
}