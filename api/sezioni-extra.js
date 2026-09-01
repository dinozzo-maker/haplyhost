import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Chiavi delle 14 sezioni di sistema — TENERE ALLINEATE con src/sezioni.ts.
const CHIAVI_SISTEMA = [
  'casa', 'piscina', 'spiagge', 'mangiare', 'vicinanze', 'visitare', 'divertimento',
  'gite', 'trasporti', 'differenziata', 'regole', 'emergenze', 'contatti', 'gennarino',
]
// Sotto-rotte del pannello: una sezione non può chiamarsi così o l'URL /admin/<chiave> collide.
const CHIAVI_RISERVATE = ['modifica-casa', 'sezioni-guida', 'invita-host', 'sezioni-extra']

async function superadmin(req) {
  const header = (req.headers.authorization || '').replace(/^Bearer /i, '')
  const token = header || req.body?.access_token
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null
  const adminEmail = (process.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase()
  if (!adminEmail || data.user.email?.toLowerCase() !== adminEmail) return null
  return data.user
}

function slug(testo) {
  return (testo || '')
    .toLowerCase()
    .normalize('NFD').replace(/\p{Mn}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/g, '')
}

export default async function handler(req, res) {
  const admin = await superadmin(req)
  if (!admin) {
    return res.status(403).json({ error: "Sezione riservata all'amministratore della piattaforma" })
  }

  if (req.method === 'POST') {
    const { etichetta, icona, descrizione, tipo, categoria } = req.body || {}
    const etichettaPulita = (etichetta || '').trim()
    if (!etichettaPulita) {
      return res.status(400).json({ error: 'Serve un nome per la sezione' })
    }

    const base = slug(etichettaPulita)
    if (!base || base.length < 2) {
      return res.status(400).json({ error: 'Il nome non produce un identificativo valido, usane un altro' })
    }
    if (CHIAVI_SISTEMA.includes(base) || CHIAVI_RISERVATE.includes(base)) {
      return res.status(400).json({ error: `"${base}" è già usato dal sistema, scegli un nome diverso` })
    }

    // dedup: base, base-2, base-3...
    const { data: esistenti } = await supabase.from('sezioni_extra').select('chiave')
    const prese = new Set((esistenti || []).map((r) => r.chiave))
    let chiave = base
    let n = 2
    while (prese.has(chiave)) {
      chiave = `${base}-${n}`
      n += 1
    }

    const tipoPulito = tipo === 'elenco' ? 'elenco' : 'testo'
    const { error } = await supabase.from('sezioni_extra').insert({
      chiave,
      icona: (icona || '').trim() || '📄',
      etichetta: etichettaPulita,
      descrizione: (descrizione || '').trim() || null,
      tipo: tipoPulito,
      categoria: tipoPulito === 'elenco' ? ((categoria || '').trim() || null) : null,
    })

    if (error) {
      console.error(error)
      return res.status(500).json({ error: 'Errore nel creare la sezione' })
    }
    return res.status(200).json({ chiave })
  }

  if (req.method === 'DELETE') {
    const chiave = (req.body?.chiave || '').trim()
    if (!chiave) {
      return res.status(400).json({ error: 'Chiave mancante' })
    }
    const { error } = await supabase.from('sezioni_extra').delete().eq('chiave', chiave)
    if (error) {
      console.error(error)
      return res.status(500).json({ error: 'Errore nell\'eliminare la sezione' })
    }
    // Le righe pagine/luoghi con questa chiave restano orfane (innocue): se la sezione
    // viene ricreata con la stessa chiave, i contenuti riappaiono.
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Metodo non permesso' })
}
