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
  const emailHost = (userData.user.email || '').trim().toLowerCase()

  // Un host può avere più strutture (pannello: selettore in Admin.tsx quando ne ha
  // più di una) — niente più blocco "ne hai già una". Il limite, se servirà in base
  // al piano (Guida/Concierge/Portfolio), va aggiunto qui in futuro.

  // Cancello: l'email dev'essere tra gli host autorizzati (o essere il superadmin).
  // Il link di invito lo genera solo il superadmin da /admin/invita-host, che scrive
  // qui la riga; questo blocca chi arrivasse con un account Auth creato a mano.
  const adminEmail = (process.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase()
  if (emailHost !== adminEmail) {
    const { data: autorizzato, error: erroreAutorizzato } = await supabase
      .from('host_autorizzati')
      .select('email')
      .eq('email', emailHost)
      .maybeSingle()
    if (erroreAutorizzato) {
      console.error('importa-casa: verifica host_autorizzati fallita', erroreAutorizzato)
      return res.status(503).json({ error: "Non riesco a verificare l'autorizzazione adesso, riprova tra poco." })
    }
    if (!autorizzato) {
      return res.status(403).json({
        error: "Questa email non risulta tra gli host autorizzati. Scrivi all'amministratore di Haplyhost per l'attivazione.",
      })
    }
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
      // Nasce NON pubblica: l'host la prepara e poi la pubblica dal pannello
      // ("Pubblica la guida" in Admin.tsx). Fino ad allora gli ospiti non la vedono;
      // l'host sì (policy RLS "l'owner vede la propria", migration 0010).
      attivo: false,
    })
    .select('id, slug, nome')
    .single()

  if (erroreCreazione) {
    console.error(erroreCreazione)
    return res.status(500).json({ error: 'Errore nella creazione della struttura' })
  }

  // Segna la data di registrazione nell'elenco host autorizzati (per la pagina
  // "Invita host"). Best-effort: se la riga non c'è o fallisce, non blocca nulla.
  if (emailHost) {
    const { error: erroreRegistrato } = await supabase
      .from('host_autorizzati')
      .update({ registrato_il: new Date().toISOString() })
      .eq('email', emailHost)
    if (erroreRegistrato) console.error('registrato_il non aggiornato:', erroreRegistrato)
  }

  return res.status(200).json({ struttura: nuovaStruttura })
}
