import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { Session } from '@supabase/supabase-js'

export type StrutturaHost = { id: string; nome: string; slug: string; attivo: boolean }

export type ContestoHost = {
  session: Session
  struttura: StrutturaHost | null // quella selezionata (di solito l'unica): tutte le pagine /admin/* leggono questa
  strutture: StrutturaHost[] // tutte quelle dell'host — normalmente 1, di più per un host "Portfolio"
  selezionaStruttura: (id: string) => void
}

// Chi ha più strutture sceglie quale sta modificando qui, non nell'URL (niente
// /admin/:strutturaId/...): tutte le pagine del pannello restano invariate, operano
// sulla struttura "selezionata". La scelta è ricordata come la lingua della guida ospiti.
export const CHIAVE_STRUTTURA_SELEZIONATA = 'haply-struttura-selezionata'

export default function RichiedeLogin() {
  const [session, setSession] = useState<Session | null>(null)
  const [strutture, setStrutture] = useState<StrutturaHost[]>([])
  const [selezionataId, setSelezionataId] = useState<string | null>(null)
  const [caricamento, setCaricamento] = useState(true)
  const [senzaSessione, setSenzaSessione] = useState(false)

  useEffect(() => {
    async function carica() {
      const { data } = await supabase.auth.getSession()
      const s = data.session

      if (!s) {
        setSenzaSessione(true)
        setCaricamento(false)
        return
      }
      setSession(s)

      const { data: righe } = await supabase
        .from('strutture')
        .select('id, nome, slug, attivo')
        .eq('owner_user_id', s.user.id)
        .order('creato_il')
      const lista = righe ?? []
      setStrutture(lista)

      let scelta = ''
      try {
        scelta = localStorage.getItem(CHIAVE_STRUTTURA_SELEZIONATA) || ''
      } catch {
        // navigazione privata: si ignora, si parte dalla prima struttura
      }
      const trovata = lista.find((r) => r.id === scelta)
      setSelezionataId((trovata ?? lista[0])?.id ?? null)

      setCaricamento(false)
    }
    carica()

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      carica()
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  function selezionaStruttura(id: string) {
    setSelezionataId(id)
    try {
      localStorage.setItem(CHIAVE_STRUTTURA_SELEZIONATA, id)
    } catch {
      // navigazione privata: la scelta vale solo per questa visita
    }
  }

  if (caricamento) return <p className="p-8 text-center">Caricamento...</p>
  if (senzaSessione || !session) return <Navigate to="/login" replace />

  const struttura = strutture.find((s) => s.id === selezionataId) ?? null
  const contesto: ContestoHost = { session, struttura, strutture, selezionaStruttura }

  return <Outlet context={contesto} />
}
