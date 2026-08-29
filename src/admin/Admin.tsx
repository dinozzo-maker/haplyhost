import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { Session } from '@supabase/supabase-js'

export default function Admin() {
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

  return (
    <div className="max-w-sm mx-auto p-6">
      <h1 className="text-xl font-bold mb-2">Sei dentro, {session.user.email}</h1>
      <p className="text-sm text-gray-500 mb-6">Pannello host — Villa Virginia</p>
      <button onClick={() => supabase.auth.signOut()} className="text-sm text-red-600">
        Esci
      </button>
    </div>
  )
}