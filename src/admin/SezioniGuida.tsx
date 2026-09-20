import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { SEZIONI } from '../sezioni'
import type { Sezione } from '../sezioni'
import { useSezioni } from '../useSezioni'
import type { ContestoHost } from './RichiedeLogin'
import { Icona } from '../Icona'
import { PaginaAdmin, Pulsante, Esito } from './ui'

const GRUPPI: { titolo: string; tipo: Sezione['tipo'] }[] = [
  { titolo: 'ELENCHI', tipo: 'elenco' },
  { titolo: 'PAGINE DI TESTO', tipo: 'testo' },
  { titolo: 'CONCIERGE', tipo: 'chat' },
]

export default function SezioniGuida() {
  const { struttura, aggiornaSezioniAttive } = useOutletContext<ContestoHost>()
  const { tutte: sezioniDisponibili } = useSezioni()

  const [attive, setAttive] = useState<Set<string>>(new Set())
  const [caricamento, setCaricamento] = useState(true)
  const [salvataggio, setSalvataggio] = useState(false)
  const [salvato, setSalvato] = useState(false)
  const [errore, setErrore] = useState('')

  useEffect(() => {
    async function carica() {
      if (!struttura) {
        setCaricamento(false)
        return
      }
      const { data, error } = await supabase
        .from('strutture')
        .select('sezioni_attive')
        .eq('id', struttura.id)
        .single()

      if (error) {
        setErrore('Non riesco a caricare le impostazioni.')
        setCaricamento(false)
        return
      }

      const salvate: string[] | null = data?.sezioni_attive ?? null
      // null = tutte le sezioni di sistema attive; le custom partono spente.
      setAttive(new Set(salvate ?? SEZIONI.map((s) => s.chiave)))
      setCaricamento(false)
    }
    carica()
  }, [struttura])

  function toggle(chiave: string) {
    setSalvato(false)
    setAttive((prev) => {
      const next = new Set(prev)
      if (next.has(chiave)) next.delete(chiave)
      else next.add(chiave)
      return next
    })
  }

  async function salva() {
    if (!struttura) return
    setSalvataggio(true)
    setSalvato(false)
    setErrore('')

    const { error } = await supabase
      .from('strutture')
      .update({ sezioni_attive: [...attive] })
      .eq('id', struttura.id)

    setSalvataggio(false)
    if (error) {
      setErrore('Errore nel salvataggio: ' + error.message)
      return
    }
    aggiornaSezioniAttive([...attive])
    setSalvato(true)
  }

  if (!struttura) {
    return (
      <PaginaAdmin titolo="Sezioni della guida">
        <p className="text-sm text-slate-500">Non hai ancora una struttura.</p>
      </PaginaAdmin>
    )
  }

  if (caricamento) return <p className="p-6 text-center text-sm text-slate-500">Caricamento...</p>

  return (
    <PaginaAdmin
      titolo="Sezioni della guida"
      sottotitolo="Scegli quali sezioni compaiono nella guida degli ospiti. Quelle spente restano gestibili dal pannello, ma l'ospite non le vede."
    >
      {GRUPPI.map((g) => {
        const items = sezioniDisponibili.filter((s) => s.tipo === g.tipo)
        if (items.length === 0) return null
        return (
          <div key={g.tipo} className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{g.titolo}</p>
            <div className="flex flex-col gap-2">
              {items.map((s) => (
                <label key={s.chiave} className="bg-white border border-slate-200 shadow-sm rounded-xl p-3.5 flex items-start justify-between gap-3 cursor-pointer">
                  <span className="min-w-0">
                    <span className="text-sm font-medium text-slate-900 inline-flex items-center gap-1.5">
                      <Icona nome={s.icona} className="w-4 h-4 shrink-0 text-slate-500" /> {s.etichetta}
                    </span>
                    {s.descrizione && <span className="block text-xs text-slate-500 mt-0.5">{s.descrizione}</span>}
                  </span>
                  <input
                    type="checkbox"
                    checked={attive.has(s.chiave)}
                    onChange={() => toggle(s.chiave)}
                    className="w-5 h-5 accent-slate-900 shrink-0 mt-0.5"
                  />
                </label>
              ))}
            </div>
          </div>
        )
      })}

      <div className="flex flex-col gap-2">
        <Pulsante onClick={salva} disabled={salvataggio}>
          {salvataggio ? 'Salvo...' : 'Salva'}
        </Pulsante>
        {salvato && <Esito ok>Salvato ✓</Esito>}
        {errore && <Esito ok={false}>{errore}</Esito>}
      </div>
    </PaginaAdmin>
  )
}
