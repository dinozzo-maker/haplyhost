import { createClient } from '@supabase/supabase-js'
import { generaDescrizioneCasa } from '../lib/genera-descrizione-casa.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function generaSlugBase(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD').replace(/\p{Mn}/gu, '')
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

  const { descrizione, citta } = await generaDescrizioneCasa({ nome, indirizzo, link })

  const slug = await trovaSlugLibero(generaSlugBase(nome))

  const { data: nuovaStruttura, error: erroreCreazione } = await supabase
    .from('strutture')
    .insert({
      slug,
      nome,
      indirizzo,
      citta: citta || null,
      owner_user_id: userId,
      descrizione_casa: descrizione,
      link_riferimento: link || null,
      attivo: true,
    })
    .select('id, slug, nome')
    .single()

  if (erroreCreazione) {
    console.error(erroreCreazione)
    return res.status(500).json({ error: 'Errore nella creazione della struttura' })
  }

  return res.status(200).json({ struttura: nuovaStruttura })
}
