import { useEffect, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import type { StrutturaRow } from './Struttura'
import { useSezioni } from './useSezioni'

type PaginaRow = {
  titolo: string
  contenuto: string
}

export default function PaginaStatica({ chiave }: { chiave: string }) {
  const struttura = useOutletContext<StrutturaRow>()
  const { slug } = useParams()
  const { tutte } = useSezioni()
  const [pagina, setPagina] = useState<PaginaRow | null>(null)
  const [caricamento, setCaricamento] = useState(true)

  const info = tutte.find((s) => s.chiave === chiave)

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
    <div className="g-page">
      <Link to={`/${slug}`} className="g-back">
        ← Torna alla home
      </Link>

      <div className="g-peek">
        <span className="p-emo">{info?.icona ?? '📄'}</span>
        <div>
          <div className="p-title">{pagina?.titolo || info?.etichetta || 'Pagina'}</div>
          {info?.descrizione && <div className="p-sub">{info.descrizione}</div>}
        </div>
      </div>

      {caricamento && <p className="g-hint">Caricamento...</p>}
      {!caricamento && !pagina && (
        <p className="g-hint">Contenuto non ancora inserito per questa pagina.</p>
      )}

      {!caricamento && pagina && <div className="g-prose">{pagina.contenuto}</div>}
    </div>
  )
}
