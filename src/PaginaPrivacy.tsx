import { Link, useParams } from 'react-router-dom'
import { T, useLingua } from './lingua'
import { PRIVACY } from './privacy'
import SelettoreLingua from './SelettoreLingua'

export default function PaginaPrivacy() {
  const { slug } = useParams()
  const { lingua } = useLingua()
  const testi = PRIVACY[lingua]
  return (
    <div className="g-page">
      <Link to={`/${slug}`} className="g-back">← {T[lingua].tornaHome}</Link>
      <SelettoreLingua />
      <h1 className="text-2xl font-bold mb-4">{testi.titolo}</h1>
      <p className="g-hint">{testi.avviso}</p>
      {testi.sezioni.map((sezione) => (
        <section key={sezione.titolo} className="mb-5">
          <h2 className="text-lg font-bold mb-2">{sezione.titolo}</h2>
          <p className="text-sm leading-relaxed">{sezione.testo}</p>
        </section>
      ))}
    </div>
  )
}
