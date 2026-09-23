import { createClient } from '@supabase/supabase-js'
import { statoSoggiorno, tokenValido } from '../lib/soggiorni.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Endpoint PUBBLICI in sola lettura per la guida ospiti, riuniti in UNA funzione perché il
// piano Vercel Hobby ammette al massimo 12 funzioni per deploy (23/09/2026: con la 13ª il
// deploy falliva). Si sceglie con ?azione=:
//   ?azione=verifica-slug&slug=...  → { esiste }
//   ?azione=wifi&slug=...&s=<token> → reti Wi-Fi, solo nei giorni del soggiorno
//   ?azione=soggiorno&slug=...&s=<token> → nome e date del soggiorno, per il benvenuto in home
// Prima erano api/verifica-slug.js e api/wifi.js: stessa logica, stesse risposte.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non permesso' })
  }
  const azione = String(req.query.azione || '')
  if (azione === 'verifica-slug') return verificaSlug(req, res)
  if (azione === 'wifi') return wifi(req, res)
  if (azione === 'soggiorno') return benvenuto(req, res)
  return res.status(400).json({ error: 'Azione non valida' })
}

// VOLUTAMENTE minimo: dice solo se uno slug esiste in `strutture`, niente altro. Serve a
// Struttura.tsx per distinguere "guida non ancora pubblica" (attivo=false, la RLS pubblica
// non la fa vedere) da "slug sbagliato" — senza esporre nome/indirizzo/telefono/ecc. di una
// struttura che l'host non ha ancora pubblicato.
async function verificaSlug(req, res) {
  const slug = String(req.query.slug || '').trim()
  if (!slug) {
    return res.status(400).json({ error: 'Slug mancante' })
  }

  const { data } = await supabase.from('strutture').select('id').eq('slug', slug).maybeSingle()
  return res.status(200).json({ esiste: !!data })
}

// Cerca il soggiorno a cui appartiene il token, solo se la guida è pubblicata. Ritorna
// { struttura, soggiorno } oppure null (token/slug sbagliati, guida in bozza: come per
// Gennarino, non si serve niente finché l'host non pubblica). Tutte le azioni "con token"
// passano da qui, così le regole d'accesso stanno in un posto solo.
async function trovaSoggiorno(req, colonne) {
  const slug = String(req.query.slug || '').trim()
  const token = String(req.query.s || '').trim()
  if (!slug || !tokenValido(token)) return null

  const { data: struttura } = await supabase
    .from('strutture')
    .select('id, attivo')
    .eq('slug', slug)
    .maybeSingle()
  if (!struttura || !struttura.attivo) return null

  const { data: soggiorno } = await supabase
    .from('soggiorni')
    .select(colonne)
    .eq('struttura_id', struttura.id)
    .eq('token', token)
    .maybeSingle()
  if (!soggiorno) return null
  return { struttura, soggiorno }
}

// Benvenuto in home: nome (scritto dall'host per riconoscere il soggiorno, ora mostrato
// all'ospite) e date. Solo con un token valido; mai dati di altri soggiorni.
async function benvenuto(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const trovato = await trovaSoggiorno(req, 'nome, checkin, checkout')
  if (!trovato) return res.status(404).json({ stato: 'non_valido' })
  const { nome, checkin, checkout } = trovato.soggiorno
  return res.status(200).json({ stato: statoSoggiorno(checkin, checkout), nome, checkin, checkout })
}

// Protetto dal token del soggiorno. È l'unico punto da cui una password Wi-Fi arriva a un
// ospite (strutture_segreti non ha nessuna lettura pubblica). La password esce SOLO se il
// token esiste per quella struttura E oggi (fuso italiano) è tra il check-in e il check-out
// del soggiorno. Prima del check-in o dopo il check-out la risposta non contiene nessuna rete.
async function wifi(req, res) {
  // Mai in cache: la stessa URL deve dare risposte diverse nei giorni diversi.
  res.setHeader('Cache-Control', 'no-store')

  const trovato = await trovaSoggiorno(req, 'checkin, checkout')
  if (!trovato) return res.status(404).json({ stato: 'non_valido' })
  const { struttura, soggiorno } = trovato

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
