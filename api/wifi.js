import { createClient } from '@supabase/supabase-js'
import { statoSoggiorno, tokenValido } from '../lib/soggiorni.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Endpoint PUBBLICO ma protetto dal token del soggiorno: GET ?slug=...&s=<token>.
// È l'unico punto da cui una password Wi-Fi arriva a un ospite (strutture_segreti non
// ha nessuna lettura pubblica). La password esce SOLO se il token esiste per quella
// struttura E oggi (fuso italiano) è tra il check-in e il check-out del soggiorno.
// Prima del check-in o dopo il check-out la risposta non contiene nessuna rete.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non permesso' })
  }
  // Mai in cache: la stessa URL deve dare risposte diverse nei giorni diversi.
  res.setHeader('Cache-Control', 'no-store')

  const slug = String(req.query.slug || '').trim()
  const token = String(req.query.s || '').trim()
  if (!slug || !tokenValido(token)) {
    return res.status(404).json({ stato: 'non_valido' })
  }

  const { data: struttura } = await supabase
    .from('strutture')
    .select('id, attivo')
    .eq('slug', slug)
    .maybeSingle()
  // Guida in bozza: come per Gennarino, non si serve niente finché l'host non pubblica.
  if (!struttura || !struttura.attivo) {
    return res.status(404).json({ stato: 'non_valido' })
  }

  const { data: soggiorno } = await supabase
    .from('soggiorni')
    .select('checkin, checkout')
    .eq('struttura_id', struttura.id)
    .eq('token', token)
    .maybeSingle()
  if (!soggiorno) {
    return res.status(404).json({ stato: 'non_valido' })
  }

  const stato = statoSoggiorno(soggiorno.checkin, soggiorno.checkout)
  if (stato === 'presto') {
    // La data d'arrivo si può dire (l'ospite la conosce già), la password no.
    return res.status(200).json({ stato, checkin: soggiorno.checkin })
  }
  if (stato === 'scaduto') {
    return res.status(200).json({ stato })
  }

  const { data: segreti, error } = await supabase
    .from('strutture_segreti')
    .select('reti_wifi')
    .eq('struttura_id', struttura.id)
    .maybeSingle()
  if (error) {
    console.error('wifi:', error.message)
    return res.status(500).json({ error: 'Errore nel leggere le reti' })
  }

  const reti = Array.isArray(segreti?.reti_wifi) ? segreti.reti_wifi : []
  return res.status(200).json({
    stato,
    checkout: soggiorno.checkout,
    reti: reti.map((r) => ({
      nome: String(r?.nome ?? ''),
      password: String(r?.password ?? ''),
      zona: String(r?.zona ?? ''),
    })),
  })
}
