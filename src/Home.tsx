import type { CSSProperties, FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import type { StrutturaRow } from './Struttura'
import { etichettaSezione, filtraVisibili } from './sezioni'
import { campoTradotto, saluto, T, useLingua } from './lingua'
import SelettoreLingua from './SelettoreLingua'
import { useSezioni } from './useSezioni'
import { Icona } from './Icona'
import Meteo from './Meteo'
import { PRIVACY } from './privacy'
import { MessageCircle, Send, Wifi, House, ArrowRight } from 'lucide-react'
import { TESTI_HOME } from './testiHome'
import CreditoFoto from './CreditoFoto'
import Benvenuto from './Benvenuto'

type LuogoPick = {
  id: string
  nome: string
  descrizione: string | null
  sezione: string
  foto_url: string | null
  foto_credito: string | null
  traduzioni: Record<string, Record<string, string>> | null
}

export default function Home() {
  const struttura = useOutletContext<StrutturaRow>()
  const { slug } = useParams()
  const navigate = useNavigate()
  const { hash } = useLocation()
  const { tutte } = useSezioni()
  const { lingua } = useLingua()
  const [pick, setPick] = useState<LuogoPick | null>(null)
  const [domanda, setDomanda] = useState('')
  const testi = TESTI_HOME[lingua]
  const numeroWhatsApp = (struttura.host_telefono ?? '').replace(/\D/g, '')

  useEffect(() => {
    if (hash === '#esplora') document.getElementById('esplora')?.scrollIntoView({ block: 'start' })
  }, [hash])

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
        .select('id, nome, descrizione, sezione, voto, foto_url, foto_credito, traduzioni')
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

  // Scrivere qui ed inviare porta già dentro la chat con la domanda in corso, invece di
  // limitarsi ad aprirla vuota: Gennarino diventa il modo diretto di usare la guida, non
  // solo una sezione tra le altre.
  function chiediSubito(testo: string) {
    const domandaPulita = testo.trim()
    if (!domandaPulita || !chat) return
    navigate(`/${slug}/${chat.chiave}`, { state: { domandaIniziale: domandaPulita } })
  }

  function inviaDomanda(e: FormEvent) {
    e.preventDefault()
    chiediSubito(domanda)
  }

  return (
    <div className="g-page g-home">
      <div className="g-hero" style={heroStile}>
        <Meteo lat={struttura.lat} lng={struttura.lng} />
        <span className="welcome">{saluto(T[lingua])}</span>
        <h1 className="name">{struttura.nome}</h1>
        <span className="sub">
          {struttura.citta ? `${struttura.citta} — ` : ''}
          {T[lingua].heroSub}
        </span>
      </div>

      <SelettoreLingua />

      <Benvenuto slug={slug ?? ''} orarioCheckin={struttura.checkin} orarioCheckout={struttura.checkout} />

      <div className="g-quick">
        {visibili.some((s) => s.chiave === 'casa') && <>
          <Link to={`/${slug}/casa`}><Wifi aria-hidden="true" /><span>Wi-Fi</span></Link>
          <Link to={`/${slug}/casa`}><House aria-hidden="true" /><span>{testi.casa}</span></Link>
        </>}
        {numeroWhatsApp && <a className="q-whatsapp" href={`https://wa.me/${numeroWhatsApp}`} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" /><span>{testi.whatsapp}</span></a>}
      </div>

      <div className="g-home-featured">
      {chat && (
        <div className="g-ask">
          <span className="a-title">
            <MessageCircle className="w-4 h-4" /> {T[lingua].chiediAGennarino}
          </span>
          <h2 className="a-heading">{testi.titolo}</h2>
          <p className="a-subtitle">{testi.sottotitolo}</p>
          <form onSubmit={inviaDomanda} className="a-composer">
            <input
              value={domanda}
              maxLength={1500}
              onChange={(e) => setDomanda(e.target.value)}
              placeholder={T[lingua].chiediPlaceholder}
              aria-label={T[lingua].chiediPlaceholder}
            />
            <button type="submit" disabled={!domanda.trim()} aria-label={T[lingua].gennarinoInvia}>
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="a-chips">
            {testi.suggerimenti.map((s) => (
              <button key={s} type="button" onClick={() => chiediSubito(s)}>
                {s}
              </button>
            ))}
          </div>
          <p className="text-xs leading-relaxed mt-3">{PRIVACY[lingua].breve} <Link className="underline" to={`/${slug}/privacy`}>{PRIVACY[lingua].titolo}</Link></p>
        </div>
      )}

      {pick && sezionePick && (
        <Link to={`/${slug}/${pick.sezione}#luogo-${pick.id}`} className="g-today">
          {pick.foto_url && <img className="t-photo" src={pick.foto_url} alt="" loading="lazy" onError={(e) => { e.currentTarget.hidden = true }} />}
          <span className="t-badge">
            <Icona nome={sezionePick?.icona} />
          </span>
          <span className="t-body">
            <span className="t-eyebrow">{T[lingua].oggiTiConsiglio}</span>
            <span className="t-name">{pick.nome}</span>
            {descrizionePick && <span className="t-desc">{descrizionePick}</span>}
            {pick.foto_url && <CreditoFoto credito={pick.foto_credito} url={null} senzaLink className="t-credito" />}
            <span className="t-action">{testi.scopri} <ArrowRight size={16} aria-hidden="true" /></span>
          </span>
        </Link>
      )}
      </div>

      <h2 id="esplora" className="g-section-label">{T[lingua].esplora}</h2>
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
      <Link className="g-home-privacy" to={`/${slug}/privacy`}>{PRIVACY[lingua].titolo}</Link>
    </div>
  )
}
