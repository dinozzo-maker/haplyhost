import type { CSSProperties } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import type { StrutturaRow } from './Struttura'
import { filtraVisibili } from './sezioni'
import { useSezioni } from './useSezioni'

export default function Home() {
  const struttura = useOutletContext<StrutturaRow>()
  const { slug } = useParams()
  const { tutte } = useSezioni()

  // La chat vive nella barra in basso / nella FAB, non tra le tessere.
  const tessere = filtraVisibili(tutte, struttura.sezioni_attive).filter((s) => s.tipo !== 'chat')

  const heroStile: CSSProperties | undefined = struttura.copertina_url
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(15,30,40,.05), rgba(15,30,40,.55)), url(${struttura.copertina_url})`,
      }
    : undefined

  return (
    <div className="g-page">
      <div className="g-hero" style={heroStile}>
        <span className="welcome">Benvenuti in</span>
        <p className="name">{struttura.nome}</p>
        <span className="sub">
          {struttura.citta ? `${struttura.citta} — ` : ''}tutto quello che serve per il tuo soggiorno
        </span>
      </div>

      <div className="g-grid">
        {tessere.map((s) => (
          <Link key={s.chiave} to={`/${slug}/${s.chiave}`} className="g-tile">
            <span className="emo">{s.icona}</span>
            <span className="lbl">{s.etichetta}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
