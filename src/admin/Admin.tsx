import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { SEZIONI } from '../sezioni'
import type { ContestoHost } from './RichiedeLogin'
import CreaStruttura from './CreaStruttura'

const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase()

export default function Admin() {
  const { session, struttura } = useOutletContext<ContestoHost>()
  const isSuperadmin = !!ADMIN_EMAIL && session.user.email?.toLowerCase() === ADMIN_EMAIL

  if (!struttura) {
    return <CreaStruttura />
  }

  return (
    <div className="max-w-sm mx-auto p-6">
      <h1 className="text-xl font-bold mb-2">Sei dentro, {session.user.email}</h1>
      <p className="text-sm text-gray-500 mb-6">Pannello host — {struttura?.nome}</p>

      <div className="flex flex-col gap-2 mb-6">
        <Link to="/admin/modifica-casa" className="block bg-white shadow rounded-xl p-3 text-sm font-medium">
          ⚙️ Modifica dati della casa
        </Link>
        <Link to="/admin/sezioni-guida" className="block bg-white shadow rounded-xl p-3 text-sm font-medium">
          🧩 Sezioni della guida
        </Link>
        <a
          href={`/${struttura.slug}`}
          target="_blank"
          rel="noreferrer"
          className="block bg-white shadow rounded-xl p-3 text-sm font-medium"
        >
          👀 Vedi la guida degli ospiti
        </a>
      </div>

      {isSuperadmin && (
        <>
          <p className="text-xs font-medium text-gray-400 mb-2">PIATTAFORMA</p>
          <Link to="/admin/invita-host" className="block bg-white shadow rounded-xl p-3 text-sm font-medium mb-6">
            👤 Invita un nuovo host
          </Link>
        </>
      )}

      <p className="text-xs font-medium text-gray-400 mb-2">ELENCHI</p>
      <div className="flex flex-col gap-2 mb-6">
        {SEZIONI.filter((s) => s.tipo === 'elenco').map((s) => (
          <Link key={s.chiave} to={`/admin/${s.chiave}`} className="bg-white shadow rounded-xl p-3 text-sm font-medium">
            Gestisci {s.etichetta}
          </Link>
        ))}
      </div>

      <p className="text-xs font-medium text-gray-400 mb-2">PAGINE DI TESTO</p>
      <div className="flex flex-col gap-2 mb-6">
        {SEZIONI.filter((s) => s.tipo === 'testo').map((s) => (
          <Link key={s.chiave} to={`/admin/${s.chiave}`} className="bg-white shadow rounded-xl p-3 text-sm font-medium">
            Modifica {s.etichetta}
          </Link>
        ))}
      </div>

      <button onClick={() => supabase.auth.signOut()} className="text-sm text-red-600">
        Esci
      </button>
    </div>
  )
}