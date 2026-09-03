import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { ContestoHost } from './RichiedeLogin'

type Domanda = {
  id: string
  domanda: string
  risposta: string
  lang: string | null
  creato_il: string
}

const BANDIERA: Record<string, string> = {
  it: '🇮🇹', en: '🇬🇧', fr: '🇫🇷', de: '🇩🇪', es: '🇪🇸',
}

function quando(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) +
    ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

export default function DomandeOspiti() {
  const { struttura } = useOutletContext<ContestoHost>()
  const [domande, setDomande] = useState<Domanda[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [aperta, setAperta] = useState<string | null>(null)

  useEffect(() => {
    async function carica() {
      if (!struttura) {
        setCaricamento(false)
        return
      }
      const { data } = await supabase
        .from('domande')
        .select('id, domanda, risposta, lang, creato_il')
        .eq('struttura_id', struttura.id)
        .order('creato_il', { ascending: false })
        .limit(300)
      setDomande(data ?? [])
      setCaricamento(false)
    }
    carica()
  }, [struttura])

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
      <h1 className="text-xl font-bold mt-2 mb-1">Domande degli ospiti</h1>
      <p className="text-sm text-gray-500 mb-4">
        Tutto quello che gli ospiti hanno chiesto a Gennarino. Utile per capire cosa manca nella
        guida o cosa spiegare meglio.
      </p>

      {caricamento && <p className="text-sm">Caricamento...</p>}
      {!caricamento && domande.length === 0 && (
        <p className="text-sm text-gray-500">Nessuna domanda per ora.</p>
      )}

      <div className="flex flex-col gap-2">
        {domande.map((d) => (
          <button
            key={d.id}
            onClick={() => setAperta(aperta === d.id ? null : d.id)}
            className="bg-white shadow rounded-xl p-3 text-left"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">
                {d.lang && d.lang !== 'it' ? (BANDIERA[d.lang] ?? '') + ' ' : ''}{d.domanda}
              </p>
              <span className="text-xs text-gray-400 shrink-0 mt-0.5">{quando(d.creato_il)}</span>
            </div>
            {aperta === d.id && (
              <p className="text-xs text-gray-600 mt-2 whitespace-pre-line border-t pt-2">
                {d.risposta}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
