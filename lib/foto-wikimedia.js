// Foto automatiche dei luoghi da Wikipedia/Wikimedia Commons.
//
// Principio guida: una foto SBAGLIATA è peggio di nessuna foto. Quindi si accetta una
// foto solo se (1) la voce di Wikipedia ha lo stesso nome del luogo, (2) le sue
// coordinate sono davvero vicine alla struttura (evita le omonimie: "San Salvatore"
// ce ne sono cento in Italia) e (3) la foto è su Commons con licenza libera, che
// permette di conservarla — cosa che le foto di Google NON permettono.
// Ristoranti, negozi e locali piccoli non hanno una voce: restano senza foto.
import { distanzaGeograficaKm } from './proposte-scout.js'

export const USER_AGENT = 'Haplyhost/1.0 (https://haplyhost.vercel.app; guida digitale per case vacanze)'

// Oltre questa distanza dalla struttura una voce non è "il luogo di cui parliamo".
// Ampia apposta: le gite arrivano a 150 km (Pompei, Costiera Amalfitana).
export const DISTANZA_MASSIMA_KM = 150

const PAROLE_VUOTE = new Set([
  'di', 'del', 'della', 'dello', 'dei', 'degli', 'delle', 'dell', 'da', 'in', 'a', 'al', 'alla', 'e', 'ed',
  'il', 'lo', 'la', 'i', 'gli', 'le', 'l', 'un', 'una',
])
// Parole che descrivono il TIPO di posto, non quale posto: da sole non identificano nulla.
const PAROLE_GENERICHE = new Set([
  'bar', 'ristorante', 'pizzeria', 'trattoria', 'osteria', 'lido', 'spiaggia', 'spiagge', 'hotel',
  'museo', 'parco', 'centro', 'supermercato', 'farmacia', 'tabacchi', 'distributore', 'stazione',
  'servizio', 'taxi', 'noleggio', 'escursioni', 'sentiero',
])

export function normalizza(testo) {
  return String(testo || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function parole(testo) {
  return normalizza(testo).split(' ').filter((p) => p && !PAROLE_VUOTE.has(p))
}

// Il titolo di una voce può avere la disambiguazione tra parentesi: "Castellabate (Italia)".
function senzaParentesi(titolo) {
  return String(titolo || '').replace(/\s*\([^)]*\)\s*/g, ' ').trim()
}

// Confronto tra il nome del luogo e il titolo della voce.
//  'esatto'  = stessi termini (dopo aver tolto articoli e punteggiatura)
//  'incluso' = tutte le parole di uno stanno nell'altro (es. "Museo Archeologico di
//              Paestum" dentro "Museo archeologico nazionale di Paestum")
//  null      = non corrisponde
// Un nome fatto solo di parole generiche ("Bar Museo", "Tabacchi") non corrisponde mai.
export function confrontaNomi(nomeLuogo, titolo) {
  const a = parole(nomeLuogo)
  const b = parole(senzaParentesi(titolo))
  if (!a.length || !b.length) return null
  if (a.every((p) => PAROLE_GENERICHE.has(p)) || b.every((p) => PAROLE_GENERICHE.has(p))) return null
  if (a.join(' ') === b.join(' ')) return 'esatto'
  const inA = new Set(a)
  const inB = new Set(b)
  const aInB = a.every((p) => inB.has(p))
  const bInA = b.every((p) => inA.has(p))
  if (aInB || bInA) return 'incluso'
  return null
}

// Sceglie, tra le voci trovate da una ricerca, quella che è davvero il luogo.
// `voci` = [{ titolo, immagine, lat, lng }], `struttura` = { lat, lng }.
// Le coordinate della voce sono OBBLIGATORIE: un nome uguale non basta. Caso reale
// (Villa Virginia): "Il Granato", un posto di Paestum, coincide col nome della voce
// "Granato" (il frutto) — che non ha coordinate — e avrebbe preso la foto di un melograno.
// Meglio perdere qualche luogo vero senza coordinate su Wikipedia che sbagliare foto.
export function scegliVoce(nomeLuogo, voci, struttura) {
  if (typeof struttura?.lat !== 'number' || typeof struttura?.lng !== 'number') return null
  for (const v of voci) {
    if (!v.immagine) continue
    if (!confrontaNomi(nomeLuogo, v.titolo)) continue
    if (typeof v.lat !== 'number' || typeof v.lng !== 'number') continue
    const km = distanzaGeograficaKm(struttura.lat, struttura.lng, v.lat, v.lng)
    if (km > DISTANZA_MASSIMA_KM) continue
    return v
  }
  return null
}

const LICENZE_LIBERE = /^(cc[ -]by|cc0|public domain|pd|attribution|copyrighted free use)/i

// Dalla risposta di Commons (imageinfo) ricava url, autore e licenza — o null se la
// foto non è libera, non è un JPEG (loghi, stemmi, cartine sono SVG/PNG) o mancano i dati.
export function informazioniFoto(pagina) {
  const info = pagina?.imageinfo?.[0]
  if (!info) return null
  if (info.mime !== 'image/jpeg') return null
  const meta = info.extmetadata || {}
  const licenza = String(meta.LicenseShortName?.value || '').trim()
  if (!licenza || !LICENZE_LIBERE.test(licenza)) return null
  const url = info.thumburl || info.url
  if (!url) return null
  const autore = String(meta.Artist?.value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return {
    url,
    credito: [autore || 'Wikimedia Commons', licenza].join(' · ').slice(0, 300),
    paginaUrl: info.descriptionurl || null,
  }
}

async function json(url, fetchFn) {
  const risposta = await fetchFn(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' } })
  if (!risposta.ok) throw new Error(`Wikimedia HTTP ${risposta.status}`)
  return risposta.json()
}

// Cerca su Wikipedia italiana le voci con quel nome, con immagine e coordinate.
export async function cercaVoci(termine, fetchFn = fetch) {
  const url =
    'https://it.wikipedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      format: 'json',
      generator: 'search',
      gsrsearch: termine,
      gsrlimit: '6',
      gsrnamespace: '0',
      prop: 'pageimages|coordinates',
      piprop: 'name',
      colimit: '6',
    })
  const dati = await json(url, fetchFn)
  const pagine = Object.values(dati?.query?.pages || {})
  return pagine
    .sort((x, y) => (x.index ?? 0) - (y.index ?? 0))
    .map((p) => ({
      titolo: p.title,
      immagine: p.pageimage || null,
      lat: p.coordinates?.[0]?.lat,
      lng: p.coordinates?.[0]?.lon,
    }))
}

export async function infoDaCommons(nomeFile, fetchFn = fetch) {
  const url =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      format: 'json',
      titles: `File:${nomeFile}`,
      prop: 'imageinfo',
      iiprop: 'url|mime|extmetadata',
      iiurlwidth: '1200',
    })
  const dati = await json(url, fetchFn)
  const pagina = Object.values(dati?.query?.pages || {})[0]
  return informazioniFoto(pagina)
}

// Ricerca completa per un luogo. Ritorna { url, credito, paginaUrl, voce } o null.
// Prova prima il nome da solo, poi con la città (aiuta i nomi ambigui).
export async function cercaFotoLuogo({ nome, citta, struttura }, fetchFn = fetch) {
  const termini = [nome, citta ? `${nome} ${citta}` : null].filter(Boolean)
  for (const termine of termini) {
    const voci = await cercaVoci(termine, fetchFn)
    const voce = scegliVoce(nome, voci, struttura)
    if (!voce) continue
    const foto = await infoDaCommons(voce.immagine, fetchFn)
    if (foto) return { ...foto, voce: voce.titolo }
  }
  return null
}
