import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { Session } from '@supabase/supabase-js'

export default function RichiedeLogin() {
  const [session, setSession] = useState<Session | null>(null)
  const [caricamento, setCaricamento] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCaricamento(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nuovaSession) => {
      setSession(nuovaSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  if (caricamento) return <p className="p-8 text-center">Caricamento...</p>
  if (!session) return <Navigate to="/login" replace />

  return <Outlet context={session} />
}