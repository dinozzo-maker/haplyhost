import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { ContestoHost } from './RichiedeLogin'
import { PaginaAdmin, Pulsante, Esito } from './ui'

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
  const [eliminazione, setEliminazione] = useState<string | null>(null)
  const [errore, setErrore] = useState('')

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

  async function elimina(id: string) {
    if (!window.confirm('Eliminare questa domanda e la relativa risposta? L\'operazione non si può annullare.')) return
    setErrore('')
    setEliminazione(id)
    const { error } = await supabase.from('domande').delete().eq('id', id)
    setEliminazione(null)
    if (error) {
      setErrore('Non sono riuscito a eliminare la domanda: ' + error.message)
      return
    }
    setDomande((precedenti) => precedenti.filter((d) => d.id !== id))
    if (aperta === id) setAperta(null)
  }

  async function eliminaTutte() {
    if (!struttura) return
    if (!window.confirm(`Eliminare tutte le ${domande.length} domande e risposte salvate? L'operazione non si può annullare.`)) return
    setErrore('')
    setEliminazione('tutte')
    const { error } = await supabase.from('domande').delete().eq('struttura_id', struttura.id)
    setEliminazione(null)
    if (error) {
      setErrore('Non sono riuscito a svuotare lo storico: ' + error.message)
      return
    }
    setDomande([])
    setAperta(null)
  }

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
      sottotitolo="Le domande rese anonime degli ospiti. Utili per capire cosa manca nella guida o cosa spiegare meglio."
    >
      {caricamento && <p className="text-sm text-slate-500">Caricamento...</p>}
      {!caricamento && domande.length === 0 && (
        <p className="text-sm text-slate-500">Nessuna domanda per ora.</p>
      )}
      {errore && <Esito ok={false}>{errore}</Esito>}

      {domande.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col gap-2">
          <p className="text-sm font-semibold text-amber-900">Gestione privacy</p>
          <p className="text-xs leading-relaxed text-amber-800">
            Email, telefoni, link e codici di prenotazione vengono rimossi prima del salvataggio.
            Il testo viene cancellato automaticamente dopo 90 giorni; puoi eliminarlo prima, una riga alla volta
            oppure tutto insieme. Le statistiche aggregate non contengono il testo delle conversazioni.
          </p>
          <Pulsante
            variante="pericolo"
            className="self-start"
            onClick={eliminaTutte}
            disabled={eliminazione !== null}
          >
            {eliminazione === 'tutte' ? 'Elimino lo storico...' : 'Cancella tutto lo storico'}
          </Pulsante>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {domande.map((d) => (
          <div key={d.id} className="bg-white border border-slate-200 shadow-sm rounded-xl p-3.5">
            <div className="flex items-start gap-2">
              <button
                onClick={() => setAperta(aperta === d.id ? null : d.id)}
                className="flex-1 min-w-0 text-left"
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
              </button>
              <Pulsante
                variante="pericolo"
                className="shrink-0"
                onClick={() => elimina(d.id)}
                disabled={eliminazione !== null}
              >
                {eliminazione === d.id ? '...' : 'Elimina'}
              </Pulsante>
            </div>
            {aperta === d.id && (
              <p className="text-xs text-slate-600 mt-2 whitespace-pre-line border-t border-slate-100 pt-2">
                {d.risposta}
              </p>
            )}
          </div>
        ))}
      </div>
    </PaginaAdmin>
  )
}
