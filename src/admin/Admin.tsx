import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { Session } from '@supabase/supabase-js'

export default function Admin() {
  const session = useOutletContext<Session>()

  return (
    <div className="max-w-sm mx-auto p-6">
      <h1 className="text-xl font-bold mb-2">Sei dentro, {session.user.email}</h1>
      <p className="text-sm text-gray-500 mb-6">Pannello host — Villa Virginia</p>

      <div className="flex flex-col gap-2 mb-6">
        <Link to="/admin/spiagge" className="bg-white shadow rounded-xl p-3 text-sm font-medium">
          Gestisci Spiagge
        </Link>
      </div>

      <button onClick={() => supabase.auth.signOut()} className="text-sm text-red-600">
        Esci
      </button>
    </div>
  )
}