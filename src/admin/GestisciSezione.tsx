import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

type LuogoRow = {
  id: string
  nome: string
  descrizione: string
  attivo: boolean
}

export default function GestisciSezione({ sezione, etichetta }: { sezione: string; etichetta: string }) {
  const [luoghi, setLuoghi] = useState<LuogoRow[]>([])
  const [caricamento, setCaricamento] = useState(true)

  useEffect(() => {
    async function carica() {
      const { data: struttura } = await supabase
        .from('strutture')
        .select('id')
        .eq('slug', 'villavirginia')
        .single()

      if (!struttura) { setCaricamento(false); return }

      const { data } = await supabase
        .from('luoghi')
        .select('id, nome, descrizione, attivo')
        .eq('struttura_id', struttura.id)
        .eq('sezione', sezione)
        .order('ordine')

      setLuoghi(data ?? [])
      setCaricamento(false)
    }
    carica()
  }, [sezione])

  async function toggle(id: string, nuovoValore: boolean) {
    setLuoghi(luoghi.map(l => l.id === id ? { ...l, attivo: nuovoValore } : l))
    await supabase.from('luoghi').update({ attivo: nuovoValore }).eq('id', id)
  }

  return (
    <div className="max-w-sm mx-auto p-6">
      <Link to="/admin" className="text-sm text-blue-600">&larr; Torna al pannello</Link>
      <h1 className="text-xl font-bold mt-2 mb-4">Gestisci {etichetta}</h1>

      {caricamento && <p>Caricamento...</p>}

      <div className="flex flex-col gap-2">
        {luoghi.map((l) => (
          <div key={l.id} className="bg-white shadow rounded-xl p-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-sm">{l.nome}</p>
              <p className="text-xs text-gray-500 line-clamp-1">{l.descrizione}</p>
            </div>
            <input
              type="checkbox"
              checked={l.attivo}
              onChange={(e) => toggle(l.id, e.target.checked)}
              className="w-5 h-5 accent-blue-600 shrink-0"
            />
          </div>
        ))}
      </div>
    </div>
  )
}