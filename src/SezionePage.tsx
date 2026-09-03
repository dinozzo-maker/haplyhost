import { useEffect, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import type { StrutturaRow } from './Struttura'
import { useSezioni } from './useSezioni'

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
}

export default function SezionePage() {
  const struttura = useOutletContext<StrutturaRow>()
  const { slug, sezione } = useParams()
  const { tutte } = useSezioni()
  const [luoghi, setLuoghi] = useState<LuogoRow[]>([])
  const [caricamento, setCaricamento] = useState(true)

  const info = tutte.find((s) => s.chiave === sezione)

  useEffect(() => {
    async function carica() {
      const { data } = await supabase
        .from('luoghi')
        .select('id, nome, descrizione, distanza, maps, telefono, prezzo, voto, categoria')
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
    <div className="g-page">
      <Link to={`/${slug}`} className="g-back">
        ← Torna alla home
      </Link>

      <div className="g-peek">
        <span className="p-emo">{info?.icona ?? '📍'}</span>
        <div>
          <div className="p-title">{info?.etichetta ?? sezione}</div>
          <div className="p-sub">{info?.descrizione || 'I posti che consigliamo agli ospiti'}</div>
        </div>
      </div>

      {caricamento && <p className="g-hint">Caricamento...</p>}
      {!caricamento && luoghi.length === 0 && (
        <p className="g-hint">Nessun contenuto ancora inserito qui.</p>
      )}

      {luoghi.map((l) => (
        <div key={l.id} className="g-place">
          <div className="pl-top">
            <span className="pl-name">{l.nome}</span>
            {l.prezzo && <span className="g-pill">{l.prezzo}</span>}
            {l.voto && <span className="g-pill rate">★ {l.voto}</span>}
          </div>
          {l.categoria && <div className="pl-cat">{l.categoria}</div>}
          {l.descrizione && <p className="pl-desc">{l.descrizione}</p>}

          {(l.distanza || l.maps || l.telefono) && (
            <div className="pl-meta">
              {l.distanza && <span className="pl-dist">{l.distanza}</span>}
              {l.maps && (
                <a className="pl-act" href={l.maps} target="_blank" rel="noreferrer">
                  🗺️ Mappa
                </a>
              )}
              {l.telefono && (
                <a className="pl-act" href={`tel:${l.telefono}`}>
                  📞 Chiama
                </a>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
