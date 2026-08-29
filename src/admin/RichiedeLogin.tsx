import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { Session } from '@supabase/supabase-js'

export type ContestoHost = {
  session: Session
  struttura: { id: string; nome: string; slug: string } | null
}

export default function RichiedeLogin() {
  const [contesto, setContesto] = useState<ContestoHost | null>(null)
  const [caricamento, setCaricamento] = useState(true)
  const [senzaSessione, setSenzaSessione] = useState(false)

  useEffect(() => {
    async function carica() {
      const { data } = await supabase.auth.getSession()
      const session = data.session

      if (!session) {
        setSenzaSessione(true)
        setCaricamento(false)
        return
      }

      const { data: struttura } = await supabase
        .from('strutture')
        .select('id, nome, slug')
        .eq('owner_user_id', session.user.id)
        .maybeSingle()

      setContesto({ session, struttura })
      setCaricamento(false)
    }
    carica()

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      carica()
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  if (caricamento) return <p className="p-8 text-center">Caricamento...</p>
  if (senzaSessione || !contesto) return <Navigate to="/login" replace />

  if (!contesto.struttura) {
    return (
      <div className="p-8 text-center">
        <p>Nessuna struttura associata al tuo account.</p>
      </div>
    )
  }

  return <Outlet context={contesto} />
}