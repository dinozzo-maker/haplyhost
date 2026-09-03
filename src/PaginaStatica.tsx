import { useEffect, useState } from 'react'
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

  // Tasti "WhatsApp" / "Chiama" sotto il testo: sulla pagina Contatti, o quando il
  // testo nomina WhatsApp o il telefono. Servono host_telefono valorizzato.
  const tel = (struttura.host_telefono ?? '').trim()
  const waNumero = tel.replace(/\D/g, '')
  const telHref = tel.replace(/[^\d+]/g, '')
  const testoBasso = contenuto.toLowerCase()
  const nominaContatto =
    /whatsapp/i.test(contenuto) || FRASI_TELEFONO[lingua].some((f) => testoBasso.includes(f))
  const mostraTasti = tel && (chiave === 'contatti' || nominaContatto)

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
      {!caricamento && pagina && <div className="g-prose">{contenuto}</div>}

      {mostraTasti && (
        <div className="g-contatti">
          {waNumero && (
            <a className="g-btn-wa" href={`https://wa.me/${waNumero}`} target="_blank" rel="noreferrer">
              💬 WhatsApp
            </a>
          )}
          <a className="g-btn-tel" href={`tel:${telHref}`}>
            📞 {T[lingua].azChiama}
          </a>
        </div>
      )}
    </div>
  )
}
