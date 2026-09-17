import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useSezioni } from '../useSezioni'
import type { ContestoHost } from './RichiedeLogin'
import CreaStruttura from './CreaStruttura'
import {
  Settings, NotebookPen, MessageCircleQuestion, BarChart3, LayoutGrid, Languages, Eye,
  UserPlus, Puzzle, CircleCheck, Circle, ArrowRight, TriangleAlert,
} from 'lucide-react'
import { Campo, classeCampo, Pulsante, Esito } from './ui'

const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase()

// Riga di collegamento verso una pagina del pannello — card bianca condivisa da
// tutte le griglie di scorciatoie sotto (desktop e mobile).
function Scorciatoia({ to, esterno, children }: { to: string; esterno?: boolean; children: ReactNode }) {
  const classe = 'flex items-center gap-2.5 bg-white border border-slate-200 shadow-sm rounded-xl p-3 text-sm font-medium text-slate-700 hover:border-slate-300 transition'
  if (esterno) {
    return <a href={to} target="_blank" rel="noreferrer" className={classe}>{children}</a>
  }
  return <Link to={to} className={classe}>{children}</Link>
}

// Una riga della checklist "Primi passi". `fatto` indefinito = passo di rifinitura
// (freccia, nessuna spunta); true/false = passo che sappiamo controllare da soli.
function Passo({ fatto, to, children }: { fatto?: boolean; to: string; children: ReactNode }) {
  const Segno = fatto === undefined ? ArrowRight : fatto ? CircleCheck : Circle
  const colore = fatto ? 'text-green-600' : 'text-slate-400'
  return (
    <li>
      <Link to={to} className="flex items-center gap-2 text-slate-700 hover:text-slate-900 hover:underline">
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
    <div className="max-w-sm mx-auto px-5 py-6 lg:max-w-xl lg:mx-0 lg:px-0 lg:py-10">
      {/* Su schermi larghi la barra laterale (AdminShell) mostra già email e struttura selezionata */}
      <div className="lg:hidden">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight text-balance">Sei dentro, {session.user.email}</h1>

        {strutture.length > 1 ? (
          <div className="mt-5 mb-1">
            <Campo etichetta="Struttura">
              <select
                className={classeCampo}
                value={struttura.id}
                onChange={(e) => selezionaStruttura(e.target.value)}
              >
                {strutture.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}{s.attivo ? '' : ' (bozza)'}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        ) : (
          <p className="text-sm text-slate-500 mt-1.5 mb-1">Pannello host — {struttura.nome}</p>
        )}
      </div>
      <h2 className="hidden lg:block text-2xl font-bold text-slate-900 tracking-tight mb-7">{struttura.nome}</h2>

      <div className="flex flex-col gap-4 mt-6 lg:mt-0">
        {attivo ? (
          <div className="flex items-center justify-between gap-2 bg-green-50 border border-green-200 rounded-2xl p-3.5 text-sm">
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
              className="text-xs text-slate-500 underline shrink-0 disabled:opacity-50"
            >
              Metti offline
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 flex flex-col gap-4">
            <div>
              <p className="font-bold text-sm text-slate-900 mb-1">La tua guida non è ancora online</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Preparala con calma. Gli ospiti la vedranno solo dopo che premi "Pubblica".
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Il minimo per partire</p>
              <ul className="flex flex-col gap-1.5 text-sm">
                <Passo fatto={(nPagine ?? 0) > 0} to="/admin/casa">
                  Scrivi le pagine di testo (Wi-Fi, regole, emergenze…)
                </Passo>
                <Passo fatto={(nLuoghi ?? 0) > 0} to="/admin/mangiare">
                  Aggiungi qualche luogo (ristoranti, spiagge…)
                </Passo>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Poi rifinisci</p>
              <ul className="flex flex-col gap-1.5 text-sm">
                <Passo to="/admin/modifica-casa">Dati e descrizione della casa</Passo>
                <Passo to="/admin/modifica-casa">Colore e foto di copertina</Passo>
                <Passo to="/admin/sezioni-guida">Scegli quali sezioni mostrare</Passo>
                <Passo to="/admin/traduzioni">Traduci la guida</Passo>
              </ul>
            </div>

            <Pulsante onClick={() => cambiaPubblicazione(true)} disabled={cambioStato}>
              {cambioStato ? 'Attendere…' : 'Pubblica la guida'}
            </Pulsante>
          </div>
        )}
        {erroreStato && <Esito ok={false}>{erroreStato}</Esito>}

        {daTradurre > 0 && (
          <Link
            to="/admin/traduzioni"
            className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3.5 text-sm"
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
        <div className="hidden lg:grid lg:grid-cols-3 lg:gap-3">
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4">
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{nLuoghi ?? '—'}</p>
            <p className="text-xs text-slate-500 mt-0.5">luoghi in guida</p>
          </div>
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4">
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{nPagine ?? '—'}</p>
            <p className="text-xs text-slate-500 mt-0.5">pagine di testo</p>
          </div>
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4">
            <p className={`text-2xl font-bold tabular-nums ${daTradurre > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{daTradurre}</p>
            <p className="text-xs text-slate-500 mt-0.5">test{daTradurre === 1 ? 'o' : 'i'} da tradurre</p>
          </div>
        </div>

        <div className="hidden lg:grid lg:grid-cols-2 lg:gap-3">
          <Scorciatoia to={`/${struttura.slug}`} esterno>
            <Eye className="w-4 h-4 text-slate-400 shrink-0" /> Vedi la guida
          </Scorciatoia>
          <Scorciatoia to="/admin/modifica-casa">
            <Settings className="w-4 h-4 text-slate-400 shrink-0" /> Dati della casa
          </Scorciatoia>
          <Scorciatoia to="/admin/sezioni-guida">
            <LayoutGrid className="w-4 h-4 text-slate-400 shrink-0" /> Sezioni della guida
          </Scorciatoia>
          <Scorciatoia to="/admin/traduzioni">
            <Languages className="w-4 h-4 text-slate-400 shrink-0" /> Traduzioni della guida
          </Scorciatoia>
        </div>

        <div className="flex flex-col gap-2 lg:hidden">
          <Scorciatoia to="/admin/modifica-casa">
            <Settings className="w-4 h-4 text-slate-400 shrink-0" /> Modifica dati della casa
          </Scorciatoia>
          <Scorciatoia to="/admin/note">
            <NotebookPen className="w-4 h-4 text-slate-400 shrink-0" /> Note per Gennarino
          </Scorciatoia>
          <Scorciatoia to="/admin/domande">
            <MessageCircleQuestion className="w-4 h-4 text-slate-400 shrink-0" /> Domande degli ospiti
          </Scorciatoia>
          <Scorciatoia to="/admin/statistiche">
            <BarChart3 className="w-4 h-4 text-slate-400 shrink-0" /> Statistiche Gennarino
          </Scorciatoia>
          <Scorciatoia to="/admin/sezioni-guida">
            <LayoutGrid className="w-4 h-4 text-slate-400 shrink-0" /> Sezioni della guida
          </Scorciatoia>
          <Scorciatoia to="/admin/traduzioni">
            <Languages className="w-4 h-4 text-slate-400 shrink-0" /> Traduzioni della guida
          </Scorciatoia>
          <Scorciatoia to={`/${struttura.slug}`} esterno>
            <Eye className="w-4 h-4 text-slate-400 shrink-0" /> Vedi la guida degli ospiti
          </Scorciatoia>
          <Link to="/admin/nuova-struttura" className="block text-sm font-medium text-slate-600 hover:text-slate-900 px-3 pt-1">
            + Aggiungi un'altra struttura
          </Link>
        </div>

        {isSuperadmin && (
          <div className="lg:hidden">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Piattaforma</p>
            <div className="flex flex-col gap-2">
              <Scorciatoia to="/admin/invita-host">
                <UserPlus className="w-4 h-4 text-slate-400 shrink-0" /> Invita un nuovo host
              </Scorciatoia>
              <Scorciatoia to="/admin/sezioni-extra">
                <Puzzle className="w-4 h-4 text-slate-400 shrink-0" /> Sezioni della piattaforma
              </Scorciatoia>
            </div>
          </div>
        )}

        <div className="lg:hidden">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Elenchi</p>
          <div className="flex flex-col gap-2 mb-2">
            {SEZIONI.filter((s) => s.tipo === 'elenco').map((s) => (
              <Scorciatoia key={s.chiave} to={`/admin/${s.chiave}`}>
                Gestisci {s.etichetta}
              </Scorciatoia>
            ))}
          </div>

          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-4">Pagine di testo</p>
          <div className="flex flex-col gap-2 mb-2">
            {SEZIONI.filter((s) => s.tipo === 'testo').map((s) => (
              <Scorciatoia key={s.chiave} to={`/admin/${s.chiave}`}>
                Modifica {s.etichetta}
              </Scorciatoia>
            ))}
          </div>

          <Pulsante variante="pericolo" onClick={() => supabase.auth.signOut()} className="mt-2">
            Esci
          </Pulsante>
        </div>
      </div>
    </div>
  )
}
