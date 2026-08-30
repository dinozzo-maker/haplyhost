import { createClient } from '@supabase/supabase-js'
import { generaDescrizioneCasa } from '../lib/genera-descrizione-casa.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' })
  }

  const { struttura_id, link, access_token } = req.body
  if (!struttura_id || !link || !access_token) {
    return res.status(400).json({ error: 'Dati mancanti' })
  }

  const { data: userData, error: erroreUtente } = await supabase.auth.getUser(access_token)
  if (erroreUtente || !userData?.user) {
    return res.status(401).json({ error: 'Sessione non valida, rifai il login' })
  }

  const { data: struttura, error: erroreStruttura } = await supabase
    .from('strutture')
    .select('id, nome, indirizzo, citta, owner_user_id')
    .eq('id', struttura_id)
    .single()

  if (erroreStruttura || !struttura) {
    return res.status(404).json({ error: 'Struttura non trovata' })
  }
  if (struttura.owner_user_id !== userData.user.id) {
    return res.status(403).json({ error: 'Non sei il proprietario di questa struttura' })
  }

  const { descrizione, citta } = await generaDescrizioneCasa({
    nome: struttura.nome,
    indirizzo: struttura.indirizzo,
    link,
  })

  if (!descrizione) {
    return res.status(502).json({ error: 'Non sono riuscito a rigenerare la descrizione, riprova' })
  }

  const cittaFinale = citta || struttura.citta

  const { error: erroreUpdate } = await supabase
    .from('strutture')
    .update({
      descrizione_casa: descrizione,
      citta: cittaFinale,
      link_riferimento: link,
    })
    .eq('id', struttura_id)

  if (erroreUpdate) {
    console.error(erroreUpdate)
    return res.status(500).json({ error: 'Errore nel salvataggio della descrizione' })
  }

  return res.status(200).json({ descrizione, citta: cittaFinale })
}
