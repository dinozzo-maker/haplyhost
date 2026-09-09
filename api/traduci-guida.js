import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Traduce con Claude Haiku i campi indicati dall'italiano a en/fr/de/es.
// `campi` = { chiave: testo, ... }. Ritorna { en:{...}, fr:{...}, de:{...}, es:{...} } o null
// se non c'è niente da tradurre. Lancia un errore se la chiamata fallisce, se la
// risposta è troncata, o se il JSON non è valido.
async function traduciUnaVolta(campi, contesto) {
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
{"en": {${chiavi.map((k) => `"${k}": "..."`).join(', ')}}, "fr": {...}, "de": {...}, "es": {...}}`

  const risposta = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      // Haiku 4.5 arriva a 64k di output. Con 4000 (valore di prima) una pagina lunga
      // tradotta in 4 lingue veniva troncata a metà: JSON illeggibile → traduzione persa.
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const dati = await risposta.json()
  if (!risposta.ok || dati?.type === 'error') {
    throw new Error('Anthropic: ' + (dati?.error?.message || `HTTP ${risposta.status}`))
  }
  if (dati?.stop_reason === 'max_tokens') {
    throw new Error('risposta troncata: testo troppo lungo')
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
    throw new Error('json-non-valido: ' + testo.slice(0, 160))
  }
}

// Un secondo tentativo se il primo restituisce un JSON storto (capita di rado con Haiku).
async function traduci(campi, contesto) {
  try {
    return await traduciUnaVolta(campi, contesto)
  } catch (e) {
    if (!String(e.message).startsWith('json-non-valido')) throw e
    console.warn('traduci-guida: JSON storto, riprovo una volta')
    return await traduciUnaVolta(campi, contesto)
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

  // Una riga è "non tradotta" se non ha ancora l'oggetto `traduzioni`.
  const nonTradotta = (r) => !r.traduzioni || Object.keys(r.traduzioni).length === 0

  let nPagine = 0
  let nLuoghi = 0
  let nonRiusciti = 0
  let ripulite = 0 // righe con il flag ma senza testo da tradurre: flag tolto e basta
  let ultimoErrore = ''

  try {
    // --- Pagine di testo ---
    // Si lavora solo ciò che serve: modificato dopo l'ultima traduzione (`da_tradurre`),
    // oppure con del testo mai tradotto. Prima si ritraducevano tutte a ogni giro.
    const { data: pagine } = await supabase
      .from('pagine')
      .select('id, titolo, contenuto, traduzioni, da_tradurre')
      .eq('struttura_id', struttura_id)

    const pagineDaFare = (pagine || []).filter(
      (p) => p.da_tradurre === true || ((p.titolo || p.contenuto) && nonTradotta(p))
    )
    await aLotti(pagineDaFare, 4, async (p) => {
      const campi = {}
      if (p.titolo) campi.titolo = p.titolo
      if (p.contenuto) campi.contenuto = p.contenuto
      // Niente testo da tradurre: se ha il flag, toglilo (altrimenti resta "in sospeso" per sempre).
      if (!Object.keys(campi).length) {
        if (p.da_tradurre) {
          await supabase.from('pagine').update({ da_tradurre: false }).eq('id', p.id)
          ripulite += 1
        }
        return
      }
      try {
        const trad = await traduci(campi, 'una pagina informativa della guida per gli ospiti di una casa vacanze')
        if (trad) {
          await supabase.from('pagine').update({ traduzioni: trad, da_tradurre: false }).eq('id', p.id)
          nPagine += 1
        }
      } catch (e) {
        console.error('traduci-guida pagina', p.id, e.message)
        nonRiusciti += 1
        ultimoErrore = e.message
      }
    })

    // --- Luoghi ---
    const { data: luoghi } = await supabase
      .from('luoghi')
      .select('id, descrizione, categoria, distanza, traduzioni, da_tradurre')
      .eq('struttura_id', struttura_id)

    const luoghiDaFare = (luoghi || []).filter(
      (l) => l.da_tradurre === true || ((l.descrizione || l.categoria || l.distanza) && nonTradotta(l))
    )
    await aLotti(luoghiDaFare, 4, async (l) => {
      const campi = {}
      if (l.descrizione) campi.descrizione = l.descrizione
      if (l.categoria) campi.categoria = l.categoria
      if (l.distanza) campi.distanza = l.distanza
      // Luogo con solo il nome: niente da tradurre, ma il flag va tolto lo stesso.
      if (!Object.keys(campi).length) {
        if (l.da_tradurre) {
          await supabase.from('luoghi').update({ da_tradurre: false }).eq('id', l.id)
          ripulite += 1
        }
        return
      }
      try {
        const trad = await traduci(campi, 'una scheda di un luogo consigliato agli ospiti')
        if (trad) {
          await supabase.from('luoghi').update({ traduzioni: trad, da_tradurre: false }).eq('id', l.id)
          nLuoghi += 1
        }
      } catch (e) {
        console.error('traduci-guida luogo', l.id, e.message)
        nonRiusciti += 1
        ultimoErrore = e.message
      }
    })

    return res.status(200).json({
      pagine: nPagine,
      luoghi: nLuoghi,
      ripulite,
      nonRiusciti,
      errore: nonRiusciti > 0 ? ultimoErrore : undefined,
    })
  } catch (err) {
    console.error('traduci-guida:', err)
    return res.status(500).json({ error: err.message || 'Errore nella traduzione' })
  }
}
