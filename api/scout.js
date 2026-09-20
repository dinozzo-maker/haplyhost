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

// Le risposte dei fornitori possono contenere messaggi tecnici, URL e dettagli del
// piano API. Restano nei log Vercel; nel pannello mostriamo solo indicazioni utili.
function errorePubblicoScout(err) {
  const dettaglio = String(err?.message || '').toLowerCase()
  if (dettaglio.includes('quota') || dettaglio.includes('rate limit') || dettaglio.includes('resource_exhausted')) {
    return {
      stato: 429,
      messaggio: 'Le ricerche automatiche hanno raggiunto il limite disponibile. Riprova più tardi: i luoghi già presenti non vengono modificati.',
    }
  }
  if (dettaglio.includes('timeout') || dettaglio.includes('timed out') || err?.name === 'TimeoutError') {
    return { stato: 504, messaggio: 'La ricerca sta impiegando troppo tempo. Riprova tra poco.' }
  }
  return { stato: 500, messaggio: 'La ricerca non è riuscita. Riprova tra poco.' }
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
    throw new Error('Gemini: ' + dettaglio)
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
  return normalizzaConDistanze(candidati, citazioniGemini(dati), struttura, daEscludere, raggioKm)
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
      const query = new URLSearchParams({ text: `${indirizzo}, ${struttura.citta || ''}`, limit: '1', filter: 'countrycode:it', apiKey: chiave })
      const risposta = await fetch(`https://api.geoapify.com/v1/geocode/search?${query}`, { signal: AbortSignal.timeout(3500) })
      const dati = await risposta.json().catch(() => null)
      const proprieta = dati?.features?.[0]?.properties
      const lat = Number(proprieta?.lat)
      const lng = Number(proprieta?.lon)
      const risultatoGenerico = ['country', 'state', 'county', 'city', 'postcode'].includes(proprieta?.result_type)
      if (!risposta.ok || proprieta?.country_code !== 'it' || risultatoGenerico || !Number.isFinite(lat) || !Number.isFinite(lng)) return candidato
      const km = Math.round(distanzaGeograficaKm(latStruttura, lngStruttura, lat, lng) * 10) / 10
      const urlMappa = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`
      return {
        ...candidato,
        distanza_km: km,
        distanza: candidato.distanza || `Circa ${String(km).replace('.', ',')} km`,
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
      throw new Error('Anthropic: ' + (dati?.error?.message || `HTTP ${risposta.status}`))
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
      tools: [{ type: 'openrouter:web_search', parameters: { engine: 'exa', mode: 'auto', max_results: 6, max_total_results: 12, max_uses: 3 } }],
      max_tool_calls: 3,
      temperature: 0.1,
    }),
  })
  const dati = await risposta.json().catch(() => null)
  if (!risposta.ok || dati?.error) throw new Error('OpenRouter: ' + (dati?.error?.message || `HTTP ${risposta.status}`))
  const testo = dati?.choices?.[0]?.message?.content || ''
  const candidati = estraiArrayJson(testo)
  if (!candidati) throw new Error('OpenRouter: la ricerca non ha prodotto risultati leggibili')
  await registraConsumoAI({ struttura_id: struttura.id, servizio: 'scout', operazione: 'ricerca luoghi',
    fornitore: 'openrouter', modello: MODELLO_OPENROUTER, durata_ms: Date.now() - iniziata,
    utilizzo: usoOpenAICompatibile(dati) })
  return normalizzaConDistanze(candidati, citazioniOpenRouter(dati), struttura, daEscludere, raggioKm)
}

const schemaPropostaExa = {
  type: 'object', additionalProperties: false, required: ['proposte'],
  properties: { proposte: { type: 'array', maxItems: 5, items: {
    type: 'object', additionalProperties: false,
    required: ['nome', 'indirizzo', 'descrizione', 'distanza_km', 'distanza', 'prezzo', 'voto', 'maps', 'telefono', 'fonti', 'non_verificato', 'contraddizioni', 'domanda_host'],
    properties: {
      nome: { type: 'string' }, indirizzo: { type: 'string' }, descrizione: { type: 'string' },
      distanza_km: { type: ['number', 'null'] }, distanza: { type: 'string' }, prezzo: { type: 'string' },
      voto: { type: 'string' }, maps: { type: 'string' }, telefono: { type: 'string' },
      fonti: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['url', 'titolo', 'conferma', 'campi'], properties: {
          url: { type: 'string' }, titolo: { type: 'string' }, conferma: { type: 'string' },
          campi: { type: 'array', items: { type: 'string' } },
        } } },
      non_verificato: { type: 'array', items: { type: 'string' } },
      contraddizioni: { type: 'array', items: { type: 'string' } }, domanda_host: { type: 'string' },
    },
  } } },
}

async function cercaConExa({ struttura, categoria, daEscludere, raggioKm }) {
  const iniziata = Date.now()
  const risposta = await fetch('https://api.exa.ai/answer', {
    method: 'POST', signal: AbortSignal.timeout(8000),
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.EXA_API_KEY },
    body: JSON.stringify({
      query: promptScout({ struttura, categoria, daEscludere, raggioKm }) + '\nInserisci il risultato nel campo proposte.',
      model: 'exa', stream: false, text: false, userLocation: 'IT', outputSchema: schemaPropostaExa,
      systemPrompt: 'Usa fonti recenti e verificabili. Preferisci siti ufficiali. Non inventare dati o URL.',
    }),
  })
  const dati = await risposta.json().catch(() => null)
  if (!risposta.ok || dati?.error) throw new Error('Exa: ' + (dati?.error || dati?.tag || `HTTP ${risposta.status}`))
  const candidati = dati?.answer?.proposte
  if (!Array.isArray(candidati)) throw new Error('Exa: la ricerca non ha prodotto risultati leggibili')
  await registraConsumoAI({ struttura_id: struttura.id, servizio: 'scout', operazione: 'ricerca luoghi',
    fornitore: 'exa', modello: 'exa-answer', durata_ms: Date.now() - iniziata })
  return normalizzaConDistanze(candidati, (dati.citations || []).map((c) => c.url), struttura, daEscludere, raggioKm)
}

async function cercaConFallback(parametri) {
  const motori = [
    { disponibile: process.env.GEMINI_API_KEY, fornitore: 'google', modello: MODELLO_GEMINI, cerca: cercaConGemini },
    { disponibile: process.env.ANTHROPIC_API_KEY, fornitore: 'anthropic', modello: MODELLO_ANTHROPIC, cerca: cercaConClaude },
    { disponibile: process.env.OPENROUTER_API_KEY, fornitore: 'openrouter', modello: MODELLO_OPENROUTER, cerca: cercaConOpenRouter },
    { disponibile: process.env.EXA_API_KEY, fornitore: 'exa', modello: 'exa-answer', cerca: cercaConExa },
  ].filter((m) => m.disponibile)
  if (!motori.length) throw new Error('Nessun fornitore AI configurato')

  let ultimoErrore = null
  let almenoUnaRicercaValida = false
  for (const motore of motori) {
    try {
      const proposte = await motore.cerca(parametri)
      if (proposte.length > 0) return proposte
      almenoUnaRicercaValida = true
      ultimoErrore = new Error(`${motore.fornitore}: nessuna proposta verificabile`)
      console.info(`Scout/${motore.fornitore}: nessuna proposta verificabile, provo il successivo`)
    } catch (errore) {
      ultimoErrore = errore
      console.warn(`Scout/${motore.fornitore}: passo al fornitore successivo:`, errore?.message)
      await registraConsumoAI({ struttura_id: parametri.struttura.id, servizio: 'scout', operazione: 'ricerca luoghi',
        fornitore: motore.fornitore, modello: motore.modello, esito: 'errore', errore_tipo: tipoErroreAI(errore) })
    }
  }
  if (almenoUnaRicercaValida) return []
  throw ultimoErrore || new Error('Nessuna proposta verificabile')
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
    const trovate = await cercaConFallback({ struttura, categoria, daEscludere, raggioKm })

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
