import type { ReactNode } from 'react'
import { NavLink, useOutletContext } from 'react-router-dom'
import { Outlet } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useSezioni } from '../useSezioni'
import { Icona } from '../Icona'
import type { ContestoHost } from './RichiedeLogin'
import {
  Home, Settings, NotebookPen, MessageCircleQuestion, BarChart3, LayoutGrid, Languages, Eye,
  UserPlus, Puzzle, Gauge, LogOut,
} from 'lucide-react'

const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase()

function VoceNav({ to, end, children }: { to: string; end?: boolean; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
          isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

function EtichettaGruppo({ children }: { children: ReactNode }) {
  return <p className="px-3 pb-1 text-[10px] font-bold tracking-wider text-slate-500 uppercase">{children}</p>
}

// Guscio del pannello host: su schermi larghi (lg, 1024px+) aggiunge una barra
// laterale con la navigazione completa; sotto quella soglia non cambia nulla —
// ogni pagina resta esattamente come prima (il suo <div max-w-sm mx-auto p-6>).
// Passa lo stesso ContestoHost ricevuto da RichiedeLogin, invariato, alle pagine.
export default function AdminShell() {
  const ctx = useOutletContext<ContestoHost>()
  const { session, struttura, strutture, selezionaStruttura } = ctx
  const { tutte } = useSezioni()
  const isSuperadmin = !!ADMIN_EMAIL && session.user.email?.toLowerCase() === ADMIN_EMAIL
  const elenchi = tutte.filter((s) => s.tipo === 'elenco')
  const pagine = tutte.filter((s) => s.tipo === 'testo')

  return (
    <div className="min-h-screen bg-slate-50 lg:flex lg:bg-slate-100">
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:h-screen lg:sticky lg:top-0 lg:bg-slate-900">
        <NavLink to="/admin" end className="flex items-center gap-2 px-5 pt-5 pb-4 text-sm font-bold text-white">
          <Home className="w-4 h-4 text-amber-400 shrink-0" /> Haplyhost
        </NavLink>

        {struttura && (
          strutture.length > 1 ? (
            <select
              className="mx-4 mb-4 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-semibold text-white"
              value={struttura.id}
              onChange={(e) => selezionaStruttura(e.target.value)}
            >
              {strutture.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}{s.attivo ? '' : ' (bozza)'}</option>
              ))}
            </select>
          ) : (
            <p className="mx-5 mb-4 text-xs font-semibold text-slate-400 truncate">{struttura.nome}</p>
          )
        )}

        <nav className="flex-1 flex flex-col gap-4 px-3 pb-4 overflow-y-auto">
          <div className="flex flex-col gap-0.5">
            <EtichettaGruppo>Guida</EtichettaGruppo>
            <VoceNav to="/admin/modifica-casa"><Settings className="w-4 h-4 shrink-0" />Dati della casa</VoceNav>
            <VoceNav to="/admin/note"><NotebookPen className="w-4 h-4 shrink-0" />Note per Gennarino</VoceNav>
            <VoceNav to="/admin/domande"><MessageCircleQuestion className="w-4 h-4 shrink-0" />Domande ospiti</VoceNav>
            <VoceNav to="/admin/statistiche"><BarChart3 className="w-4 h-4 shrink-0" />Statistiche Gennarino</VoceNav>
            <VoceNav to="/admin/sezioni-guida"><LayoutGrid className="w-4 h-4 shrink-0" />Sezioni della guida</VoceNav>
            <VoceNav to="/admin/traduzioni"><Languages className="w-4 h-4 shrink-0" />Traduzioni</VoceNav>
            {struttura && (
              <a
                href={`/${struttura.slug}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/60 hover:text-white"
              >
                <Eye className="w-4 h-4 shrink-0" />Vedi la guida
              </a>
            )}
          </div>

          {elenchi.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <EtichettaGruppo>Elenchi</EtichettaGruppo>
              {elenchi.map((s) => (
                <VoceNav key={s.chiave} to={`/admin/${s.chiave}`}>
                  <Icona nome={s.icona} className="w-4 h-4 shrink-0" /><span className="truncate">{s.etichetta}</span>
                </VoceNav>
              ))}
            </div>
          )}

          {pagine.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <EtichettaGruppo>Pagine di testo</EtichettaGruppo>
              {pagine.map((s) => (
                <VoceNav key={s.chiave} to={`/admin/${s.chiave}`}>
                  <Icona nome={s.icona} className="w-4 h-4 shrink-0" /><span className="truncate">{s.etichetta}</span>
                </VoceNav>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-0.5">
            <EtichettaGruppo>Strutture</EtichettaGruppo>
            <VoceNav to="/admin/nuova-struttura">
              <span className="w-4 text-center shrink-0">+</span>Aggiungi un'altra
            </VoceNav>
          </div>

          {isSuperadmin && (
            <div className="flex flex-col gap-0.5">
              <EtichettaGruppo>Piattaforma</EtichettaGruppo>
              <VoceNav to="/admin/invita-host"><UserPlus className="w-4 h-4 shrink-0" />Invita un nuovo host</VoceNav>
              <VoceNav to="/admin/sezioni-extra"><Puzzle className="w-4 h-4 shrink-0" />Sezioni della piattaforma</VoceNav>
              <VoceNav to="/admin/consumi-ai"><Gauge className="w-4 h-4 shrink-0" />Consumi AI</VoceNav>
            </div>
          )}
        </nav>

        <div className="px-3 pb-4 pt-2 border-t border-slate-800">
          <p className="px-3 pb-2 text-[11px] text-slate-500 truncate">{session.user.email}</p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800/60 hover:text-white"
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
