import { createContext, useContext } from 'react'

// Lingue della guida ospiti. 'it' è la lingua base (le colonne del DB); le altre
// stanno in luoghi.traduzioni / pagine.traduzioni come { en: {...}, fr: {...}, ... }.
export const LINGUE = ['it', 'en', 'fr', 'de', 'es'] as const
export type Lingua = (typeof LINGUE)[number]

export const LINGUE_LABEL: Record<Lingua, string> = {
  it: 'Italiano',
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
}

const CHIAVE_LS = 'haply-lingua'

function eValida(v: unknown): v is Lingua {
  return typeof v === 'string' && (LINGUE as readonly string[]).includes(v)
}

function linguaSalvata(): Lingua | null {
  try {
    const v = localStorage.getItem(CHIAVE_LS)
    return eValida(v) ? v : null
  } catch {
    return null
  }
}

export function salvaLingua(l: Lingua) {
  try {
    localStorage.setItem(CHIAVE_LS, l)
  } catch {
    /* private browsing: la scelta vale solo per questa visita */
  }
}

// Lingua salvata dall'ospite, altrimenti quella del telefono/browser, altrimenti italiano.
export function rilevaLingua(): Lingua {
  const salvata = linguaSalvata()
  if (salvata) return salvata
  const preferite =
    typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : []
  for (const p of preferite) {
    const due = (p || '').slice(0, 2).toLowerCase()
    if (eValida(due)) return due
  }
  return 'it'
}

export type ContestoLingua = { lingua: Lingua; setLingua: (l: Lingua) => void }
export const LinguaContext = createContext<ContestoLingua>({ lingua: 'it', setLingua: () => {} })

export function useLingua() {
  return useContext(LinguaContext)
}

// ---- traduzione dei dati (luoghi, pagine) ----
export type Traduzioni = Record<string, Record<string, string>> | null | undefined

// Valore di un campo nella lingua scelta, con ripiego sulla colonna italiana campo per campo.
export function campoTradotto(
  base: string | null | undefined,
  traduzioni: Traduzioni,
  campo: string,
  lingua: Lingua,
): string {
  if (lingua === 'it') return base ?? ''
  return traduzioni?.[lingua]?.[campo] ?? base ?? ''
}

// Sostituisce %s (di solito col nome della struttura).
export function conNome(template: string, nome: string): string {
  return template.replace('%s', nome)
}

// Frasi che, in una pagina di testo, diventano un link "chiama" (tel:).
// La parola "WhatsApp" è gestita a parte (è uguale in tutte le lingue).
// Ordine: le più lunghe prima, per il match.
export const FRASI_TELEFONO: Record<Lingua, string[]> = {
  it: ['telefonicamente', 'al telefono', 'per telefono', 'via telefono'],
  en: ['by telephone', 'by phone', 'over the phone', 'on the phone'],
  fr: ['par téléphone', 'au téléphone'],
  de: ['telefonisch', 'per telefon', 'am telefon'],
  es: ['por teléfono', 'al teléfono'],
}

// ---- dizionario dei testi fissi della guida ----
const IT = {
  tornaHome: 'Torna alla home',
  caricamento: 'Caricamento…',
  strutturaNonTrovata: 'Struttura non trovata.',
  sezioneVuota: 'Nessun contenuto ancora inserito qui.',
  paginaVuota: 'Contenuto non ancora inserito per questa pagina.',
  sottotitoloSezione: 'I posti che consigliamo agli ospiti',
  heroBenvenuti: 'Benvenuti in',
  heroSub: 'tutto quello che serve per il tuo soggiorno',
  azMappa: 'Mappa',
  azChiama: 'Chiama',
  tabHome: 'Home',
  navigazione: 'Navigazione',
  lingua: 'Lingua',
  gennarinoSottotitolo: 'Il concierge di %s',
  gennarinoHint: 'Chiedimi pure qualcosa su %s: spiagge, ristoranti, regole della casa…',
  gennarinoScrivendo: 'Gennarino sta scrivendo…',
  gennarinoPlaceholder: 'Scrivi qui…',
  gennarinoInvia: 'Invia',
  gennarinoErrore: 'Non sono riuscito a rispondere, riprova tra poco.',
} as const

type ChiaveTesto = keyof typeof IT

export const T: Record<Lingua, Record<ChiaveTesto, string>> = {
  it: IT,
  en: {
    tornaHome: 'Back to home',
    caricamento: 'Loading…',
    strutturaNonTrovata: 'Property not found.',
    sezioneVuota: 'Nothing has been added here yet.',
    paginaVuota: 'No content has been added to this page yet.',
    sottotitoloSezione: 'The places we recommend to our guests',
    heroBenvenuti: 'Welcome to',
    heroSub: 'everything you need for your stay',
    azMappa: 'Map',
    azChiama: 'Call',
    tabHome: 'Home',
    navigazione: 'Navigation',
    lingua: 'Language',
    gennarinoSottotitolo: "%s's concierge",
    gennarinoHint: 'Ask me anything about %s: beaches, restaurants, house rules…',
    gennarinoScrivendo: 'Gennarino is typing…',
    gennarinoPlaceholder: 'Type here…',
    gennarinoInvia: 'Send',
    gennarinoErrore: "I couldn't reply, please try again shortly.",
  },
  fr: {
    tornaHome: "Retour à l'accueil",
    caricamento: 'Chargement…',
    strutturaNonTrovata: 'Logement introuvable.',
    sezioneVuota: 'Aucun contenu ajouté ici pour le moment.',
    paginaVuota: "Aucun contenu n'a encore été ajouté à cette page.",
    sottotitoloSezione: 'Les adresses que nous conseillons à nos hôtes',
    heroBenvenuti: 'Bienvenue à',
    heroSub: "tout ce qu'il vous faut pour votre séjour",
    azMappa: 'Carte',
    azChiama: 'Appeler',
    tabHome: 'Accueil',
    navigazione: 'Navigation',
    lingua: 'Langue',
    gennarinoSottotitolo: 'Le concierge de %s',
    gennarinoHint: 'Posez-moi vos questions sur %s : plages, restaurants, règlement intérieur…',
    gennarinoScrivendo: 'Gennarino écrit…',
    gennarinoPlaceholder: 'Écrivez ici…',
    gennarinoInvia: 'Envoyer',
    gennarinoErrore: "Je n'ai pas pu répondre, réessayez dans un instant.",
  },
  de: {
    tornaHome: 'Zurück zur Startseite',
    caricamento: 'Wird geladen…',
    strutturaNonTrovata: 'Unterkunft nicht gefunden.',
    sezioneVuota: 'Hier wurde noch nichts eingetragen.',
    paginaVuota: 'Für diese Seite wurde noch kein Inhalt hinterlegt.',
    sottotitoloSezione: 'Unsere Empfehlungen für Gäste',
    heroBenvenuti: 'Willkommen in',
    heroSub: 'alles, was Sie für Ihren Aufenthalt brauchen',
    azMappa: 'Karte',
    azChiama: 'Anrufen',
    tabHome: 'Start',
    navigazione: 'Navigation',
    lingua: 'Sprache',
    gennarinoSottotitolo: 'Der Concierge von %s',
    gennarinoHint: 'Fragen Sie mich alles über %s: Strände, Restaurants, Hausordnung…',
    gennarinoScrivendo: 'Gennarino schreibt…',
    gennarinoPlaceholder: 'Hier schreiben…',
    gennarinoInvia: 'Senden',
    gennarinoErrore: 'Ich konnte nicht antworten, bitte versuchen Sie es gleich noch einmal.',
  },
  es: {
    tornaHome: 'Volver al inicio',
    caricamento: 'Cargando…',
    strutturaNonTrovata: 'Alojamiento no encontrado.',
    sezioneVuota: 'Aún no se ha añadido contenido aquí.',
    paginaVuota: 'Todavía no se ha añadido contenido a esta página.',
    sottotitoloSezione: 'Los lugares que recomendamos a nuestros huéspedes',
    heroBenvenuti: 'Bienvenidos a',
    heroSub: 'todo lo que necesitas para tu estancia',
    azMappa: 'Mapa',
    azChiama: 'Llamar',
    tabHome: 'Inicio',
    navigazione: 'Navegación',
    lingua: 'Idioma',
    gennarinoSottotitolo: 'El conserje de %s',
    gennarinoHint: 'Pregúntame lo que quieras sobre %s: playas, restaurantes, normas de la casa…',
    gennarinoScrivendo: 'Gennarino está escribiendo…',
    gennarinoPlaceholder: 'Escribe aquí…',
    gennarinoInvia: 'Enviar',
    gennarinoErrore: 'No he podido responder, inténtalo de nuevo en un momento.',
  },
}
