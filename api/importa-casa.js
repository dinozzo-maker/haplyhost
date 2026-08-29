import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function generaSlugBase(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40) || 'struttura'
}

async function trovaSlugLibero(base) {
  let slug = base
  let contatore = 1
  while (true) {
    const { data } = await supabase.from('strutture').select('id').eq('slug', slug).maybeSingle()
    if (!data) return slug
    contatore += 1
    slug = `${base}${contatore}`
  }
}

function pulisciHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' })
  }

  const { nome, indirizzo, link, access_token } = req.body
  if (!nome || !indirizzo || !access_token) {
    return res.status(400).json({ error: 'Dati mancanti' })
  }

  const { data: userData, error: erroreUtente } = await supabase.auth.getUser(access_token)
  if (erroreUtente || !userData?.user) {
    return res.status(401).json({ error: 'Sessione non valida, rifai il login' })
  }
  const userId = userData.user.id

  const { data: esistente } = await supabase
    .from('strutture')
    .select('id')
    .eq('owner_user_id', userId)
    .maybeSingle()
  if (esistente) {
    return res.status(400).json({ error: 'Hai già una struttura registrata su questo account' })
  }

  let testoPagina = ''
  if (link) {
    try {
      const pagina = await fetch(link, { headers: { 'user-agent': 'Mozilla/5.0' } })
      const html = await pagina.text()
      testoPagina = pulisciHtml(html)
    } catch (err) {
      console.error('Errore lettura link:', err)
    }
  }

  let descrizione = ''
  try {
    const prompt = testoPagina
      ? `Scrivi una descrizione accogliente in italiano (massimo 500 caratteri) per una casa vacanze chiamata "${nome}", a ${indirizzo}. Usa queste informazioni trovate online, se utili:\n\n${testoPagina}\n\nSe le informazioni non bastano, scrivi una descrizione generica ma onesta basata solo sul nome e l'indirizzo. Rispondi SOLO con il testo della descrizione, niente altro.`
      : `Scrivi una breve descrizione accogliente in italiano (massimo 500 caratteri) per una casa vacanze chiamata "${nome}", a ${indirizzo}. Rispondi SOLO con il testo della descrizione, niente altro.`

    const risposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const dati = await risposta.json()
    descrizione = (dati?.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
  } catch (err) {
    console.error('Errore Claude:', err)
  }

  const slug = await trovaSlugLibero(generaSlugBase(nome))

  const { data: nuovaStruttura, error: erroreCreazione } = await supabase
    .from('strutture')
    .insert({ slug, nome, indirizzo, owner_user_id: userId, descrizione_casa: descrizione })
    .select('id, slug, nome')
    .single()

  if (erroreCreazione) {
    console.error(erroreCreazione)
    return res.status(500).json({ error: 'Errore nella creazione della struttura' })
  }

  return res.status(200).json({ struttura: nuovaStruttura })
}