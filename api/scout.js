import { createClient } from '@supabase/supabase-js'
import { promptScout, normalizzaProposte, citazioniGemini, citazioniClaude, distanzaGeograficaKm } from '../lib/proposte-scout.js'
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

// Ultimo livello di ricerca, senza modello generativo: Geoapify restituisce punti
// d'interesse OpenStreetMap già localizzati. Le descrizioni restano volutamente
// essenziali e riportano solo categoria e posizione presenti nella scheda.
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
  return normalizzaConDistanze(aggiungiFontiMaps(candidati, dati), citazioniGemini(dati), struttura, daEscludere, raggioKm)
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
  let continua = 0
  while (dati.stop_reason === 'pause_turn' && continua < 1) {
    messages.push({ role: 'assistant', content: dati.content })
    dati = await chiamaClaude(messages)
    citazioni.push(...citazioniClaude(dati))
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

  return normalizzaConDistanze(candidati, citazioni, struttura, daEscludere, raggioKm)
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
  return normalizzaConDistanze(candidati, citazioniOpenRouter(dati), struttura, daEscludere, raggioKm)
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
  const strada = [proprieta?.street, proprieta?.housenumber].filter(Boolean).join(' ').trim()
  const specialita = sezione === 'mangiare'
    ? SPECIALITA_GEOAPIFY.find(([chiave]) => categorie.some((categoria) => categoria.includes(chiave)))?.[1]
    : ''
  const parti = [`${tipo}${localita ? ` a ${localita}` : ''}`]
  if (specialita && !(tipo === 'Pizzeria' && specialita === 'pizza')
    && !tipo.toLocaleLowerCase('it').includes(specialita)) parti[0] += ` con ${specialita}`
  if (strada) parti.push(`Si trova in ${strada}`)
  const descrizione = parti.join('. ') + '.'
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

async function descrizioneConExa(candidato, strutturaId) {
  if (!process.env.EXA_API_KEY) return null
  const iniziata = Date.now()
  try {
    const risposta = await fetch('https://api.exa.ai/answer', {
      method: 'POST', signal: AbortSignal.timeout(12000),
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.EXA_API_KEY },
      body: JSON.stringify({
        query: `Verifica questa attività esatta: "${candidato.nome}", ${candidato.indirizzo}. Scrivi in italiano una descrizione accogliente e utile, massimo 200 caratteri. Includi solo caratteristiche confermate dalle fonti. Non inserire orari, prezzi, distanze, giudizi, parcheggio, accessibilità o servizi non verificati.`,
        model: 'exa', stream: false, text: false, userLocation: 'IT',
        outputSchema: {
          type: 'object', additionalProperties: false, required: ['descrizione'],
          properties: { descrizione: { type: 'string', maxLength: 200 } },
        },
        systemPrompt: 'Identifica la sede tramite nome e indirizzo. Preferisci sito e profili ufficiali. Non inventare dettagli.',
      }),
    })
    const dati = await risposta.json().catch(() => null)
    if (!risposta.ok || dati?.error) return null
    let contenuto = dati?.answer
    if (typeof contenuto === 'string') {
      try { contenuto = JSON.parse(contenuto) } catch { contenuto = { descrizione: contenuto } }
    }
    const descrizione = String(contenuto?.descrizione || '').replace(/[*#]/g, '').trim()
    const fonti = (Array.isArray(dati?.citations) ? dati.citations : []).flatMap((fonte) => {
      const url = String(fonte?.url || '').trim()
      if (!url || !/^https?:\/\//i.test(url)) return []
      return [{
        url, titolo: String(fonte?.title || 'Fonte web').slice(0, 200),
        conferma: 'Fonte usata per verificare le caratteristiche riportate nella descrizione.',
        campi: ['nome', 'descrizione'],
      }]
    }).slice(0, 3)
    if (!descrizione || [...descrizione].length > 200 || fonti.length === 0) return null
    await registraConsumoAI({ struttura_id: strutturaId, servizio: 'scout', operazione: 'descrizione luogo',
      fornitore: 'exa', modello: 'exa-answer', durata_ms: Date.now() - iniziata })
    return { descrizione, fonti }
  } catch {
    return null
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

  const candidati = await Promise.all(candidatiBase.map(async (candidato) => {
    const [proprieta, descrizioneWeb] = await Promise.all([
      dettagliGeoapify(candidato._placeId, candidato._proprieta),
      descrizioneConExa(candidato, struttura.id),
    ])
    const descrizioneBase = descrizioneGeoapify(proprieta, sezione)
    return {
      ...candidato,
      descrizione: descrizioneWeb?.descrizione || descrizioneBase,
      fonti: descrizioneWeb?.fonti?.length
        ? [...candidato.fonti.map((fonte) => ({ ...fonte, campi: fonte.campi.filter((campo) => campo !== 'descrizione') })), ...descrizioneWeb.fonti]
        : candidato.fonti,
    }
  }))

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
