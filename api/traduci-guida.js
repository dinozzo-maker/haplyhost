import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Traduce con Claude Haiku i campi indicati dall'italiano a en/fr/de/es.
// `campi` = { chiave: testo, ... }. Ritorna { en: {...}, fr: {...}, de: {...}, es: {...} } o null.
async function traduci(campi, contesto) {
  const chiavi = Object.keys(campi).filter((k) => campi[k])
  if (!chiavi.length) return null

  const prompt = `Traduci i seguenti campi di ${contesto} dall'italiano verso: inglese (en), francese (fr), tedesco (de), spagnolo (es).
Regole:
- Traduci fedelmente, mantieni il tono e la lunghezza simili all'originale.
- NON tradurre i nomi propri di persone, locali, strade o località.
- Mantieni eventuali emoji dove sono nell'originale.
- Non aggiungere né togliere informazioni.

Campi (italiano):
${JSON.stringify(campi, null, 2)}

Rispondi SOLO con un JSON valido, senza testo prima o dopo, con esattamente queste 4 chiavi di lingua e, dentro ognuna, le stesse chiavi dei campi qui sopra:
{"en": {${chiavi.map((k) => `"${k}": "..."`).join(', ')}}, "fr": {…}, "de": {…}, "es": {…}}`

  const risposta = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const dati = await risposta.json()
  if (!risposta.ok || dati?.type === 'error') {
    throw new Error('Anthropic: ' + (dati?.error?.message || `HTTP ${risposta.status}`))
  }

  const testo = (dati?.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
    .replace(/```json|```/g, '')
    .trim()

  try {
    return JSON.parse(testo)
  } catch {
    console.error('traduci-guida: JSON non valido:', testo.slice(0, 300))
    return null
  }
}

// Esegue `fn` su tutti gli elementi, a lotti di `dim` in parallelo (per stare nei tempi Vercel).
async function aLotti(items, dim, fn) {
  for (let i = 0; i < items.length; i += dim) {
    await Promise.all(items.slice(i, i + dim).map(fn))
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' })
  }

  const { struttura_id, access_token } = req.body
  if (!struttura_id || !access_token) {
    return res.status(400).json({ error: 'Dati mancanti' })
  }

  const { data: userData, error: erroreUtente } = await supabase.auth.getUser(access_token)
  if (erroreUtente || !userData?.user) {
    return res.status(401).json({ error: 'Sessione non valida, rifai il login' })
  }

  const { data: struttura, error: erroreStruttura } = await supabase
    .from('strutture')
    .select('id, owner_user_id')
    .eq('id', struttura_id)
    .single()

  if (erroreStruttura || !struttura) {
    return res.status(404).json({ error: 'Struttura non trovata' })
  }
  if (struttura.owner_user_id !== userData.user.id) {
    return res.status(403).json({ error: 'Non sei il proprietario di questa struttura' })
  }

  try {
    // Pagine di testo: si (ri)traducono tutte.
    const { data: pagine } = await supabase
      .from('pagine')
      .select('id, titolo, contenuto')
      .eq('struttura_id', struttura_id)

    let nPagine = 0
    await aLotti(pagine || [], 4, async (p) => {
      const trad = await traduci(
        { titolo: p.titolo, contenuto: p.contenuto },
        'una pagina informativa della guida per gli ospiti di una casa vacanze'
      )
      if (trad) {
        await supabase.from('pagine').update({ traduzioni: trad }).eq('id', p.id)
        nPagine += 1
      }
    })

    // Luoghi: solo quelli senza traduzioni.
    const { data: luoghi } = await supabase
      .from('luoghi')
      .select('id, descrizione, categoria, distanza, traduzioni')
      .eq('struttura_id', struttura_id)

    const daFare = (luoghi || []).filter(
      (l) => !l.traduzioni || Object.keys(l.traduzioni).length === 0
    )

    let nLuoghi = 0
    await aLotti(daFare, 4, async (l) => {
      const campi = {}
      if (l.descrizione) campi.descrizione = l.descrizione
      if (l.categoria) campi.categoria = l.categoria
      if (l.distanza) campi.distanza = l.distanza
      const trad = await traduci(campi, 'una scheda di un luogo consigliato agli ospiti')
      if (trad) {
        await supabase.from('luoghi').update({ traduzioni: trad }).eq('id', l.id)
        nLuoghi += 1
      }
    })

    return res.status(200).json({ pagine: nPagine, luoghi: nLuoghi })
  } catch (err) {
    console.error('traduci-guida:', err)
    return res.status(500).json({ error: err.message || 'Errore nella traduzione' })
  }
}
