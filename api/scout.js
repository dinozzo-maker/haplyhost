import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const CATEGORIE = {
  spiagge: 'spiagge e lidi',
  mangiare: 'ristoranti, pizzerie e trattorie',
  vicinanze: 'supermercati, farmacie e negozi utili',
  visitare: 'luoghi da visitare e attrazioni turistiche',
  divertimento: 'attività e divertimento (parchi, sport, noleggi)',
  gite: 'gite ed escursioni di mezza giornata o giornata intera',
  trasporti: 'servizi di trasporto (bus, taxi, noleggio auto/bici)',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' })
  }

  const { struttura_id, sezione } = req.body
  if (!struttura_id || !sezione) {
    return res.status(400).json({ error: 'Dati mancanti' })
  }

  const { data: struttura } = await supabase
    .from('strutture')
    .select('nome, indirizzo, citta')
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
        model: 'claude-sonnet-5',
        max_tokens: 8000,
        tools: [{ type: 'web_search_20260209', name: 'web_search' }],
        messages: msgs,
      }),
    })
    const dati = await risposta.json()
    if (!risposta.ok || dati?.type === 'error') {
      throw new Error('Anthropic: ' + (dati?.error?.message || `HTTP ${risposta.status}`))
    }
    return dati
  }

  try {
    let dati = await chiamaClaude(messages)

    // Con la ricerca web il modello può fermarsi in "pause_turn" dopo 10 ricerche:
    // si rimanda indietro la conversazione e riprende da solo.
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

    // Estrae il primo array JSON dal testo, anche se il modello ci mette frasi attorno.
    const inizio = testo.indexOf('[')
    const fine = testo.lastIndexOf(']')
    if (inizio === -1 || fine <= inizio) {
      console.error('Nessun JSON nella risposta Scout:', testo.slice(0, 500))
      return res.status(500).json({ error: 'La ricerca non ha prodotto risultati, riprova' })
    }

    let candidati = []
    try {
      candidati = JSON.parse(testo.slice(inizio, fine + 1))
    } catch {
      console.error('JSON non valido da Scout:', testo.slice(0, 500))
      return res.status(500).json({ error: 'La risposta non era in formato valido, riprova' })
    }

    const righe = (candidati || [])
      .filter(c => c && c.nome)
      .map(c => ({
        struttura_id,
        sezione,
        nome: c.nome,
        descrizione: c.descrizione || '',
        distanza: c.distanza || '',
        maps: c.maps || '',
        telefono: c.telefono || '',
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