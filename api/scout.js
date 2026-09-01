import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// INTERRUTTORE: false = tutte le ricerche bloccate (l'endpoint torna 503 senza chiamare
// nessuna AI). Deve restare uguale anche in src/admin/GestisciSezione.tsx.
const RICERCHE_ATTIVE = true

// MOTORE: 'gemini' (Google Maps grounding, in uso) | 'claude' (ricerca web, fallback spento).
const MOTORE_SCOUT = 'gemini'

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
async function cercaConGemini({ struttura, categoria, daEscludere }) {
  const haCoord = struttura?.lat != null && struttura?.lng != null
  const tool = haCoord
    ? { type: 'google_maps', latitude: Number(struttura.lat), longitude: Number(struttura.lng) }
    : { type: 'google_maps' }

  const prompt = `Trova fino a 5 ${categoria} reali ed esistenti vicino a questo indirizzo: ${struttura?.indirizzo}, ${struttura?.citta}. Devono esistere davvero, non inventare nulla.
${daEscludere.length ? `NON includere questi, già presenti nell'elenco: ${daEscludere.join(', ')}.` : ''}
Per ciascun posto: nome esatto, una descrizione IN ITALIANO (massimo 200 caratteri, tono caldo per un ospite di casa vacanze), la distanza approssimativa in auto o a piedi da quell'indirizzo, la fascia di prezzo a persona SEMPRE in euro (es. "15-25 €"), la valutazione media Google (es. "4,5"), un link a Google Maps, un numero di telefono.
Rispondi SOLO con un array JSON valido, niente testo prima o dopo:
[{"nome":"","descrizione":"","distanza":"","prezzo":"","voto":"","maps":"","telefono":""}]`

  const risposta = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      model: 'gemini-3.1-flash-lite',
      input: prompt,
      tools: [tool],
    }),
  })

  const dati = await risposta.json()
  if (!risposta.ok || dati?.error) {
    throw new Error('Gemini: ' + (dati?.error?.message || `HTTP ${risposta.status}`))
  }

  const testo = dati.output_text
    || dati.steps?.find(s => s.type === 'model_output')?.content?.[0]?.text
    || ''

  const candidati = estraiArrayJson(testo)
  if (!candidati) {
    console.error('Scout/Gemini: nessun JSON valido:', testo.slice(0, 500))
    throw new Error('La ricerca non ha prodotto risultati leggibili, riprova')
  }

  return candidati.filter(c => c && c.nome).map(c => {
    const extra = [c.prezzo, c.voto ? `voto ${c.voto}` : ''].filter(Boolean).join(' · ')
    return {
      nome: c.nome,
      descrizione: [c.descrizione || '', extra].filter(Boolean).join(' · '),
      distanza: c.distanza || '',
      maps: c.maps || '',
      telefono: c.telefono || '',
    }
  })
}

// ---- MOTORE CLAUDE: ricerca web (fallback, oggi non selezionato) ----
async function cercaConClaude({ struttura, categoria, daEscludere }) {
  const prompt = `Cerca online fino a 5 ${categoria} reali ed esistenti vicino a questo indirizzo: ${struttura?.indirizzo}, ${struttura?.citta}.

Non includere questi, già presenti nell'elenco: ${daEscludere.join(', ') || 'nessuno'}.

Per ciascun posto scrivi: nome, una breve descrizione in italiano (massimo 200 caratteri, tono amichevole), la distanza approssimativa dall'indirizzo indicato (es. "10 min in auto" o "5 min a piedi"), un link a Google Maps se lo trovi, un numero di telefono se lo trovi.

Rispondi SOLO con un JSON valido, senza testo prima o dopo, in questo formato esatto:
[{"nome": "...", "descrizione": "...", "distanza": "...", "maps": "...", "telefono": "..."}]`

  const messages = [{ role: 'user', content: prompt }]

  async function chiamaClaude(msgs) {
    const risposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
        messages: msgs,
      }),
    })
    const dati = await risposta.json()
    if (!risposta.ok || dati?.type === 'error') {
      throw new Error('Anthropic: ' + (dati?.error?.message || `HTTP ${risposta.status}`))
    }
    return dati
  }

  let dati = await chiamaClaude(messages)
  let continua = 0
  while (dati.stop_reason === 'pause_turn' && continua < 3) {
    messages.push({ role: 'assistant', content: dati.content })
    dati = await chiamaClaude(messages)
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

  return candidati.filter(c => c && c.nome).map(c => ({
    nome: c.nome,
    descrizione: c.descrizione || '',
    distanza: c.distanza || '',
    maps: c.maps || '',
    telefono: c.telefono || '',
  }))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' })
  }

  if (!RICERCHE_ATTIVE) {
    return res.status(503).json({ error: 'Le ricerche online sono temporaneamente disattivate.' })
  }

  const { struttura_id, sezione } = req.body
  if (!struttura_id || !sezione) {
    return res.status(400).json({ error: 'Dati mancanti' })
  }

  const { data: struttura } = await supabase
    .from('strutture')
    .select('nome, indirizzo, citta, lat, lng')
    .eq('id', struttura_id)
    .single()

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

  const categoria = CATEGORIE[sezione] || sezione

  try {
    const cerca = MOTORE_SCOUT === 'claude' ? cercaConClaude : cercaConGemini
    const trovate = await cerca({ struttura, categoria, daEscludere })

    const righe = trovate.map(c => ({
      struttura_id,
      sezione,
      nome: c.nome,
      descrizione: c.descrizione,
      distanza: c.distanza,
      maps: c.maps,
      telefono: c.telefono,
    }))

    if (righe.length > 0) {
      await supabase.from('proposte').insert(righe)
    }

    return res.status(200).json({ trovati: righe.length })
  } catch (err) {
    console.error('Scout error:', err)
    return res.status(500).json({ error: err.message || 'Errore nella ricerca' })
  }
}
