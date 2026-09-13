import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import type { StrutturaRow } from './Struttura'
import { etichettaSezione, filtraVisibili } from './sezioni'
import { campoTradotto, saluto, T, useLingua } from './lingua'
import SelettoreLingua from './SelettoreLingua'
import { useSezioni } from './useSezioni'
import { Icona } from './Icona'
import Meteo from './Meteo'
import { MessageCircle, ChevronRight } from 'lucide-react'

type LuogoPick = {
  id: string
  nome: string
  descrizione: string | null
  sezione: string
  traduzioni: Record<string, Record<string, string>> | null
}

export default function Home() {
  const struttura = useOutletContext<StrutturaRow>()
  const { slug } = useParams()
  const { tutte } = useSezioni()
  const { lingua } = useLingua()
  const [pick, setPick] = useState<LuogoPick | null>(null)

  // La chat vive nella barra in basso / nella FAB / nella nuova scorciatoia "Chiedi a
  // Gennarino" qui sotto, non tra le tessere.
  const visibili = filtraVisibili(tutte, struttura.sezioni_attive)
  const tessere = visibili.filter((s) => s.tipo !== 'chat')
  const chat = visibili.find((s) => s.tipo === 'chat')
  const chiaviTessere = tessere.map((s) => s.chiave).sort().join(',')

  // "Oggi ti consiglio": un luogo tra i meglio votati delle sezioni visibili, senza
  // nessuna chiamata AI — ruota una volta al giorno (giorni dall'epoch % candidati),
  // non ad ogni apertura della guida. Il "consiglio del giorno" con l'AI era stato
  // tolto per costo (vedi CLAUDE.md, incidente 31/08/2026): questo lo evita del tutto.
  useEffect(() => {
    let vivo = true
    async function carica() {
      const { data } = await supabase
        .from('luoghi')
        .select('id, nome, descrizione, sezione, voto, traduzioni')
        .eq('struttura_id', struttura.id)
        .eq('attivo', true)
        .not('voto', 'is', null)
      if (!vivo) return
      const visibiliOra = new Set(chiaviTessere.split(','))
      const candidati = (data ?? [])
        .filter((l) => visibiliOra.has(l.sezione))
        .sort((a, b) => Number(String(b.voto).replace(',', '.')) - Number(String(a.voto).replace(',', '.')))
        .slice(0, 5)
      const giorno = Math.floor(Date.now() / 86_400_000)
      setPick(candidati.length ? candidati[giorno % candidati.length] : null)
    }
    if (struttura.id && chiaviTessere) carica()
    return () => {
      vivo = false
    }
  }, [struttura.id, chiaviTessere])

  const heroStile: CSSProperties | undefined = struttura.copertina_url
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(15,30,40,.05), rgba(15,30,40,.55)), url(${struttura.copertina_url})`,
      }
    : undefined

  const descrizionePick = pick ? campoTradotto(pick.descrizione, pick.traduzioni, 'descrizione', lingua) : ''
  const sezionePick = tessere.find((s) => s.chiave === pick?.sezione)

  return (
    <div className="g-page">
      <div className="g-hero" style={heroStile}>
        <Meteo lat={struttura.lat} lng={struttura.lng} />
        <span className="welcome">{saluto(T[lingua])}</span>
        <p className="name">{struttura.nome}</p>
        <span className="sub">
          {struttura.citta ? `${struttura.citta} — ` : ''}
          {T[lingua].heroSub}
        </span>
      </div>

      <SelettoreLingua />

      {chat && (
        <Link to={`/${slug}/${chat.chiave}`} className="g-ask">
          <span className="a-icon">
            <MessageCircle className="w-5 h-5" />
          </span>
          <span className="a-body">
            <span className="a-title">{T[lingua].chiediAGennarino}</span>
            <span className="a-sub">{T[lingua].chiediAGennarinoSub}</span>
          </span>
          <ChevronRight className="w-4 h-4 a-arrow" />
        </Link>
      )}

      {pick && (
        <Link to={`/${slug}/${pick.sezione}`} className="g-today">
          <span className="t-badge">
            <Icona nome={sezionePick?.icona} />
          </span>
          <span className="t-body">
            <span className="t-eyebrow">{T[lingua].oggiTiConsiglio}</span>
            <span className="t-name">{pick.nome}</span>
            {descrizionePick && <span className="t-desc">{descrizionePick}</span>}
          </span>
        </Link>
      )}

      <p className="g-section-label">{T[lingua].esplora}</p>
      <div className="g-grid">
        {tessere.map((s) => (
          <Link key={s.chiave} to={`/${slug}/${s.chiave}`} className="g-tile">
            <span className="emo">
              <Icona nome={s.icona} />
            </span>
            <span className="lbl">{etichettaSezione(s, lingua)}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
