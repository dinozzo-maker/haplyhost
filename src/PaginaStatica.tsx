import { Fragment, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import type { StrutturaRow } from './Struttura'
import { campoTradotto, FRASI_TELEFONO, T, useLingua } from './lingua'
import { etichettaSezione } from './sezioni'
import { useSezioni } from './useSezioni'

type PaginaRow = {
  titolo: string
  contenuto: string
  traduzioni: Record<string, Record<string, string>> | null
}

export default function PaginaStatica({ chiave }: { chiave: string }) {
  const struttura = useOutletContext<StrutturaRow>()
  const { slug } = useParams()
  const { tutte } = useSezioni()
  const { lingua } = useLingua()
  const [pagina, setPagina] = useState<PaginaRow | null>(null)
  const [caricamento, setCaricamento] = useState(true)

  const info = tutte.find((s) => s.chiave === chiave)

  useEffect(() => {
    async function carica() {
      const { data } = await supabase
        .from('pagine')
        .select('titolo, contenuto, traduzioni')
        .eq('struttura_id', struttura.id)
        .eq('chiave', chiave)
        .maybeSingle()

      setPagina(data)
      setCaricamento(false)
    }
    carica()
  }, [struttura.id, chiave])

  const titolo =
    campoTradotto(pagina?.titolo, pagina?.traduzioni, 'titolo', lingua) ||
    (info ? etichettaSezione(info, lingua) : chiave)
  const contenuto = campoTradotto(pagina?.contenuto, pagina?.traduzioni, 'contenuto', lingua)

  // Rende cliccabili "WhatsApp" (→ wa.me) e le frasi tipo "al telefono" (→ tel:)
  // dentro il testo della pagina, se la struttura ha un telefono host.
  const tel = (struttura.host_telefono ?? '').trim()
  const waNumero = tel.replace(/\D/g, '')
  const telHref = tel.replace(/[^\d+]/g, '')

  function conLink(testo: string): ReactNode {
    if (!tel || !testo) return testo
    const frasi = FRASI_TELEFONO[lingua]
    const alternative = ['WhatsApp', ...frasi].map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const re = new RegExp(`(${alternative.join('|')})`, 'gi')
    return testo.split(re).map((p, i) => {
      const low = p.toLowerCase()
      if (low === 'whatsapp' && waNumero) {
        return (
          <a key={i} className="g-link" href={`https://wa.me/${waNumero}`} target="_blank" rel="noreferrer">
            {p}
          </a>
        )
      }
      if (frasi.includes(low)) {
        return (
          <a key={i} className="g-link" href={`tel:${telHref}`}>
            {p}
          </a>
        )
      }
      return <Fragment key={i}>{p}</Fragment>
    })
  }

  return (
    <div className="g-page">
      <Link to={`/${slug}`} className="g-back">
        ← {T[lingua].tornaHome}
      </Link>

      <div className="g-peek">
        <span className="p-emo">{info?.icona ?? '📄'}</span>
        <div>
          <div className="p-title">{titolo}</div>
          {info?.descrizione && <div className="p-sub">{info.descrizione}</div>}
        </div>
      </div>

      {caricamento && <p className="g-hint">{T[lingua].caricamento}</p>}
      {!caricamento && !pagina && <p className="g-hint">{T[lingua].paginaVuota}</p>}
      {!caricamento && pagina && <div className="g-prose">{conLink(contenuto)}</div>}
    </div>
  )
}
