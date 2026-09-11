import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useSezioni } from '../useSezioni'
import type { ContestoHost } from './RichiedeLogin'
import CreaStruttura from './CreaStruttura'

const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase()

// Una riga della checklist "Primi passi". `fatto` indefinito = passo di rifinitura
// (freccia, nessuna spunta); true/false = passo che sappiamo controllare da soli.
function Passo({ fatto, to, children }: { fatto?: boolean; to: string; children: ReactNode }) {
  const segno = fatto === undefined ? '→' : fatto ? '✓' : '○'
  const colore = fatto ? 'text-green-600' : 'text-gray-400'
  return (
    <li>
      <Link to={to} className="flex items-center gap-2 text-blue-800 hover:underline">
        <span className={`w-4 text-center ${colore}`}>{segno}</span>
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
    <div className="max-w-sm mx-auto p-6">
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

      {attivo ? (
        <div className="flex items-center justify-between gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-sm mb-4">
          <span className="text-green-800">
            🟢 La guida è online —{' '}
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
          className="block bg-amber-50 border border-amber-300 text-amber-800 rounded-xl p-3 text-sm mb-4"
        >
          ⚠️ Hai modificato {daTradurre} test{daTradurre === 1 ? 'o' : 'i'} dopo l'ultima traduzione.
          Rilancia "Traduzioni della guida".
        </Link>
      )}

      <div className="flex flex-col gap-2 mb-6">
        <Link to="/admin/modifica-casa" className="block bg-white shadow rounded-xl p-3 text-sm font-medium">
          ⚙️ Modifica dati della casa
        </Link>
        <Link to="/admin/note" className="block bg-white shadow rounded-xl p-3 text-sm font-medium">
          📝 Note per Gennarino
        </Link>
        <Link to="/admin/domande" className="block bg-white shadow rounded-xl p-3 text-sm font-medium">
          💬 Domande degli ospiti
        </Link>
        <Link to="/admin/sezioni-guida" className="block bg-white shadow rounded-xl p-3 text-sm font-medium">
          🧩 Sezioni della guida
        </Link>
        <Link to="/admin/traduzioni" className="block bg-white shadow rounded-xl p-3 text-sm font-medium">
          🌐 Traduzioni della guida
        </Link>
        <a
          href={`/${struttura.slug}`}
          target="_blank"
          rel="noreferrer"
          className="block bg-white shadow rounded-xl p-3 text-sm font-medium"
        >
          👀 Vedi la guida degli ospiti
        </a>
        <Link to="/admin/nuova-struttura" className="block text-sm text-blue-600 px-3 pt-1">
          + Aggiungi un'altra struttura
        </Link>
      </div>

      {isSuperadmin && (
        <>
          <p className="text-xs font-medium text-gray-400 mb-2">PIATTAFORMA</p>
          <div className="flex flex-col gap-2 mb-6">
            <Link to="/admin/invita-host" className="block bg-white shadow rounded-xl p-3 text-sm font-medium">
              👤 Invita un nuovo host
            </Link>
            <Link to="/admin/sezioni-extra" className="block bg-white shadow rounded-xl p-3 text-sm font-medium">
              🧩 Sezioni della piattaforma
            </Link>
          </div>
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
