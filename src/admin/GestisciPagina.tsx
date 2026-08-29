import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function GestisciPagina({ chiave, etichetta }: { chiave: string; etichetta: string }) {
  const [titolo, setTitolo] = useState('')
  const [contenuto, setContenuto] = useState('')
  const [caricamento, setCaricamento] = useState(true)
  const [salvataggio, setSalvataggio] = useState(false)
  const [salvato, setSalvato] = useState(false)

  useEffect(() => {
    async function carica() {
      const { data: struttura } = await supabase
        .from('strutture')
        .select('id')
        .eq('slug', 'villavirginia')
        .single()

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
  }, [chiave, etichetta])

  async function salva() {
    setSalvataggio(true)
    setSalvato(false)

    const { data: struttura } = await supabase
      .from('strutture')
      .select('id')
      .eq('slug', 'villavirginia')
      .single()

    if (struttura) {
      await supabase
        .from('pagine')
        .upsert(
          { struttura_id: struttura.id, chiave, titolo, contenuto },
          { onConflict: 'struttura_id,chiave' }
        )
    }

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

      {salvato && <p className="text-sm text-green-600 mt-2 text-center">Salvato ✓</p>}
    </div>
  )
}