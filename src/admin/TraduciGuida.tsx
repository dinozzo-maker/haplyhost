import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { ContestoHost } from './RichiedeLogin'

export default function TraduciGuida() {
  const { struttura } = useOutletContext<ContestoHost>()
  const [traducendo, setTraducendo] = useState(false)
  const [esito, setEsito] = useState('')
  const [daTradurre, setDaTradurre] = useState(0)

  useEffect(() => {
    const sid = struttura?.id
    if (!sid) return
    let vivo = true
    ;(async () => {
      try {
        const [p, l] = await Promise.all([
          supabase.from('pagine').select('id', { count: 'exact', head: true }).eq('struttura_id', sid).eq('da_tradurre', true),
          supabase.from('luoghi').select('id', { count: 'exact', head: true }).eq('struttura_id', sid).eq('da_tradurre', true),
        ])
        if (vivo) setDaTradurre((p.count ?? 0) + (l.count ?? 0))
      } catch {
        if (vivo) setDaTradurre(0)
      }
    })()
    return () => { vivo = false }
  }, [struttura])

  async function traduci() {
    if (!struttura) return
    setEsito('')
    setTraducendo(true)

    const { data: sessionData } = await supabase.auth.getSession()

    try {
      const res = await fetch('/api/traduci-guida', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          struttura_id: struttura.id,
          access_token: sessionData.session?.access_token,
        }),
      })
      const dati = await res.json().catch(() => ({}))
      if (!res.ok) {
        setEsito(dati.error || 'Traduzione non riuscita, riprova.')
        return
      }
      setEsito(`Tradotte ${dati.pagine} pagine e ${dati.luoghi} luoghi ✓`)
      setDaTradurre(0)
    } catch {
      setEsito('Errore di connessione, riprova.')
    } finally {
      setTraducendo(false)
    }
  }

  if (!struttura) {
    return (
      <div className="max-w-sm mx-auto p-6">
        <Link to="/admin" className="text-sm text-blue-600">&larr; Torna al pannello</Link>
        <p className="mt-4 text-sm">Non hai ancora una struttura.</p>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto p-6">
      <Link to="/admin" className="text-sm text-blue-600">&larr; Torna al pannello</Link>
      <h1 className="text-xl font-bold mt-2 mb-2">Traduzioni della guida</h1>
      <p className="text-sm text-gray-500 mb-3">
        La guida ospiti si mostra da sola nella lingua del telefono (italiano, inglese, francese,
        tedesco, spagnolo). I nomi dei luoghi e le loro descrizioni sono già tradotti. Questo pulsante
        traduce le <strong>pagine di testo</strong> (Wi-Fi, regole, emergenze…) e i luoghi che non
        hanno ancora una traduzione.
      </p>
      <p className="text-xs text-gray-400 mb-4">
        Rilancialo ogni volta che modifichi un testo: le traduzioni non si aggiornano da sole.
        Ci vuole circa un minuto.
      </p>

      {daTradurre > 0 && (
        <p className="bg-amber-50 border border-amber-300 text-amber-800 rounded-xl p-3 text-sm mb-3">
          Ci sono {daTradurre} test{daTradurre === 1 ? 'o' : 'i'} modificat{daTradurre === 1 ? 'o' : 'i'}
          {' '}dopo l'ultima traduzione.
        </p>
      )}

      <button
        onClick={traduci}
        disabled={traducendo}
        className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm disabled:opacity-50"
      >
        {traducendo ? 'Sto traducendo, può volerci un minuto…' : 'Traduci la guida'}
      </button>
      {esito && <p className="text-sm text-gray-600 mt-3 text-center">{esito}</p>}
    </div>
  )
}
