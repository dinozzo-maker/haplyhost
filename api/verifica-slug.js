import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Endpoint pubblico e VOLUTAMENTE minimo: dice solo se uno slug esiste in `strutture`,
// niente altro. Serve a Struttura.tsx per distinguere "guida non ancora pubblica"
// (attivo=false, la RLS pubblica non la fa vedere) da "slug sbagliato" — senza esporre
// nome/indirizzo/telefono/ecc. di una struttura che l'host non ha ancora pubblicato.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non permesso' })
  }

  const slug = String(req.query.slug || '').trim()
  if (!slug) {
    return res.status(400).json({ error: 'Slug mancante' })
  }

  const { data } = await supabase.from('strutture').select('id').eq('slug', slug).maybeSingle()
  return res.status(200).json({ esiste: !!data })
}
