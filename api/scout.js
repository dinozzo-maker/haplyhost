import { createClient } from '@supabase/supabase-js'
import { promptScout, normalizzaProposte, citazioniGemini, citazioniClaude, distanzaGeograficaKm, chiaveUrl, verificaNomiProposte, nomePresenteNellaFonte } from '../lib/proposte-scout.js'
import { registraConsumoAI, tipoErroreAI, usoAnthropic, usoGeminiInteractions, usoOpenAICompatibile } from '../lib/consumi-ai.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// INTERRUTTORE: false = tutte le ricerche bloccate (l'endpoint torna 503 senza chiamare
// nessuna AI). Deve restare uguale anche in src/admin/GestisciSezione.tsx.
const RICERCHE_ATTIVE = true

const MODELLO_GEMINI = 'gemini-3.1-flash-lite'
const MODELLO_ANTHROPIC = 'claude-haiku-4-5-20251001'
const MODELLO_OPENROUTER = 'qwen/qwen3.8-27b:free'

// Opzioni offerte in src/admin/GestisciSezione.tsx — tenere allineate. Qualsiasi altro
// valore arrivi dal body viene ignorato e si usa il default (5 km).
const RAGGI_KM = [1, 5, 15, 30, 150]
const RAGGIO_DEFAULT_KM = 5
const HEADER_GEOAPIFY = { origin: 'https://haplyhost.vercel.app', referer: 'https://haplyhost.vercel.app/' }

function erroreFornitore(nome, risposta, dati) {
  const erroreDati = dati?.error
  const codiceGrezzo = erroreDati?.type || erroreDati?.code || dati?.tag || `HTTP_${risposta.status}`
  const codice = String(codiceGrezzo).replace(/[^a-z0-9_-]+/gi, '_').slice(0, 80)
  const messaggio = typeof erroreDati === 'string'
    ? erroreDati
    : (erroreDati?.message || dati?.message || `HTTP ${risposta.status}`)
  const errore = new Error(`${nome}: HTTP ${risposta.status}; ${codice}; ${String(messaggio).slice(0, 300)}`)
  errore.codice = codice
  errore.httpStatus = risposta.status
  return errore
}

function erroreScout(codice, messaggio) {
  const errore = new Error(messaggio)
  errore.codice = codice
  return errore
}

async function assicuraCoordinateStruttura(struttura) {
  const lat = Number(struttura?.lat)
  const lng = Number(struttura?.lng)
  if (struttura?.lat != null && struttura?.lng != null && Number.isFinite(lat) && Number.isFinite(lng)) return struttura

  const chiave = process.env.VITE_GEOAPIFY_API_KEY?.trim()
  if (!chiave) throw erroreScout('geoapify_config', 'Geoapify: chiave non configurata sul server')

  const indirizzo = [struttura?.indirizzo, struttura?.citta].filter(Boolean).join(', ')
  const query = new URLSearchParams({ text: indirizzo, limit: '1', filter: 'countrycode:it', lang: 'it', apiKey: chiave })
  const risposta = await fetch(`https://api.geoapify.com/v1/geocode/search?${query}`, {
    signal: AbortSignal.timeout(5000), headers: HEADER_GEOAPIFY,
  })
  const dati = await risposta.json().catch(() => null)
  if (!risposta.ok) throw erroreFornitore('Geoapify', risposta, dati || {})

  const proprieta = dati?.features?.[0]?.properties
  const latTrovata = Number(proprieta?.lat)
  const lngTrovata = Number(proprieta?.lon)
  const troppoGenerico = ['country', 'state', 'county', 'city', 'postcode'].includes(proprieta?.result_type)
  if (!Number.isFinite(latTrovata) || !Number.isFinite(lngTrovata) || troppoGenerico) {
    throw erroreScout('indirizzo_struttura', 'Geoapify: indirizzo della struttura non localizzato con precisione')
  }

  const aggiornata = { ...struttura, lat: latTrovata, lng: lngTrovata }
  const { error } = await supabase.from('strutture').update({ lat: latTrovata, lng: lngTrovata }).eq('id', struttura.id)
  if (error) console.warn('Scout: coordinate struttura trovate ma non salvate:', error.message)
  return aggiornata
}

// Le risposte dei fornitori possono contenere messaggi tecnici, URL e dettagli del
// piano API. Restano nei log Vercel; nel pannello mostriamo solo indicazioni utili.
function errorePubblicoScout(err) {
  const dettaglio = String(err?.message || '').toLowerCase()
  const nomi = { google: 'Gemini', anthropic: 'Anthropic', openrouter: 'OpenRouter', exa: 'Exa', geoapify: 'Geoapify' }
  const esiti = Array.isArray(err?.tentativi) && err.tentativi.length
    ? ' Dettaglio: ' + err.tentativi.map((t) => `${nomi[t.fornitore] || t.fornitore}: ${t.esito}`).join('; ') + '.'
    : ''
  if (err?.codice === 'geoapify_config') {
    return { stato: 503, messaggio: 'Manca la configurazione Geoapify necessaria per calcolare le distanze. Controlla la variabile VITE_GEOAPIFY_API_KEY su Vercel.' }
  }
  if (err?.codice === 'indirizzo_struttura') {
    return { stato: 422, messaggio: 'Non riesco a localizzare con precisione l’indirizzo della struttura. Apri Dati della casa, scegli l’indirizzo dai suggerimenti e salva, poi riprova.' }
  }
  if (dettaglio.includes('quota') || dettaglio.includes('rate limit') || dettaglio.includes('resource_exhausted')) {
    return {
      stato: 429,
      messaggio: 'Le ricerche automatiche hanno raggiunto il limite disponibile. Riprova più tardi: i luoghi già presenti non vengono modificati.' + esiti,
    }
  }
  if (dettaglio.includes('timeout') || dettaglio.includes('timed out') || err?.name === 'TimeoutError') {
    return { stato: 504, messaggio: 'La ricerca sta impiegando troppo tempo. Riprova tra poco.' + esiti }
  }
  return { stato: 500, messaggio: 'La ricerca non è riuscita. Riprova tra poco.' + esiti }
}

const CATEGORIE = {
  spiagge: 'spiagge e lidi',
  mangiare: 'ristoranti, pizzerie e trattorie',
  vicinanze: 'supermercati, farmacie e negozi utili',
  visitare: 'luoghi da visitare e attrazioni turistiche',
  divertimento: 'attività e divertimento (parchi, sport, noleggi)',
  gite: 'gite ed escursioni di mezza giornata o giornata intera',
  trasporti: 'servizi di trasporto (bus, taxi, noleggio auto/bici)',
}

// Ultimo livello di ricerca: Geoapify trova punti d'interesse già localizzati;
// Exa prova poi ad arricchirne le descrizioni con fonti web verificabili.
const CATEGORIE_GEOAPIFY = {
  spiagge: 'beach',
  mangiare: 'catering.restaurant,catering.fast_food.pizza',
  vicinanze: 'commercial.supermarket,commercial.convenience,healthcare.pharmacy',
  visitare: 'tourism.attraction,tourism.sights,heritage,entertainment.museum',
  divertimento: 'entertainment,activity.sport_club,sport,leisure',
  gite: 'tourism.attraction,tourism.sights,leisure.park.nature_reserve',
  trasporti: 'public_transport,rental,service.taxi',
}

// Estrae il primo array JSON da un testo, anche se il modello ci mette frasi attorno.
function estraiArrayJson(testo) {
  const inizio = testo.indexOf('[')
  const fine = testo.lastIndexOf(']')
  if (inizio === -1 || fine <= inizio) return null
  try {
    return JSON.parse(testo.slice(inizio, fine + 1))
  } catch {
    return null
  }
}

// ---- MOTORE GEMINI: Google Maps grounding (Interactions API) ----
async function cercaConGemini({ struttura, categoria, daEscludere, raggioKm }) {
  const iniziata = Date.now()
  const haCoord = struttura?.lat != null && struttura?.lng != null
  const tool = haCoord
    ? { type: 'google_maps', latitude: Number(struttura.lat), longitude: Number(struttura.lng) }
    : { type: 'google_maps' }

  const prompt = promptScout({ struttura, categoria, daEscludere, raggioKm })

  const risposta = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      model: MODELLO_GEMINI,
      input: prompt,
      tools: [tool, { type: 'google_search' }],
    }),
  })

  const grezzo = await risposta.json().catch(() => null)
  // L'API Gemini restituisce gli errori dentro un array: [{"error":{...}}].
  const dati = Array.isArray(grezzo) ? (grezzo[0] || {}) : (grezzo || {})
  if (!risposta.ok || dati.error) {
    const dettaglio = dati.error?.message || JSON.stringify(grezzo)?.slice(0, 300) || `HTTP ${risposta.status}`
    const errore = erroreFornitore('Gemini', risposta, dati)
    errore.message += `; ${dettaglio}`
    throw errore
  }

  const testo = dati.output_text
    || dati.steps?.filter(s => s.type === 'model_output').flatMap(s => s.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n')
    || ''

  const candidati = estraiArrayJson(testo)
  if (!candidati) {
    console.error('Scout/Gemini: nessun JSON valido:', testo.slice(0, 500))
    throw new Error('La ricerca non ha prodotto risultati leggibili, riprova')
  }

  await registraConsumoAI({ struttura_id: struttura.id, servizio: 'scout', operazione: 'ricerca luoghi',
    fornitore: 'google', modello: MODELLO_GEMINI, durata_ms: Date.now() - iniziata,
    utilizzo: usoGeminiInteractions(dati) })
  const fontiNomi = annotazioniGemini(dati).map(fonte => ({
    url: fonte.url, nome: fonte.name, titolo: fonte.title,
  }))
  const verificati = verificaNomiProposte(aggiungiFontiMaps(candidati, dati), fontiNomi)
  return normalizzaConDistanze(verificati, citazioniGemini(dati), struttura, daEscludere, raggioKm)
}

function annotazioniGemini(dati) {
  return (dati.steps || []).filter((s) => s.type === 'model_output')
    .flatMap((s) => s.content || []).flatMap((c) => c.annotations || [])
}

function aggiungiFontiMaps(candidati, dati) {
  const normalizzaNome = (valore) => String(valore || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('it').replace(/[^a-z0-9]+/g, ' ').trim()
  const luoghi = annotazioniGemini(dati).filter((a) => a.type === 'place_citation' && a.url && a.name)
  return (Array.isArray(candidati) ? candidati : []).map((candidato) => {
    const nome = normalizzaNome(candidato?.nome)
    const fonte = luoghi.find((luogo) => {
      const nomeFonte = normalizzaNome(luogo.name)
      return nome && nomeFonte && (nome.includes(nomeFonte) || nomeFonte.includes(nome))
    })
    if (!fonte) return candidato
    return {
      ...candidato,
      maps: candidato.maps || fonte.url,
      fonti: [...(Array.isArray(candidato.fonti) ? candidato.fonti : []), {
        url: fonte.url,
        titolo: fonte.name,
        conferma: 'Google Maps identifica questa attività e attribuisce a questo luogo le informazioni usate nella proposta.',
        campi: ['nome', 'descrizione', 'maps'],
      }],
    }
  })
}

async function normalizzaConDistanze(candidati, citazioni, struttura, daEscludere, raggioKm) {
  const chiave = process.env.VITE_GEOAPIFY_API_KEY
  const latStruttura = Number(struttura?.lat)
  const lngStruttura = Number(struttura?.lng)
  if (!chiave || struttura?.lat == null || struttura?.lng == null || !Number.isFinite(latStruttura) || !Number.isFinite(lngStruttura)) {
    throw new Error('Geoapify: coordinate della struttura o chiave non disponibili')
  }

  const arricchiti = await Promise.all((Array.isArray(candidati) ? candidati : []).slice(0, 8).map(async (candidato) => {
    const indirizzo = String(candidato?.indirizzo || '').trim()
    if (!indirizzo) return candidato
    try {
      // L'indirizzo del candidato contiene già il suo comune. Aggiungere qui la
      // città della struttura rende ambigue proprio le mete delle fasce lontane
      // (es. "Agropoli, ..., Capaccio") e porta il geocoder sul luogo sbagliato.
      const filtro = `countrycode:it|circle:${lngStruttura},${latStruttura},${Math.ceil(raggioKm * 1000)}`
      const query = new URLSearchParams({ text: indirizzo, limit: '3', filter: filtro, lang: 'it', apiKey: chiave })
      const risposta = await fetch(`https://api.geoapify.com/v1/geocode/search?${query}`, {
        signal: AbortSignal.timeout(3500), headers: HEADER_GEOAPIFY,
      })
      const dati = await risposta.json().catch(() => null)
      const proprieta = dati?.features?.map((f) => f?.properties).find((p) => {
        const lat = Number(p?.lat)
        const lng = Number(p?.lon)
        const generico = ['country', 'state', 'county', 'city', 'postcode'].includes(p?.result_type)
        return p?.country_code === 'it' && !generico && Number.isFinite(lat) && Number.isFinite(lng)
      })
      const lat = Number(proprieta?.lat)
      const lng = Number(proprieta?.lon)
      if (!risposta.ok || !proprieta || !Number.isFinite(lat) || !Number.isFinite(lng)) return candidato
      const km = Math.round(distanzaGeograficaKm(latStruttura, lngStruttura, lat, lng) * 10) / 10
      const urlMappa = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`
      return {
        ...candidato,
        distanza_km: km,
        distanza: `Circa ${String(km).replace('.', ',')} km`,
        fonti: [...(Array.isArray(candidato.fonti) ? candidato.fonti : []), {
          url: urlMappa,
          titolo: 'Posizione verificata sulla mappa',
          conferma: 'Coordinate dell’indirizzo usate da Haplyhost per calcolare la distanza in linea d’aria.',
          campi: ['distanza_km', 'distanza'],
        }],
        _citazioneDistanza: urlMappa,
      }
    } catch {
      return candidato
    }
  }))

  const citazioniDistanza = arricchiti.map((c) => c?._citazioneDistanza).filter(Boolean)
  return normalizzaProposte(arricchiti, [...citazioni, ...citazioniDistanza], daEscludere, raggioKm)
}

// ---- MOTORE CLAUDE: ricerca web (fallback, oggi non selezionato) ----
async function cercaConClaude({ struttura, categoria, daEscludere, raggioKm }) {
  const prompt = promptScout({ struttura, categoria, daEscludere, raggioKm })

  const messages = [{ role: 'user', content: prompt }]

  async function chiamaClaude(msgs) {
    const iniziata = Date.now()
    const risposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELLO_ANTHROPIC,
        max_tokens: 6000,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
        messages: msgs,
      }),
    })
    const dati = await risposta.json()
    if (!risposta.ok || dati?.type === 'error') {
      throw erroreFornitore('Anthropic', risposta, dati)
    }
    await registraConsumoAI({ struttura_id: struttura.id, servizio: 'scout', operazione: 'ricerca luoghi',
      fornitore: 'anthropic', modello: MODELLO_ANTHROPIC, durata_ms: Date.now() - iniziata,
      utilizzo: usoAnthropic(dati) })
    return dati
  }

  let dati = await chiamaClaude(messages)
  const citazioni = [...citazioniClaude(dati)]
  const estraiFontiNomi = risposta => (risposta.content || []).filter(b => b.type === 'text')
    .flatMap(b => b.citations || []).map(fonte => ({ url: fonte.url, titolo: fonte.title, testo: fonte.cited_text }))
  const fontiNomi = estraiFontiNomi(dati)
  let continua = 0
  while (dati.stop_reason === 'pause_turn' && continua < 1) {
    messages.push({ role: 'assistant', content: dati.content })
    dati = await chiamaClaude(messages)
    citazioni.push(...citazioniClaude(dati))
    fontiNomi.push(...estraiFontiNomi(dati))
    continua += 1
  }

  const testo = (dati?.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim()

  const candidati = estraiArrayJson(testo)
  if (!candidati) {
    console.error('Scout/Claude: nessun JSON valido:', testo.slice(0, 500))
    throw new Error('La ricerca non ha prodotto risultati leggibili, riprova')
  }

  return normalizzaConDistanze(verificaNomiProposte(candidati, fontiNomi), citazioni, struttura, daEscludere, raggioKm)
}

function citazioniOpenRouter(dati) {
  const annotazioni = dati?.choices?.[0]?.message?.annotations || []
  return annotazioni.flatMap((a) => {
    const url = a?.url || a?.url_citation?.url
    return url ? [url] : []
  })
}

// OpenRouter usa Qwen gratuito per la sintesi e il proprio strumento server-side
// di ricerca. È un fornitore separato da Gemini e Anthropic.
async function cercaConOpenRouter({ struttura, categoria, daEscludere, raggioKm }) {
  const iniziata = Date.now()
  const risposta = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(12000),
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://haplyhost.vercel.app',
      'X-Title': 'Haplyhost Scout',
    },
    body: JSON.stringify({
      model: MODELLO_OPENROUTER,
      messages: [{ role: 'user', content: promptScout({ struttura, categoria, daEscludere, raggioKm }) }],
      tools: [{ type: 'openrouter:web_search', parameters: { engine: 'exa', max_results: 6, max_total_results: 12 } }],
      max_tool_calls: 3,
      temperature: 0.1,
    }),
  })
  const dati = await risposta.json().catch(() => null)
  if (!risposta.ok || dati?.error) throw erroreFornitore('OpenRouter', risposta, dati || {})
  const testo = dati?.choices?.[0]?.message?.content || ''
  const candidati = estraiArrayJson(testo)
  if (!candidati) throw new Error('OpenRouter: la ricerca non ha prodotto risultati leggibili')
  await registraConsumoAI({ struttura_id: struttura.id, servizio: 'scout', operazione: 'ricerca luoghi',
    fornitore: 'openrouter', modello: MODELLO_OPENROUTER, durata_ms: Date.now() - iniziata,
    utilizzo: usoOpenAICompatibile(dati) })
  const fontiNomi = (dati?.choices?.[0]?.message?.annotations || []).map(annotazione => {
    const fonte = annotazione.url_citation || annotazione
    return { url: fonte.url, titolo: fonte.title, testo: fonte.content }
  })
  return normalizzaConDistanze(verificaNomiProposte(candidati, fontiNomi), citazioniOpenRouter(dati), struttura, daEscludere, raggioKm)
}

function tipoLuogoGeoapify(categorie, sezione) {
  const ha = (testo) => categorie.some((categoria) => categoria.includes(testo))
  if (sezione === 'mangiare') {
    if (ha('pizza')) return 'Pizzeria'
    if (ha('cafe')) return 'Bar o caffetteria'
    if (ha('pub')) return 'Pub'
    if (ha('fast_food')) return 'Locale di ristorazione veloce'
    return 'Ristorante'
  }
  if (sezione === 'spiagge') return ha('beach_resort') ? 'Stabilimento balneare' : 'Spiaggia'
  if (sezione === 'vicinanze') {
    if (ha('pharmacy')) return 'Farmacia'
    if (ha('supermarket')) return 'Supermercato'
    return 'Negozio di prossimità'
  }
  if (sezione === 'trasporti') {
    if (ha('train')) return 'Stazione ferroviaria'
    if (ha('ferry')) return 'Fermata o terminal dei traghetti'
    if (ha('taxi')) return 'Servizio taxi'
    if (ha('rental')) return 'Servizio di noleggio'
    return 'Fermata o servizio di trasporto pubblico'
  }
  if (ha('museum')) return 'Museo'
  if (ha('archaeological')) return 'Sito archeologico'
  if (ha('nature_reserve')) return 'Area naturale'
  if (ha('sport')) return 'Struttura sportiva'
  if (ha('entertainment')) return 'Luogo per il tempo libero'
  return 'Luogo d’interesse'
}

const SPECIALITA_GEOAPIFY = [
  ['pizza', 'pizza'], ['seafood', 'cucina di pesce'], ['regional', 'cucina regionale'],
  ['mediterranean', 'cucina mediterranea'], ['italian', 'cucina italiana'], ['barbecue', 'specialità alla griglia'],
  ['sushi', 'sushi'], ['japanese', 'cucina giapponese'], ['chinese', 'cucina cinese'],
  ['vegetarian', 'proposte vegetariane'], ['ice_cream', 'gelati'],
]

function descrizioneGeoapify(proprieta, sezione) {
  const categorie = Array.isArray(proprieta?.categories) ? proprieta.categories.map(String) : []
  const tipo = tipoLuogoGeoapify(categorie, sezione)
  const localita = String(proprieta?.city || proprieta?.town || proprieta?.village || proprieta?.suburb || proprieta?.county || '').trim()
  const specialita = sezione === 'mangiare'
    ? SPECIALITA_GEOAPIFY.find(([chiave]) => categorie.some((categoria) => categoria.includes(chiave)))?.[1]
    : ''
  const zona = localita ? ` a ${localita}` : ''
  const caratteristica = specialita && !(tipo === 'Pizzeria' && specialita === 'pizza')
    && !tipo.toLocaleLowerCase('it').includes(specialita) ? ` con ${specialita}` : ''
  const descrizioni = {
    mangiare: `${tipo}${zona}${caratteristica}: una proposta da valutare per organizzare un pranzo o una cena durante il soggiorno.`,
    spiagge: `${tipo}${zona}, da tenere presente per trascorrere una giornata al mare durante il soggiorno.`,
    vicinanze: `${tipo}${zona}, un riferimento pratico per le necessità quotidiane durante il soggiorno.`,
    visitare: `${tipo}${zona}, una possibile tappa da inserire nell’itinerario per conoscere meglio il territorio.`,
    divertimento: `${tipo}${zona}, una possibilità da considerare per dedicare qualche ora al tempo libero.`,
    gite: `${tipo}${zona}, una possibile meta per una gita e per scoprire i dintorni durante il soggiorno.`,
    trasporti: `${tipo}${zona}, utile per valutare gli spostamenti e organizzare gli itinerari durante il soggiorno.`,
  }
  const descrizione = descrizioni[sezione] || `${tipo}${zona}, una possibile tappa da valutare durante il soggiorno.`
  return [...descrizione].slice(0, 200).join('')
}

function urlOpenStreetMap(proprieta, lat, lng) {
  const grezzo = proprieta?.datasource?.raw || {}
  const tipi = { n: 'node', node: 'node', w: 'way', way: 'way', r: 'relation', relation: 'relation' }
  const tipo = tipi[String(grezzo.osm_type || '').toLowerCase()]
  const id = String(grezzo.osm_id || '').replace(/\D/g, '')
  return tipo && id
    ? `https://www.openstreetmap.org/${tipo}/${id}`
    : `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`
}

async function dettagliGeoapify(placeId, proprietaBase) {
  if (!placeId) return proprietaBase
  try {
    const query = new URLSearchParams({ id: placeId, features: 'details', lang: 'it', apiKey: process.env.VITE_GEOAPIFY_API_KEY })
    const risposta = await fetch(`https://api.geoapify.com/v2/place-details?${query}`, {
      signal: AbortSignal.timeout(5000), headers: HEADER_GEOAPIFY,
    })
    const dati = await risposta.json().catch(() => null)
    if (!risposta.ok) return proprietaBase
    const dettagli = dati?.features?.find((feature) => feature?.properties?.feature_type === 'details')?.properties
      || dati?.features?.[0]?.properties
    return dettagli ? { ...proprietaBase, ...dettagli } : proprietaBase
  } catch {
    return proprietaBase
  }
}

async function descrizioniConExa(candidati, strutturaId, sezione) {
  if (!process.env.EXA_API_KEY || candidati.length === 0) return new Map()
  const iniziata = Date.now()
  try {
    const risposta = await fetch('https://api.exa.ai/answer', {
      method: 'POST', signal: AbortSignal.timeout(18000),
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.EXA_API_KEY },
      body: JSON.stringify({
        query: `Verifica esclusivamente queste attività già identificate, senza proporne altre:\n${JSON.stringify(candidati.map((candidato, indice) => ({ indice, nome: candidato.nome, indirizzo: candidato.indirizzo })))}\nPer ognuna scrivi in italiano una descrizione naturale, accogliente e concreta di 130-200 caratteri, nello stile di una guida locale. Apri con ciò che la distingue e aiuta l'ospite a scegliere. Usa soltanto caratteristiche confermate dalle fonti. Se le fonti confermano solo tipo e località, lascia descrizione e fonti vuote. Non citare verifiche, mappe o indirizzi nella descrizione. Non inserire orari, prezzi, distanze, giudizi assoluti, parcheggio, accessibilità o servizi non verificati. Restituisci per ogni descrizione gli URL esatti delle fonti usate. La sezione è ${sezione}.`,
        model: 'exa', stream: false, text: false, userLocation: 'IT',
        outputSchema: {
          type: 'object', additionalProperties: false, required: ['descrizioni'],
          properties: { descrizioni: { type: 'array', maxItems: 5, items: {
            type: 'object', additionalProperties: false, required: ['indice', 'descrizione', 'fonti'],
            properties: {
              indice: { type: 'integer' }, descrizione: { type: 'string', maxLength: 200 },
              fonti: { type: 'array', items: { type: 'string' } },
            },
          } } },
        },
        systemPrompt: 'Identifica ogni sede tramite nome e indirizzo. Preferisci sito ufficiale, menu ufficiale e profili gestiti dall’attività. Scrivi con tono caldo e informativo, senza formule pubblicitarie e senza inventare dettagli.',
      }),
    })
    const dati = await risposta.json().catch(() => null)
    if (!risposta.ok || dati?.error) return new Map()
    let contenuto = dati?.answer
    if (typeof contenuto === 'string') {
      try { contenuto = JSON.parse(contenuto) } catch { contenuto = null }
    }
    const citazioni = (Array.isArray(dati?.citations) ? dati.citations : []).flatMap((fonte) => {
      const url = String(fonte?.url || '').trim()
      if (!url || !/^https?:\/\//i.test(url)) return []
      return [{ url, chiave: chiaveUrl(url), titolo: String(fonte?.title || 'Fonte web').slice(0, 200),
        testo: String(fonte?.text || '') }]
    })
    const citazioniPerUrl = new Map(citazioni.map((fonte) => [fonte.chiave, fonte]))
    const risultati = new Map()
    for (const elemento of Array.isArray(contenuto?.descrizioni) ? contenuto.descrizioni : []) {
      const indice = Number(elemento?.indice)
      const candidato = candidati[indice]
      const descrizione = String(elemento?.descrizione || '').replace(/[*#]/g, '').trim()
      if (!candidato || [...descrizione].length < 80 || [...descrizione].length > 200) continue
      let fonti = (Array.isArray(elemento?.fonti) ? elemento.fonti : [])
        .map((url) => citazioniPerUrl.get(chiaveUrl(url))).filter(Boolean)
      // Una citazione di un altro locale non basta a verificare questa scheda.
      // Nessun confronto approssimativo: Vaillum e Vatillum sono nomi diversi.
      fonti = (fonti.length ? fonti : citazioni)
        .filter(fonte => nomePresenteNellaFonte(candidato.nome, fonte))
      if (fonti.length === 0) continue
      risultati.set(indice, {
        descrizione,
        fonti: fonti.slice(0, 3).map((fonte) => ({
          url: fonte.url, titolo: fonte.titolo,
          conferma: 'Fonte usata per verificare le caratteristiche riportate nella descrizione.',
          campi: ['nome', 'descrizione'],
        })),
      })
    }
    await registraConsumoAI({ struttura_id: strutturaId, servizio: 'scout', operazione: 'descrizione luogo',
      fornitore: 'exa', modello: 'exa-answer', durata_ms: Date.now() - iniziata })
    return risultati
  } catch {
    return new Map()
  }
}

async function cercaConGeoapify({ struttura, sezione, daEscludere, raggioKm }) {
  const categorieRichieste = CATEGORIE_GEOAPIFY[sezione]
  const chiave = process.env.VITE_GEOAPIFY_API_KEY?.trim()
  if (!categorieRichieste || !chiave) return []

  const iniziata = Date.now()
  const latStruttura = Number(struttura.lat)
  const lngStruttura = Number(struttura.lng)
  const filtro = `circle:${lngStruttura},${latStruttura},${Math.ceil(raggioKm * 1000)}`
  // Senza bias di prossimità: nelle fasce 15–30 e 30–150 km non vogliamo che
  // tutte le pagine siano occupate dai luoghi immediatamente vicini.
  const offsets = raggioKm === 1 ? [0] : [0, 100, 200]
  const risposte = await Promise.all(offsets.map(async (offset) => {
    const query = new URLSearchParams({
      categories: categorieRichieste, filter: filtro, limit: '100', offset: String(offset), lang: 'it', apiKey: chiave,
    })
    const risposta = await fetch(`https://api.geoapify.com/v2/places?${query}`, {
      signal: AbortSignal.timeout(6000), headers: HEADER_GEOAPIFY,
    })
    const dati = await risposta.json().catch(() => null)
    if (!risposta.ok) throw erroreFornitore('Geoapify Places', risposta, dati || {})
    return Array.isArray(dati?.features) ? dati.features : []
  }))

  const minimo = ({ 1: 0, 5: 1, 15: 5, 30: 15, 150: 30 })[raggioKm] ?? 0
  const esclusi = new Set(daEscludere.map((nome) => String(nome || '').trim().toLocaleLowerCase('it')))
  const visti = new Set()
  const candidatiBase = risposte.flat().flatMap((feature) => {
    const p = feature?.properties || {}
    const nome = String(p.name || '').trim()
    const lat = Number(p.lat ?? feature?.geometry?.coordinates?.[1])
    const lng = Number(p.lon ?? feature?.geometry?.coordinates?.[0])
    const indirizzo = String(p.formatted || [p.street, p.housenumber, p.city, p.postcode].filter(Boolean).join(', ')).trim()
    const chiaveLuogo = String(p.place_id || `${nome}|${lat}|${lng}`)
    if (!nome || !indirizzo || esclusi.has(nome.toLocaleLowerCase('it')) || visti.has(chiaveLuogo)
      || !Number.isFinite(lat) || !Number.isFinite(lng)) return []
    const km = Math.round(distanzaGeograficaKm(latStruttura, lngStruttura, lat, lng) * 10) / 10
    if (km <= minimo || km > raggioKm) return []
    visti.add(chiaveLuogo)
    const url = urlOpenStreetMap(p, lat, lng)
    const distanza = `Circa ${String(km).replace('.', ',')} km`
    return [{
      nome, indirizzo, descrizione: descrizioneGeoapify(p, sezione),
      distanza_km: km, distanza, prezzo: '', voto: '', maps: url, telefono: '',
      fonti: [{
        url, titolo: 'OpenStreetMap tramite Geoapify',
        conferma: `Conferma nome, categoria, indirizzo e posizione del luogo (${distanza} in linea d’aria dalla struttura).`,
        campi: ['nome', 'descrizione', 'distanza_km', 'distanza', 'maps'],
      }],
      non_verificato: ['Specialità, servizi, prezzi, voto e telefono non verificati.'],
      contraddizioni: [], domanda_host: '', _placeId: String(p.place_id || ''), _proprieta: p,
    }]
  }).sort((a, b) => a.distanza_km - b.distanza_km).slice(0, 5)

  const candidatiDettagliati = await Promise.all(candidatiBase.map(async (candidato) => {
    const proprieta = await dettagliGeoapify(candidato._placeId, candidato._proprieta)
    return { ...candidato, descrizione: descrizioneGeoapify(proprieta, sezione), _proprieta: proprieta }
  }))
  // Una sola richiesta Exa per l'intero gruppo: evita il limite del piano gratuito
  // causato da cinque richieste simultanee e mantiene coerente lo stile.
  const descrizioniWeb = await descrizioniConExa(candidatiDettagliati, struttura.id, sezione)
  const candidati = candidatiDettagliati.map((candidato, indice) => {
    const descrizioneWeb = descrizioniWeb.get(indice)
    return {
      ...candidato,
      descrizione: descrizioneWeb?.descrizione || candidato.descrizione,
      fonti: descrizioneWeb?.fonti?.length
        ? [...candidato.fonti.map((fonte) => ({ ...fonte, campi: fonte.campi.filter((campo) => campo !== 'descrizione') })), ...descrizioneWeb.fonti]
        : candidato.fonti,
    }
  })

  await registraConsumoAI({ struttura_id: struttura.id, servizio: 'scout', operazione: 'ricerca luoghi',
    fornitore: 'geoapify', modello: 'places-v2', durata_ms: Date.now() - iniziata })
  const citazioni = candidati.flatMap((c) => [c.maps, ...c.fonti.map((fonte) => fonte.url)])
  return normalizzaProposte(candidati, citazioni, daEscludere, raggioKm)
}

async function cercaConFallback(parametri) {
  const motori = [
    { disponibile: process.env.GEMINI_API_KEY, fornitore: 'google', modello: MODELLO_GEMINI, cerca: cercaConGemini },
    { disponibile: process.env.ANTHROPIC_API_KEY, fornitore: 'anthropic', modello: MODELLO_ANTHROPIC, cerca: cercaConClaude },
    { disponibile: process.env.OPENROUTER_API_KEY, fornitore: 'openrouter', modello: MODELLO_OPENROUTER, cerca: cercaConOpenRouter },
    { disponibile: process.env.VITE_GEOAPIFY_API_KEY && CATEGORIE_GEOAPIFY[parametri.sezione], fornitore: 'geoapify', modello: 'places-v2', cerca: cercaConGeoapify },
  ].filter((m) => m.disponibile)
  if (!motori.length) throw new Error('Nessun fornitore AI configurato')

  let ultimoErrore = null
  let almenoUnaRicercaValida = false
  const tentativi = []
  for (const motore of motori) {
    try {
      const proposte = await motore.cerca(parametri)
      if (proposte.length > 0) return proposte
      almenoUnaRicercaValida = true
      tentativi.push({ fornitore: motore.fornitore, esito: 'nessun risultato verificabile' })
      ultimoErrore = new Error(`${motore.fornitore}: nessuna proposta verificabile`)
      console.info(`Scout/${motore.fornitore}: nessuna proposta verificabile, provo il successivo`)
    } catch (errore) {
      ultimoErrore = errore
      tentativi.push({ fornitore: motore.fornitore, esito: tipoErroreAI(errore) })
      console.warn(`Scout/${motore.fornitore}: passo al fornitore successivo:`, errore?.message)
      await registraConsumoAI({ struttura_id: parametri.struttura.id, servizio: 'scout', operazione: 'ricerca luoghi',
        fornitore: motore.fornitore, modello: motore.modello, esito: 'errore', errore_tipo: tipoErroreAI(errore) })
    }
  }
  if (almenoUnaRicercaValida) return []
  const erroreFinale = ultimoErrore || new Error('Nessuna proposta verificabile')
  erroreFinale.tentativi = tentativi
  throw erroreFinale
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' })
  }

  if (!RICERCHE_ATTIVE) {
    return res.status(503).json({ error: 'Le ricerche online sono temporaneamente disattivate.' })
  }

  const { struttura_id, sezione, raggio_km } = req.body || {}
  const tokenHeader = (req.headers.authorization || '').replace(/^Bearer /i, '')
  const access_token = tokenHeader || req.body?.access_token
  if (!struttura_id || !sezione || !access_token) {
    return res.status(400).json({ error: 'Dati mancanti' })
  }

  // Scout consuma crediti AI e crea proposte: non pu\u00f2 essere un endpoint pubblico.
  // Verifichiamo sia la sessione sia che l'host possieda proprio la struttura su cui
  // sta cercando. Stesso livello di protezione di aggiorna-casa e traduci-guida.
  const { data: userData, error: erroreUtente } = await supabase.auth.getUser(access_token)
  if (erroreUtente || !userData?.user) {
    return res.status(401).json({ error: 'Sessione non valida, rifai il login' })
  }
  const raggioKm = RAGGI_KM.includes(Number(raggio_km)) ? Number(raggio_km) : RAGGIO_DEFAULT_KM

  const { data: struttura, error: erroreStruttura } = await supabase
    .from('strutture')
    .select('id, nome, indirizzo, citta, lat, lng, owner_user_id')
    .eq('id', struttura_id)
    .single()

  if (erroreStruttura || !struttura) {
    return res.status(404).json({ error: 'Struttura non trovata' })
  }
  if (struttura.owner_user_id !== userData.user.id) {
    return res.status(403).json({ error: 'Non sei il proprietario di questa struttura' })
  }

  const { data: esistenti } = await supabase
    .from('luoghi')
    .select('nome')
    .eq('struttura_id', struttura_id)
    .eq('sezione', sezione)

  const { data: giaProposti } = await supabase
    .from('proposte')
    .select('nome')
    .eq('struttura_id', struttura_id)
    .eq('sezione', sezione)

  const daEscludere = [
    ...(esistenti || []).map(l => l.nome),
    ...(giaProposti || []).map(p => p.nome),
  ]

  // Sezioni di sistema: categoria dalla mappa. Sezioni custom (sezioni_extra): categoria dal DB.
  let categoria = CATEGORIE[sezione]
  if (!categoria) {
    const { data: extra } = await supabase
      .from('sezioni_extra')
      .select('categoria, etichetta')
      .eq('chiave', sezione)
      .maybeSingle()
    categoria = extra?.categoria || extra?.etichetta || sezione
  }

  try {
    // Verifica lo schema prima di consumare crediti di ricerca.
    const { error: erroreSchema } = await supabase.from('proposte').select('verifica').limit(0)
    if (erroreSchema) return res.status(503).json({ error: 'Ricerca con fonti non ancora disponibile. Contatta l’amministratore per completare l’aggiornamento.' })
    // Le strutture create prima dell'autocompletamento possono non avere ancora
    // lat/lng. Le ricaviamo una volta dall'indirizzo e le salviamo: così fasce e
    // meteo funzionano anche per quelle righe storiche.
    const strutturaLocalizzata = await assicuraCoordinateStruttura(struttura)
    const trovate = await cercaConFallback({ struttura: strutturaLocalizzata, sezione, categoria, daEscludere, raggioKm })

    const righe = trovate.map(c => ({
      struttura_id,
      sezione,
      nome: c.nome,
      descrizione: c.descrizione,
      distanza: c.distanza,
      prezzo: c.prezzo || null,
      voto: c.voto || null,
      maps: c.maps,
      telefono: c.telefono,
      verifica: c.verifica,
    }))

    if (righe.length > 0) {
      const { error } = await supabase.from('proposte').insert(righe)
      if (error) throw new Error('Non è stato possibile salvare le proposte. Riprova.')
    }

    return res.status(200).json({ trovati: righe.length, avviso: righe.length ? '' : 'Nessuna nuova proposta con identità, descrizione e fonti sufficienti. Prova un’altra categoria o un raggio diverso.' })
  } catch (err) {
    console.error('Scout error:', err)
    const pubblico = errorePubblicoScout(err)
    return res.status(pubblico.stato).json({ error: pubblico.messaggio })
  }
}
