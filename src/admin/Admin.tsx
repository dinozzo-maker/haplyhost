import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useSezioni } from '../useSezioni'
import type { ContestoHost } from './RichiedeLogin'
import CreaStruttura from './CreaStruttura'
import {
  Settings, NotebookPen, MessageCircleQuestion, LayoutGrid, Languages, Eye,
  UserPlus, Puzzle, CircleCheck, Circle, ArrowRight, TriangleAlert,
} from 'lucide-react'

const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase()

// Una riga della checklist "Primi passi". `fatto` indefinito = passo di rifinitura
// (freccia, nessuna spunta); true/false = passo che sappiamo controllare da soli.
function Passo({ fatto, to, children }: { fatto?: boolean; to: string; children: ReactNode }) {
  const Segno = fatto === undefined ? ArrowRight : fatto ? CircleCheck : Circle
  const colore = fatto ? 'text-green-600' : 'text-gray-400'
  return (
    <li>
      <Link to={to} className="flex items-center gap-2 text-blue-800 hover:underline">
        <Segno className={`w-4 h-4 shrink-0 ${colore}`} />
        <span>{children}</span>
      </Link>
    </li>
  )
}

export default function Admin() {
  const { session, struttura, strutture, selezionaStruttura } = useOutletContext<ContestoHost>()
  const { tutte: SEZIONI } = useSezioni()
  const isSuperadmin = !!ADMIN_EMAIL && session.user.email?.toLowerCase() === ADMIN_EMAIL

  const [daTradurre, setDaTradurre] = useState(0)
  const [nPagine, setNPagine] = useState<number | null>(null)
  const [nLuoghi, setNLuoghi] = useState<number | null>(null)

  // Stato "guida online": copia locale, così i pulsanti Pubblica/Offline aggiornano
  // subito il pannello. Va risincronizzata quando cambia la struttura selezionata
  // (chi ne ha più d'una può cambiarla qui senza ricaricare la pagina) — pattern
  // "adjust state during render" di React, niente useEffect/niente warning.
  const [attivo, setAttivo] = useState(!!struttura?.attivo)
  const [attivoDi, setAttivoDi] = useState(struttura?.id)
  if (struttura?.id !== attivoDi) {
    setAttivoDi(struttura?.id)
    setAttivo(!!struttura?.attivo)
  }
  const [cambioStato, setCambioStato] = useState(false)
  const [erroreStato, setErroreStato] = useState('')

  useEffect(() => {
    const sid = struttura?.id
    if (!sid) return
    let vivo = true
    ;(async () => {
      try {
        const [pStale, lStale, pTot, lTot] = await Promise.all([
          supabase.from('pagine').select('id', { count: 'exact', head: true }).eq('struttura_id', sid).eq('da_tradurre', true),
          supabase.from('luoghi').select('id', { count: 'exact', head: true }).eq('struttura_id', sid).eq('da_tradurre', true),
          supabase.from('pagine').select('id', { count: 'exact', head: true }).eq('struttura_id', sid),
          supabase.from('luoghi').select('id', { count: 'exact', head: true }).eq('struttura_id', sid),
        ])
        if (!vivo) return
        setDaTradurre((pStale.count ?? 0) + (lStale.count ?? 0))
        setNPagine(pTot.count ?? 0)
        setNLuoghi(lTot.count ?? 0)
      } catch {
        if (vivo) setDaTradurre(0)
      }
    })()
    return () => { vivo = false }
  }, [struttura?.id])

  async function cambiaPubblicazione(nuovo: boolean) {
    if (!struttura) return
    if (
      !nuovo &&
      !window.confirm('Mettere offline la guida? Gli ospiti non potranno più aprirla finché non la ripubblichi.')
    ) {
      return
    }
    setErroreStato('')
    setCambioStato(true)
    const { error } = await supabase.from('strutture').update({ attivo: nuovo }).eq('id', struttura.id)
    setCambioStato(false)
    if (error) {
      setErroreStato('Non ha funzionato: ' + error.message)
      return
    }
    setAttivo(nuovo)
  }

  if (!struttura) {
    return <CreaStruttura />
  }

  return (
    <div className="max-w-sm mx-auto p-6 lg:max-w-xl lg:mx-0 lg:p-10">
      {/* Su schermi larghi la barra laterale (AdminShell) mostra già email e struttura selezionata */}
      <div className="lg:hidden">
        <h1 className="text-xl font-bold mb-2">Sei dentro, {session.user.email}</h1>

        {strutture.length > 1 ? (
          <div className="mb-6">
            <label className="text-xs text-gray-500">Struttura</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
              value={struttura.id}
              onChange={(e) => selezionaStruttura(e.target.value)}
            >
              {strutture.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}{s.attivo ? '' : ' (bozza)'}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-6">Pannello host — {struttura.nome}</p>
        )}
      </div>
      <h2 className="hidden lg:block text-2xl font-bold mb-6">{struttura.nome}</h2>

      {attivo ? (
        <div className="flex items-center justify-between gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-sm mb-4">
          <span className="text-green-800 inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            La guida è online —{' '}
            <a href={`/${struttura.slug}`} target="_blank" rel="noreferrer" className="underline">
              aprila
            </a>
          </span>
          <button
            onClick={() => cambiaPubblicazione(false)}
            disabled={cambioStato}
            className="text-xs text-gray-500 underline shrink-0 disabled:opacity-50"
          >
            Metti offline
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 mb-4">
          <p className="font-bold text-sm text-blue-900 mb-1">La tua guida non è ancora online</p>
          <p className="text-xs text-blue-800 mb-3">
            Preparala con calma. Gli ospiti la vedranno solo dopo che premi "Pubblica".
          </p>

          <p className="text-xs font-medium text-blue-900 mb-1">Il minimo per partire</p>
          <ul className="flex flex-col gap-1.5 mb-3 text-sm">
            <Passo fatto={(nPagine ?? 0) > 0} to="/admin/casa">
              Scrivi le pagine di testo (Wi-Fi, regole, emergenze…)
            </Passo>
            <Passo fatto={(nLuoghi ?? 0) > 0} to="/admin/mangiare">
              Aggiungi qualche luogo (ristoranti, spiagge…)
            </Passo>
          </ul>

          <p className="text-xs font-medium text-blue-900 mb-1">Poi rifinisci</p>
          <ul className="flex flex-col gap-1.5 mb-4 text-sm">
            <Passo to="/admin/modifica-casa">Dati e descrizione della casa</Passo>
            <Passo to="/admin/modifica-casa">Colore e foto di copertina</Passo>
            <Passo to="/admin/sezioni-guida">Scegli quali sezioni mostrare</Passo>
            <Passo to="/admin/traduzioni">Traduci la guida</Passo>
          </ul>

          <button
            onClick={() => cambiaPubblicazione(true)}
            disabled={cambioStato}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
          >
            {cambioStato ? 'Attendere…' : 'Pubblica la guida'}
          </button>
        </div>
      )}
      {erroreStato && <p className="text-red-600 text-xs mb-4">{erroreStato}</p>}

      {daTradurre > 0 && (
        <Link
          to="/admin/traduzioni"
          className="flex items-start gap-2 bg-amber-50 border border-amber-300 text-amber-800 rounded-xl p-3 text-sm mb-4"
        >
          <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Hai modificato {daTradurre} test{daTradurre === 1 ? 'o' : 'i'} dopo l'ultima traduzione.
            Rilancia "Traduzioni della guida".
          </span>
        </Link>
      )}

      {/* Solo desktop: la barra laterale copre già la navigazione, qui un colpo d'occhio
          sui numeri veri della struttura (niente statistiche finte) + le azioni più comuni. */}
      <div className="hidden lg:grid lg:grid-cols-3 lg:gap-3 lg:mb-3">
        <div className="bg-white shadow rounded-xl p-4">
          <p className="text-2xl font-bold tabular-nums">{nLuoghi ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">luoghi in guida</p>
        </div>
        <div className="bg-white shadow rounded-xl p-4">
          <p className="text-2xl font-bold tabular-nums">{nPagine ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">pagine di testo</p>
        </div>
        <div className="bg-white shadow rounded-xl p-4">
          <p className={`text-2xl font-bold tabular-nums ${daTradurre > 0 ? 'text-amber-600' : ''}`}>{daTradurre}</p>
          <p className="text-xs text-gray-500 mt-0.5">test{daTradurre === 1 ? 'o' : 'i'} da tradurre</p>
        </div>
      </div>

      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-3 lg:mb-6">
        <a href={`/${struttura.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 bg-white shadow rounded-xl p-3 text-sm font-medium">
          <Eye className="w-4 h-4 text-gray-400 shrink-0" /> Vedi la guida
        </a>
        <Link to="/admin/modifica-casa" className="flex items-center gap-2.5 bg-white shadow rounded-xl p-3 text-sm font-medium">
          <Settings className="w-4 h-4 text-gray-400 shrink-0" /> Dati della casa
        </Link>
        <Link to="/admin/sezioni-guida" className="flex items-center gap-2.5 bg-white shadow rounded-xl p-3 text-sm font-medium">
          <LayoutGrid className="w-4 h-4 text-gray-400 shrink-0" /> Sezioni della guida
        </Link>
        <Link to="/admin/traduzioni" className="flex items-center gap-2.5 bg-white shadow rounded-xl p-3 text-sm font-medium">
          <Languages className="w-4 h-4 text-gray-400 shrink-0" /> Traduzioni della guida
        </Link>
      </div>

      <div className="flex flex-col gap-2 mb-6 lg:hidden">
        <Link to="/admin/modifica-casa" className="flex items-center gap-2.5 bg-white shadow rounded-xl p-3 text-sm font-medium">
          <Settings className="w-4 h-4 text-gray-400 shrink-0" /> Modifica dati della casa
        </Link>
        <Link to="/admin/note" className="flex items-center gap-2.5 bg-white shadow rounded-xl p-3 text-sm font-medium">
          <NotebookPen className="w-4 h-4 text-gray-400 shrink-0" /> Note per Gennarino
        </Link>
        <Link to="/admin/domande" className="flex items-center gap-2.5 bg-white shadow rounded-xl p-3 text-sm font-medium">
          <MessageCircleQuestion className="w-4 h-4 text-gray-400 shrink-0" /> Domande degli ospiti
        </Link>
        <Link to="/admin/sezioni-guida" className="flex items-center gap-2.5 bg-white shadow rounded-xl p-3 text-sm font-medium">
          <LayoutGrid className="w-4 h-4 text-gray-400 shrink-0" /> Sezioni della guida
        </Link>
        <Link to="/admin/traduzioni" className="flex items-center gap-2.5 bg-white shadow rounded-xl p-3 text-sm font-medium">
          <Languages className="w-4 h-4 text-gray-400 shrink-0" /> Traduzioni della guida
        </Link>
        <a
          href={`/${struttura.slug}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 bg-white shadow rounded-xl p-3 text-sm font-medium"
        >
          <Eye className="w-4 h-4 text-gray-400 shrink-0" /> Vedi la guida degli ospiti
        </a>
        <Link to="/admin/nuova-struttura" className="block text-sm text-blue-600 px-3 pt-1">
          + Aggiungi un'altra struttura
        </Link>
      </div>

      {isSuperadmin && (
        <div className="lg:hidden">
          <p className="text-xs font-medium text-gray-400 mb-2">PIATTAFORMA</p>
          <div className="flex flex-col gap-2 mb-6">
            <Link to="/admin/invita-host" className="flex items-center gap-2.5 bg-white shadow rounded-xl p-3 text-sm font-medium">
              <UserPlus className="w-4 h-4 text-gray-400 shrink-0" /> Invita un nuovo host
            </Link>
            <Link to="/admin/sezioni-extra" className="flex items-center gap-2.5 bg-white shadow rounded-xl p-3 text-sm font-medium">
              <Puzzle className="w-4 h-4 text-gray-400 shrink-0" /> Sezioni della piattaforma
            </Link>
          </div>
        </div>
      )}

      <div className="lg:hidden">
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
    </div>
  )
}
