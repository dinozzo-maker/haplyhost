import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { ContestoHost } from './RichiedeLogin'
import { PaginaAdmin } from './ui'

type Domanda = {
  id: string
  domanda: string
  risposta: string
  lang: string | null
  creato_il: string
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
      <PaginaAdmin titolo="Domande degli ospiti">
        <p className="text-sm text-slate-500">Non hai ancora una struttura.</p>
      </PaginaAdmin>
    )
  }

  return (
    <PaginaAdmin
      titolo="Domande degli ospiti"
      sottotitolo="Tutto quello che gli ospiti hanno chiesto a Gennarino. Utile per capire cosa manca nella guida o cosa spiegare meglio."
    >
      {caricamento && <p className="text-sm text-slate-500">Caricamento...</p>}
      {!caricamento && domande.length === 0 && (
        <p className="text-sm text-slate-500">Nessuna domanda per ora.</p>
      )}

      <div className="flex flex-col gap-2">
        {domande.map((d) => (
          <button
            key={d.id}
            onClick={() => setAperta(aperta === d.id ? null : d.id)}
            className="bg-white border border-slate-200 shadow-sm rounded-xl p-3.5 text-left"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-900">
                {d.lang && d.lang !== 'it' && (
                  <span className="text-[10px] font-bold text-slate-400 border border-slate-300 rounded px-1 mr-1.5 align-middle">
                    {d.lang.toUpperCase()}
                  </span>
                )}
                {d.domanda}
              </p>
              <span className="text-xs text-slate-400 shrink-0 mt-0.5">{quando(d.creato_il)}</span>
            </div>
            {aperta === d.id && (
              <p className="text-xs text-slate-600 mt-2 whitespace-pre-line border-t border-slate-100 pt-2">
                {d.risposta}
              </p>
            )}
          </button>
        ))}
      </div>
    </PaginaAdmin>
  )
}
