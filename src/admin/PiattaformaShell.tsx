import type { ReactNode } from 'react'
import { NavLink, Navigate, Outlet, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { ContestoHost } from './RichiedeLogin'
import { ArrowLeft, Gauge, Layers, LogOut, Puzzle, UserPlus } from 'lucide-react'

const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase()

function VoceNav({ to, end, children }: { to: string; end?: boolean; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
          isActive ? 'bg-violet-800/60 text-white' : 'text-violet-200 hover:bg-violet-800/40 hover:text-white'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

// Area a sé per il superadmin (22/09/2026) — separata dal pannello di una singola
// struttura invece di essere un gruppo di link dentro AdminShell.tsx: shell, colore
// (viola/indaco, non slate) e navigazione propri, così è impossibile confondere
// "sto gestendo Villa Virginia" con "sto gestendo la piattaforma". Riceve lo stesso
// ContestoHost di RichiedeLogin/AdminShell e lo ripassa invariato: le pagine sotto
// (InvitaHost, SezioniExtra, ConsumiAI) non sanno di essere sotto una shell diversa,
// continuano a leggere `session` da `useOutletContext<ContestoHost>()` come prima.
export default function PiattaformaShell() {
  const ctx = useOutletContext<ContestoHost>()
  const { session } = ctx
  const isSuperadmin = !!ADMIN_EMAIL && session.user.email?.toLowerCase() === ADMIN_EMAIL

  // Un host normale non dovrebbe mai finire qui (nessun link ce lo porta), ma se
  // digita l'URL a mano non deve nemmeno vedere la shell della piattaforma.
  if (!isSuperadmin) return <Navigate to="/admin" replace />

  return (
    <div className="min-h-screen bg-violet-50 lg:flex">
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:h-screen lg:sticky lg:top-0 lg:bg-violet-950">
        <NavLink to="/admin/piattaforma" end className="flex items-center gap-2 px-5 pt-5 pb-4 text-sm font-bold text-white">
          <Layers className="w-4 h-4 text-violet-300 shrink-0" /> Haplyhost — Piattaforma
        </NavLink>

        <nav className="flex-1 flex flex-col gap-0.5 px-3 pb-4 overflow-y-auto">
          <VoceNav to="/admin/piattaforma/consumi-ai"><Gauge className="w-4 h-4 shrink-0" />Consumi AI</VoceNav>
          <VoceNav to="/admin/piattaforma/invita-host"><UserPlus className="w-4 h-4 shrink-0" />Invita un nuovo host</VoceNav>
          <VoceNav to="/admin/piattaforma/sezioni-extra"><Puzzle className="w-4 h-4 shrink-0" />Sezioni della piattaforma</VoceNav>
        </nav>

        <div className="px-3 pb-4 pt-2 border-t border-violet-900 flex flex-col gap-0.5">
          <NavLink to="/admin" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-violet-200 hover:bg-violet-800/40 hover:text-white">
            <ArrowLeft className="w-4 h-4 shrink-0" />Torna al pannello
          </NavLink>
          <p className="px-3 pb-1 pt-2 text-[11px] text-violet-400 truncate">{session.user.email}</p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-violet-300 hover:bg-violet-800/40 hover:text-white"
          >
            <LogOut className="w-4 h-4 shrink-0" />Esci
          </button>
        </div>
      </aside>

      <div className="min-w-0 lg:flex-1 lg:overflow-y-auto lg:px-6">
        <Outlet context={ctx} />
      </div>
    </div>
  )
}
