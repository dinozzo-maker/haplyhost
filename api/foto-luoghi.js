import { createClient } from '@supabase/supabase-js'
import { cercaFotoLuogo, USER_AGENT } from '../lib/foto-wikimedia.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// SOLO owner: cerca su Wikipedia/Commons una foto libera per i luoghi che non ne hanno
// una e la copia nel nostro Storage (le licenze CC lo permettono, diversamente da
// Google Places). Nessuna AI, nessun costo. Non tocca MAI una foto già presente
// (caricata a mano o già trovata): lavora solo dove `foto_url` è vuoto.
//
// Va chiamata a giri (un giro = al massimo LOTTO luoghi, per stare nei 60 s di Vercel):
// il frontend ripete finché `rimanenti` è 0, passando in `provati` gli id già tentati
// per non riprovare all'infinito quelli senza foto.
const LOTTO = 8
const CONTEMPORANEI = 4
const PESO_MASSIMO = 6 * 1024 * 1024

async function aLotti(elementi, quanti, lavoro) {
  for (let i = 0; i < elementi.length; i += quanti) {
    await Promise.all(elementi.slice(i, i + quanti).map(lavoro))
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' })
  }

  const { struttura_id, access_token, sezione } = req.body || {}
  const provati = Array.isArray(req.body?.provati) ? req.body.provati.map(String).slice(0, 500) : []
  if (!struttura_id || !access_token) {
    return res.status(400).json({ error: 'Dati mancanti' })
  }

  const { data: utente, error: erroreUtente } = await supabase.auth.getUser(access_token)
  if (erroreUtente || !utente?.user) {
    return res.status(401).json({ error: 'Sessione non valida, rifai il login' })
  }

  const { data: struttura } = await supabase
    .from('strutture')
    .select('id, owner_user_id, citta, lat, lng')
    .eq('id', struttura_id)
    .maybeSingle()
  if (!struttura) return res.status(404).json({ error: 'Struttura non trovata' })
  if (struttura.owner_user_id !== utente.user.id) {
    return res.status(403).json({ error: 'Non sei il proprietario di questa struttura' })
  }
  if (typeof struttura.lat !== 'number' || typeof struttura.lng !== 'number') {
    return res.status(422).json({
      error: 'Mancano le coordinate della struttura: senza, non posso capire quali foto sono davvero vicine. Controlla l\'indirizzo in "Dati della casa".',
    })
  }

  let domanda = supabase
    .from('luoghi')
    .select('id, nome')
    .eq('struttura_id', struttura_id)
    .eq('attivo', true)
    .is('foto_url', null)
  if (sezione) domanda = domanda.eq('sezione', String(sezione))
  const { data: senzaFoto, error: erroreLuoghi } = await domanda
  if (erroreLuoghi) return res.status(500).json({ error: 'Non riesco a leggere i luoghi' })

  const daFare = (senzaFoto || []).filter((l) => !provati.includes(l.id))
  const giro = daFare.slice(0, LOTTO)
  let trovate = 0
  let errori = 0

  await aLotti(giro, CONTEMPORANEI, async (luogo) => {
    try {
      const foto = await cercaFotoLuogo({ nome: luogo.nome, citta: struttura.citta, struttura })
      if (!foto) return

      const scarico = await fetch(foto.url, { headers: { 'user-agent': USER_AGENT } })
      if (!scarico.ok) throw new Error(`download HTTP ${scarico.status}`)
      const byte = Buffer.from(await scarico.arrayBuffer())
      if (byte.length > PESO_MASSIMO) return

      const percorso = `luoghi/${struttura_id}/${luogo.id}-wiki-${Date.now()}.jpg`
      const { error: erroreUpload } = await supabase.storage
        .from('copertine')
        .upload(percorso, byte, { contentType: 'image/jpeg', cacheControl: '31536000' })
      if (erroreUpload) throw new Error(erroreUpload.message)

      const { data: pubblico } = supabase.storage.from('copertine').getPublicUrl(percorso)
      // `.is('foto_url', null)`: se nel frattempo l'host ha caricato una foto a mano, non la sovrascrive.
      const { data: aggiornati, error: erroreAggiorna } = await supabase
        .from('luoghi')
        .update({ foto_url: pubblico.publicUrl, foto_credito: foto.credito, foto_credito_url: foto.paginaUrl })
        .eq('id', luogo.id)
        .is('foto_url', null)
        .select('id')
      if (erroreAggiorna) throw new Error(erroreAggiorna.message)
      if (aggiornati?.length) trovate += 1
      else await supabase.storage.from('copertine').remove([percorso])
    } catch (e) {
      errori += 1
      console.error('foto-luoghi', luogo.id, e.message)
    }
  })

  return res.status(200).json({
    provati: giro.map((l) => l.id),
    trovate,
    errori,
    rimanenti: daFare.length - giro.length,
  })
}
