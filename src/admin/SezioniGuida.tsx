import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { SEZIONI } from '../sezioni'
import type { Sezione } from '../sezioni'
import type { ContestoHost } from './RichiedeLogin'

// In Fase 1 le sezioni disponibili sono solo quelle di sistema. In Fase 2 questa
// lista diventerà SEZIONI + sezioni custom caricate dal DB.
const sezioniDisponibili: Sezione[] = SEZIONI

const GRUPPI: { titolo: string; tipo: Sezione['tipo'] }[] = [
  { titolo: 'ELENCHI', tipo: 'elenco' },
  { titolo: 'PAGINE DI TESTO', tipo: 'testo' },
  { titolo: 'CONCIERGE', tipo: 'chat' },
]

export default function SezioniGuida() {
  const { struttura } = useOutletContext<ContestoHost>()

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
      // null = tutte attive
      setAttive(new Set(salvate ?? sezioniDisponibili.map((s) => s.chiave)))
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
    setSalvato(true)
  }

  if (!struttura) {
    return (
      <div className="max-w-sm mx-auto p-6">
        <Link to="/admin" className="text-sm text-blue-600">&larr; Torna al pannello</Link>
        <p className="mt-4 text-sm">Non hai ancora una struttura.</p>
      </div>
    )
  }

  if (caricamento) return <p className="p-6 text-center">Caricamento...</p>

  return (
    <div className="max-w-sm mx-auto p-6">
      <Link to="/admin" className="text-sm text-blue-600">&larr; Torna al pannello</Link>
      <h1 className="text-xl font-bold mt-2 mb-1">Sezioni della guida</h1>
      <p className="text-sm text-gray-500 mb-4">
        Scegli quali sezioni compaiono nella guida degli ospiti. Quelle spente restano gestibili
        dal pannello, ma l'ospite non le vede.
      </p>

      {GRUPPI.map((g) => {
        const items = sezioniDisponibili.filter((s) => s.tipo === g.tipo)
        if (items.length === 0) return null
        return (
          <div key={g.tipo} className="mb-5">
            <p className="text-xs font-medium text-gray-400 mb-2">{g.titolo}</p>
            <div className="flex flex-col gap-2">
              {items.map((s) => (
                <label key={s.chiave} className="bg-white shadow rounded-xl p-3 flex items-start justify-between gap-3 cursor-pointer">
                  <span className="min-w-0">
                    <span className="text-sm font-medium">{s.icona} {s.etichetta}</span>
                    {s.descrizione && <span className="block text-xs text-gray-500 mt-0.5">{s.descrizione}</span>}
                  </span>
                  <input
                    type="checkbox"
                    checked={attive.has(s.chiave)}
                    onChange={() => toggle(s.chiave)}
                    className="w-5 h-5 accent-blue-600 shrink-0 mt-0.5"
                  />
                </label>
              ))}
            </div>
          </div>
        )
      })}

      <button
        onClick={salva}
        disabled={salvataggio}
        className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm disabled:opacity-50"
      >
        {salvataggio ? 'Salvo...' : 'Salva'}
      </button>
      {salvato && <p className="text-sm text-green-600 mt-2 text-center">Salvato ✓</p>}
      {errore && <p className="text-red-600 text-sm mt-2">{errore}</p>}
    </div>
  )
}
