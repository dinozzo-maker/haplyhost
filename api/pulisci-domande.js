import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Chiamata una volta al giorno da Vercel Cron. Non è un endpoint pubblico:
// Vercel invia automaticamente "Authorization: Bearer <CRON_SECRET>".
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo non permesso' })
  const token = req.headers.authorization || ''
  if (!process.env.CRON_SECRET || token !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Non autorizzato' })
  }

  const soglia = new Date()
  soglia.setDate(soglia.getDate() - 90)

  const { error } = await supabase
    .from('domande')
    .delete()
    .lt('creato_il', soglia.toISOString())

  if (error) {
    console.error(error)
    return res.status(500).json({ error: 'Pulizia non riuscita' })
  }
  return res.status(200).json({ ok: true })
}
