import { createClient } from '@supabase/supabase-js'
import { promptScout, normalizzaProposte, citazioniGemini, citazioniClaude } from '../lib/proposte-scout.js'
import { registraConsumoAI, tipoErroreAI, usoAnthropic, usoGeminiInteractions } from '../lib/consumi-ai.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// INTERRUTTORE: false = tutte le ricerche bloccate (l'endpoint torna 503 senza chiamare
// nessuna AI). Deve restare uguale anche in src/admin/GestisciSezione.tsx.
const RICERCHE_ATTIVE = true

// MOTORE: 'gemini' (Google Maps grounding, in uso) | 'claude' (ricerca web, fallback spento).
const MOTORE_SCOUT = 'gemini'

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
    signal: AbortSignal.timeout(45000),
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      model: 'gemini-3.1-flash-lite',
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
    fornitore: 'google', modello: 'gemini-3.1-flash-lite', durata_ms: Date.now() - iniziata,
    utilizzo: usoGeminiInteractions(dati) })
  return normalizzaProposte(candidati, citazioniGemini(dati), daEscludere, raggioKm)
}

// ---- MOTORE CLAUDE: ricerca web (fallback, oggi non selezionato) ----
async function cercaConClaude({ struttura, categoria, daEscludere, raggioKm }) {
  const prompt = promptScout({ struttura, categoria, daEscludere, raggioKm })

  const messages = [{ role: 'user', content: prompt }]

  async function chiamaClaude(msgs) {
    const iniziata = Date.now()
    const risposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
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
      fornitore: 'anthropic', modello: 'claude-haiku-4-5-20251001', durata_ms: Date.now() - iniziata,
      utilizzo: usoAnthropic(dati) })
    return dati
  }

  let dati = await chiamaClaude(messages)
  const citazioni = [...citazioniClaude(dati)]
  let continua = 0
  while (dati.stop_reason === 'pause_turn' && continua < 3) {
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

  return normalizzaProposte(candidati, citazioni, daEscludere, raggioKm)
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
    const cerca = MOTORE_SCOUT === 'claude' ? cercaConClaude : cercaConGemini
    const trovate = await cerca({ struttura, categoria, daEscludere, raggioKm })

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
    await registraConsumoAI({ struttura_id, servizio: 'scout', operazione: 'ricerca luoghi',
      fornitore: MOTORE_SCOUT === 'claude' ? 'anthropic' : 'google',
      modello: MOTORE_SCOUT === 'claude' ? 'claude-haiku-4-5-20251001' : 'gemini-3.1-flash-lite',
      esito: 'errore', errore_tipo: tipoErroreAI(err) })
    const pubblico = errorePubblicoScout(err)
    return res.status(pubblico.stato).json({ error: pubblico.messaggio })
  }
}
