import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { Session } from '@supabase/supabase-js'

export type StrutturaHost = { id: string; nome: string; slug: string; attivo: boolean; sezioni_attive: string[] | null }

export type ContestoHost = {
  session: Session
  struttura: StrutturaHost | null // quella selezionata (di solito l'unica): tutte le pagine /admin/* leggono questa
  strutture: StrutturaHost[] // tutte quelle dell'host — normalmente 1, di più per un host "Portfolio"
  selezionaStruttura: (id: string) => void
  aggiornaSezioniAttive: (sezioni: string[]) => void
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
  const [errore, setErrore] = useState('')

  useEffect(() => {
    async function carica() {
      setErrore('')
      const { data, error: erroreSessione } = await supabase.auth.getSession()
      if (erroreSessione) {
        setErrore('Non riesco a verificare l’accesso. Controlla la connessione e riprova.')
        setCaricamento(false)
        return
      }
      const s = data.session

      if (!s) {
        setSenzaSessione(true)
        setCaricamento(false)
        return
      }
      setSession(s)

      const { data: righe, error: erroreStrutture } = await supabase
        .from('strutture')
        .select('id, nome, slug, attivo, sezioni_attive')
        .eq('owner_user_id', s.user.id)
        .order('creato_il')
      if (erroreStrutture) {
        setErrore('Non riesco a caricare le tue strutture. Riprova tra poco.')
        setCaricamento(false)
        return
      }
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

  function aggiornaSezioniAttive(sezioniAttive: string[]) {
    if (!selezionataId) return
    setStrutture((correnti) => correnti.map((struttura) =>
      struttura.id === selezionataId ? { ...struttura, sezioni_attive: sezioniAttive } : struttura
    ))
  }

  if (caricamento) return <p className="p-8 text-center">Caricamento...</p>
  if (senzaSessione || !session) return <Navigate to="/login" replace />
  if (errore) {
    return <div className="max-w-sm mx-auto p-6 text-center text-sm text-slate-600">{errore}</div>
  }

  const struttura = strutture.find((s) => s.id === selezionataId) ?? null
  const contesto: ContestoHost = { session, struttura, strutture, selezionaStruttura, aggiornaSezioniAttive }

  return <Outlet context={contesto} />
}
