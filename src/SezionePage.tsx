import { useEffect, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import type { StrutturaRow } from './Struttura'

type LuogoRow = {
  id: string
  nome: string
  descrizione: string
  distanza: string
}

export default function SezionePage() {
  const struttura = useOutletContext<StrutturaRow>()
  const { slug, sezione } = useParams()
  const [luoghi, setLuoghi] = useState<LuogoRow[]>([])
  const [caricamento, setCaricamento] = useState(true)

  useEffect(() => {
    async function carica() {
      const { data } = await supabase
        .from('luoghi')
        .select('id, nome, descrizione, distanza')
        .eq('struttura_id', struttura.id)
        .eq('sezione', sezione)
        .eq('attivo', true)
        .order('ordine')

      setLuoghi(data ?? [])
      setCaricamento(false)
    }
    carica()
  }, [struttura.id, sezione])

  return (
    <div className="p-6 max-w-md mx-auto">
      <Link to={`/${slug}`} className="text-sm text-blue-600">&larr; Torna alla home</Link>
      <h1 className="text-xl font-bold capitalize mt-2 mb-4">{sezione}</h1>

      {caricamento && <p>Caricamento...</p>}
      {!caricamento && luoghi.length === 0 && <p>Nessun contenuto ancora inserito qui.</p>}

      <div className="flex flex-col gap-3">
        {luoghi.map((l) => (
          <div key={l.id} className="bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold">{l.nome}</h2>
            {l.distanza && <p className="text-sm text-gray-500">{l.distanza}</p>}
            <p className="text-sm mt-1">{l.descrizione}</p>
          </div>
        ))}
      </div>
    </div>
  )
}