import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { ContestoHost } from './RichiedeLogin'

export default function GestisciPagina({ chiave, etichetta }: { chiave: string; etichetta: string }) {
  const { struttura } = useOutletContext<ContestoHost>()
  const [titolo, setTitolo] = useState('')
  const [contenuto, setContenuto] = useState('')
  const [caricamento, setCaricamento] = useState(true)
  const [salvataggio, setSalvataggio] = useState(false)
  const [salvato, setSalvato] = useState(false)

  useEffect(() => {
    async function carica() {
      if (!struttura) { setCaricamento(false); return }

      const { data } = await supabase
        .from('pagine')
        .select('titolo, contenuto')
        .eq('struttura_id', struttura.id)
        .eq('chiave', chiave)
        .maybeSingle()

      setTitolo(data?.titolo ?? etichetta)
      setContenuto(data?.contenuto ?? '')
      setCaricamento(false)
    }
    carica()
  }, [chiave, etichetta, struttura])

  async function salva() {
    if (!struttura) return
    setSalvataggio(true)
    setSalvato(false)

    await supabase
      .from('pagine')
      .upsert(
        // da_tradurre: il testo è cambiato, le traduzioni EN/FR/DE/ES vanno rifatte
        { struttura_id: struttura.id, chiave, titolo, contenuto, da_tradurre: true },
        { onConflict: 'struttura_id,chiave' }
      )

    setSalvataggio(false)
    setSalvato(true)
  }

  if (caricamento) return <p className="p-6 text-center">Caricamento...</p>

  return (
    <div className="max-w-sm mx-auto p-6">
      <Link to="/admin" className="text-sm text-blue-600">&larr; Torna al pannello</Link>
      <h1 className="text-xl font-bold mt-2 mb-4">Modifica {etichetta}</h1>

      <label className="text-xs text-gray-500">Titolo</label>
      <input
        className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
        value={titolo}
        onChange={(e) => { setTitolo(e.target.value); setSalvato(false) }}
      />

      <label className="text-xs text-gray-500">Testo</label>
      <textarea
        className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
        rows={16}
        value={contenuto}
        onChange={(e) => { setContenuto(e.target.value); setSalvato(false) }}
      />

      <button
        onClick={salva}
        disabled={salvataggio}
        className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm disabled:opacity-50"
      >
        {salvataggio ? 'Salvo...' : 'Salva'}
      </button>

      {salvato && (
        <p className="text-sm text-green-600 mt-2 text-center">
          Salvato ✓ — poi rilancia <Link to="/admin/traduzioni" className="underline">Traduzioni della guida</Link>
        </p>
      )}
    </div>
  )
}