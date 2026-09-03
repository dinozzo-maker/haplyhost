import { useEffect, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import type { StrutturaRow } from './Struttura'
import { campoTradotto, T, useLingua } from './lingua'
import { etichettaSezione } from './sezioni'
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
  traduzioni: Record<string, Record<string, string>> | null
}

export default function SezionePage() {
  const struttura = useOutletContext<StrutturaRow>()
  const { slug, sezione } = useParams()
  const { tutte } = useSezioni()
  const { lingua } = useLingua()
  const [luoghi, setLuoghi] = useState<LuogoRow[]>([])
  const [caricamento, setCaricamento] = useState(true)

  const info = tutte.find((s) => s.chiave === sezione)

  useEffect(() => {
    async function carica() {
      const { data } = await supabase
        .from('luoghi')
        .select('id, nome, descrizione, distanza, maps, telefono, prezzo, voto, categoria, traduzioni')
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
        ← {T[lingua].tornaHome}
      </Link>

      <div className="g-peek">
        <span className="p-emo">{info?.icona ?? '📍'}</span>
        <div>
          <div className="p-title">{info ? etichettaSezione(info, lingua) : sezione}</div>
          <div className="p-sub">{info?.descrizione || T[lingua].sottotitoloSezione}</div>
        </div>
      </div>

      {caricamento && <p className="g-hint">{T[lingua].caricamento}</p>}
      {!caricamento && luoghi.length === 0 && <p className="g-hint">{T[lingua].sezioneVuota}</p>}

      {luoghi.map((l) => {
        const descrizione = campoTradotto(l.descrizione, l.traduzioni, 'descrizione', lingua)
        const categoria = campoTradotto(l.categoria, l.traduzioni, 'categoria', lingua)
        const distanza = campoTradotto(l.distanza, l.traduzioni, 'distanza', lingua)
        return (
          <div key={l.id} className="g-place">
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
                    🗺️ {T[lingua].azMappa}
                  </a>
                )}
                {l.telefono && (
                  <a className="pl-act" href={`tel:${l.telefono}`}>
                    📞 {T[lingua].azChiama}
                  </a>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
