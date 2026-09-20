import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function verificaSuperadmin(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer /i, '')
  if (!token) return false
  const { data, error } = await supabase.auth.getUser(token)
  const emailAdmin = (process.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase()
  return !error && !!emailAdmin && data?.user?.email?.toLowerCase() === emailAdmin
}

function giornoRoma(data = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(data)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo non permesso' })
  if (!(await verificaSuperadmin(req))) return res.status(403).json({ error: 'Sezione riservata al superadmin' })

  const dal = new Date(Date.now() - 89 * 86400000).toISOString()
  const righe = []
  for (let da = 0; da < 50000; da += 1000) {
    const { data, error } = await supabase.from('consumi_ai')
      .select('servizio,operazione,fornitore,modello,esito,errore_tipo,token_input,token_output,token_ragionamento,token_cache,token_strumenti,token_totali,durata_ms,creato_il')
      .gte('creato_il', dal).order('creato_il', { ascending: false }).range(da, da + 999)
    if (error) {
      console.error('consumi-ai:', error)
      return res.status(error.code === '42P01' ? 503 : 500).json({ error: error.code === '42P01' ? 'Registro consumi non ancora attivato.' : 'Non riesco a leggere i consumi.' })
    }
    righe.push(...(data || []))
    if (!data || data.length < 1000) break
  }

  const oggi = giornoRoma()
  const sette = giornoRoma(new Date(Date.now() - 6 * 86400000))
  const trenta = giornoRoma(new Date(Date.now() - 29 * 86400000))
  const somma = (lista) => lista.reduce((a, r) => ({
    chiamate: a.chiamate + 1, errori: a.errori + (r.esito === 'errore' ? 1 : 0),
    token_input: a.token_input + Number(r.token_input || 0), token_output: a.token_output + Number(r.token_output || 0),
    token_strumenti: a.token_strumenti + Number(r.token_strumenti || 0), token_totali: a.token_totali + Number(r.token_totali || 0),
  }), { chiamate: 0, errori: 0, token_input: 0, token_output: 0, token_strumenti: 0, token_totali: 0 })
  const perServizio = new Map()
  for (const r of righe) {
    const chiave = `${r.servizio}|${r.fornitore}|${r.modello}`
    if (!perServizio.has(chiave)) perServizio.set(chiave, [])
    perServizio.get(chiave).push(r)
  }
  return res.status(200).json({
    generato_il: new Date().toISOString(),
    periodi: {
      oggi: somma(righe.filter(r => giornoRoma(new Date(r.creato_il)) === oggi)),
      sette_giorni: somma(righe.filter(r => giornoRoma(new Date(r.creato_il)) >= sette)),
      trenta_giorni: somma(righe.filter(r => giornoRoma(new Date(r.creato_il)) >= trenta)),
    },
    servizi: [...perServizio.entries()].map(([chiave, lista]) => {
      const [servizio, fornitore, modello] = chiave.split('|')
      return { servizio, fornitore, modello, ...somma(lista) }
    }).sort((a, b) => b.token_totali - a.token_totali),
    errori_recenti: righe.filter(r => r.esito === 'errore').slice(0, 20).map(r => ({
      servizio: r.servizio, fornitore: r.fornitore, modello: r.modello,
      tipo: r.errore_tipo || 'fornitore', creato_il: r.creato_il,
    })),
    disponibilita: null,
    nota_disponibilita: 'Google e Anthropic non forniscono qui un saldo residuo unico e affidabile. I limiti ufficiali restano nei rispettivi pannelli del fornitore.',
  })
}

