import { useEffect, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import type { StrutturaRow } from './Struttura'

type PaginaRow = {
  titolo: string
  contenuto: string
}

export default function PaginaStatica({ chiave }: { chiave: string }) {
  const struttura = useOutletContext<StrutturaRow>()
  const { slug } = useParams()
  const [pagina, setPagina] = useState<PaginaRow | null>(null)
  const [caricamento, setCaricamento] = useState(true)

  useEffect(() => {
    async function carica() {
      const { data } = await supabase
        .from('pagine')
        .select('titolo, contenuto')
        .eq('struttura_id', struttura.id)
        .eq('chiave', chiave)
        .maybeSingle()

      setPagina(data)
      setCaricamento(false)
    }
    carica()
  }, [struttura.id, chiave])

  return (
    <div className="max-w-sm mx-auto p-6">
      <Link to={`/${slug}`} className="text-sm text-blue-600">&larr; Torna alla home</Link>

      {caricamento && <p className="mt-4">Caricamento...</p>}
      {!caricamento && !pagina && <p className="mt-4">Contenuto non ancora inserito per questa pagina.</p>}

      {!caricamento && pagina && (
        <>
          <h1 className="text-xl font-bold mt-2 mb-4">{pagina.titolo}</h1>
          <div className="whitespace-pre-line text-sm leading-relaxed">{pagina.contenuto}</div>
        </>
      )}
    </div>
  )
}