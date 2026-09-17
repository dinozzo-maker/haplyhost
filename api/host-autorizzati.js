import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SITO = 'https://haplyhost.vercel.app'
const PIANI = ['guida', 'concierge', 'portfolio']

// Ritorna l'utente solo se è il superadmin (email === VITE_ADMIN_EMAIL), altrimenti null.
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

export default async function handler(req, res) {
  const admin = await superadmin(req)
  if (!admin) {
    return res.status(403).json({ error: "Sezione riservata all'amministratore della piattaforma" })
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('host_autorizzati')
      .select('email, nome_riferimento, piano, note, autorizzato_il, registrato_il')
      .order('autorizzato_il', { ascending: false })

    if (error) {
      console.error(error)
      return res.status(500).json({ error: "Errore nel leggere l'elenco" })
    }
    return res.status(200).json({ host: data || [] })
  }

  if (req.method === 'POST') {
    const { email, nome_riferimento, piano, note } = req.body || {}
    const emailPulita = (email || '').trim().toLowerCase()
    if (!emailPulita || !emailPulita.includes('@')) {
      return res.status(400).json({ error: 'Email non valida' })
    }
    const pianoPulito = PIANI.includes(piano) ? piano : null

    const { error: erroreUpsert } = await supabase
      .from('host_autorizzati')
      .upsert(
        {
          email: emailPulita,
          nome_riferimento: nome_riferimento?.trim() || null,
          piano: pianoPulito,
          note: note?.trim() || null,
        },
        { onConflict: 'email' }
      )

    if (erroreUpsert) {
      console.error(erroreUpsert)
      return res.status(500).json({ error: "Errore nel salvare l'host autorizzato" })
    }

    // Genera il link di invito. Se l'utente esiste già in Auth, 'invite' fallisce: usa 'magiclink'.
    let risultato = await supabase.auth.admin.generateLink({
      type: 'invite',
      email: emailPulita,
      options: { redirectTo: `${SITO}/admin` },
    })
    if (risultato.error && /already|registered|exists/i.test(risultato.error.message)) {
      risultato = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: emailPulita,
        options: { redirectTo: `${SITO}/admin` },
      })
    }

    if (risultato.error) {
      console.error(risultato.error)
      return res.status(500).json({
        error: 'Host salvato, ma non sono riuscito a generare il link: ' + risultato.error.message,
      })
    }

    const link = risultato.data?.properties?.action_link || ''
    return res.status(200).json({ link })
  }

  if (req.method === 'DELETE') {
    const emailPulita = (req.body?.email || '').trim().toLowerCase()
    if (!emailPulita) {
      return res.status(400).json({ error: 'Email mancante' })
    }
    if (emailPulita === (process.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase()) {
      return res.status(400).json({ error: 'Non puoi rimuovere il superadmin' })
    }

    // Prima della cancellazione trasferiamo ogni struttura al superadmin. La FK
    // usa ON DELETE SET NULL: senza questo passaggio la struttura resterebbe
    // senza proprietario e nessuno potrebbe più gestirla.
    try {
      const { data: lista } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const utente = lista?.users?.find((u) => u.email?.toLowerCase() === emailPulita)
      if (utente) {
        const { data: strutture, error: erroreStrutture } = await supabase
          .from('strutture')
          .select('id')
          .eq('owner_user_id', utente.id)
        if (erroreStrutture) throw erroreStrutture

        const ids = (strutture || []).map((s) => s.id)
        if (ids.length) {
          const { error } = await supabase
            .from('strutture')
            .update({ owner_user_id: admin.id })
            .in('id', ids)
          if (error) throw error
        }

        const { error: erroreAccount } = await supabase.auth.admin.deleteUser(utente.id)
        if (erroreAccount) {
          // Se Auth non permette la cancellazione, restituiamo le strutture
          // all'host: l'operazione resta coerente e non perde proprietà.
          if (ids.length) {
            await supabase.from('strutture').update({ owner_user_id: utente.id }).in('id', ids)
          }
          return res.status(500).json({ error: "Non sono riuscito a rimuovere l'account dell'host. Non è stata fatta nessuna modifica." })
        }
      }
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: "Non sono riuscito a trasferire le strutture dell'host. Non è stata fatta nessuna modifica." })
    }

    const { error: erroreDelete } = await supabase
      .from('host_autorizzati')
      .delete()
      .eq('email', emailPulita)
    if (erroreDelete) {
      console.error(erroreDelete)
      return res.status(500).json({ error: "Account rimosso, ma non sono riuscito ad aggiornare l'elenco host." })
    }

    return res.status(200).json({ ok: true, nota: 'Host rimosso. Le eventuali strutture sono ora sotto il superadmin.' })
  }

  return res.status(405).json({ error: 'Metodo non permesso' })
}
