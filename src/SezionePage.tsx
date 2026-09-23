import { useEffect, useState } from 'react'
import { Link, useOutletContext, useParams, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import type { StrutturaRow } from './Struttura'
import { campoTradotto, T, useLingua } from './lingua'
import { etichettaSezione } from './sezioni'
import { useSezioni } from './useSezioni'
import { Icona } from './Icona'
import { ordinaPerDistanza } from './distanza'
import CreditoFoto from './CreditoFoto'
import { Map as IconaMappa, Phone } from 'lucide-react'

type LuogoRow = {
  id: string
  nome: string
  descrizione: string
  distanza: string
  maps: string
  telefono: string
  prezzo: string | null
  voto: string | null
  categoria: string | null
  foto_url: string | null
  foto_credito: string | null
  foto_credito_url: string | null
  traduzioni: Record<string, Record<string, string>> | null
}

export default function SezionePage() {
  const struttura = useOutletContext<StrutturaRow>()
  const { slug, sezione } = useParams()
  const { hash } = useLocation()
  const { tutte } = useSezioni()
  const { lingua } = useLingua()
  const [luoghi, setLuoghi] = useState<LuogoRow[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState(false)

  const info = tutte.find((s) => s.chiave === sezione)
  // Arrivando da "Oggi ti consiglio" (Home.tsx) il link porta a #luogo-<id>: una volta
  // caricato l'elenco, si scorre fino a quella scheda e la si evidenzia.
  const daEvidenziare = hash ? hash.slice(1) : null

  useEffect(() => {
    async function carica() {
      setCaricamento(true)
      setErrore(false)
      const { data, error } = await supabase
        .from('luoghi')
        .select('id, nome, descrizione, distanza, maps, telefono, prezzo, voto, categoria, foto_url, foto_credito, foto_credito_url, traduzioni')
        .eq('struttura_id', struttura.id)
        .eq('sezione', sezione)
        .eq('attivo', true)
        .order('ordine')

      if (error) {
        setErrore(true)
        setCaricamento(false)
        return
      }
      // Dal più vicino al più lontano, non nell'ordine di inserimento.
      setLuoghi(ordinaPerDistanza(data ?? [], (l) => l.distanza))
      setCaricamento(false)
    }
    carica()
  }, [struttura.id, sezione])

  useEffect(() => {
    if (!daEvidenziare || caricamento) return
    document.getElementById(daEvidenziare)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [daEvidenziare, caricamento])

  return (
    <div className="g-page">
      <Link to={`/${slug}`} className="g-back">
        ← {T[lingua].tornaHome}
      </Link>

      <div className="g-peek">
        <span className="p-emo"><Icona nome={info?.icona} /></span>
        <div>
          <div className="p-title">{info ? etichettaSezione(info, lingua) : sezione}</div>
          <div className="p-sub">{info?.descrizione || T[lingua].sottotitoloSezione}</div>
        </div>
      </div>

      {caricamento && <p className="g-hint">{T[lingua].caricamento}</p>}
      {!caricamento && errore && <p className="g-hint">{T[lingua].erroreCaricamento}</p>}
      {!caricamento && !errore && luoghi.length === 0 && <p className="g-hint">{T[lingua].sezioneVuota}</p>}

      {!errore && luoghi.map((l) => {
        const descrizione = campoTradotto(l.descrizione, l.traduzioni, 'descrizione', lingua)
        const categoria = campoTradotto(l.categoria, l.traduzioni, 'categoria', lingua)
        const distanza = campoTradotto(l.distanza, l.traduzioni, 'distanza', lingua)
        return (
          <div key={l.id} id={`luogo-${l.id}`} className={`g-place${daEvidenziare === `luogo-${l.id}` ? ' evidenziato' : ''}`}>
            {l.foto_url && <img src={l.foto_url} alt="" className="pl-foto" loading="lazy" />}
            {l.foto_url && <CreditoFoto credito={l.foto_credito} url={l.foto_credito_url} className="pl-credito" />}
            <div className="pl-content">
              <div className="pl-top">
                <span className="pl-name">{l.nome}</span>
                {l.prezzo && <span className="g-pill">{l.prezzo}</span>}
                {l.voto && <span className="g-pill rate">★ {l.voto}</span>}
              </div>
              {categoria && <div className="pl-cat">{categoria}</div>}
              {descrizione && <p className="pl-desc">{descrizione}</p>}

              {(distanza || l.maps || l.telefono) && (
                <div className="pl-meta">
                  {distanza && <span className="pl-dist">{distanza}</span>}
                  {l.maps && (
                    <a className="pl-act" href={l.maps} target="_blank" rel="noreferrer">
                      <IconaMappa size={14} /> {T[lingua].azMappa}
                    </a>
                  )}
                  {l.telefono && (
                    <a className="pl-act" href={`tel:${l.telefono}`}>
                      <Phone size={14} /> {T[lingua].azChiama}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
