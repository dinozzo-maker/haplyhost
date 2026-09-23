import { useLingua, saluto, T } from './lingua'
import { TESTI_BENVENUTO } from './testiBenvenuto'
import { useSoggiorno } from './useSoggiorno'

// Benvenuto in cima alla home. Con il link personale del soggiorno: saluto col nome
// dell'ospite e le SUE date di check-in/check-out (il messaggio cambia prima, durante e
// dopo il soggiorno). Senza link: solo gli orari standard della casa, se l'host li ha
// scritti in "Dati della casa" — niente nome né date, la guida resta anonima.
// Gli orari sono testo libero scritto dall'host ("15:00", "dalle 15"): si mostrano come sono.
export default function Benvenuto({
  slug,
  orarioCheckin,
  orarioCheckout,
}: {
  slug: string
  orarioCheckin: string | null
  orarioCheckout: string | null
}) {
  const { lingua } = useLingua()
  const { soggiorno, caricamento } = useSoggiorno(slug)
  const t = TESTI_BENVENUTO[lingua]
  const oraIn = (orarioCheckin ?? '').trim()
  const oraOut = (orarioCheckout ?? '').trim()

  if (caricamento) return null

  const giorno = (data: string) =>
    new Date(`${data}T12:00:00`).toLocaleDateString(lingua, { weekday: 'long', day: 'numeric', month: 'long' })

  if (!soggiorno) {
    if (!oraIn && !oraOut) return null
    return (
      <div className="g-benvenuto">
        <div className="b-date">
          {oraIn && <div className="b-data"><span className="b-eti">{t.checkin}</span><span className="b-val">{oraIn}</span></div>}
          {oraOut && <div className="b-data"><span className="b-eti">{t.checkout}</span><span className="b-val">{oraOut}</span></div>}
        </div>
      </div>
    )
  }

  if (soggiorno.stato === 'scaduto') {
    return (
      <div className="g-benvenuto">
        <div className="b-titolo">{t.graziePerIlSoggiorno(soggiorno.nome)}</div>
        <p className="b-sub">{t.graziePerIlSoggiornoSub}</p>
      </div>
    )
  }

  return (
    <div className="g-benvenuto">
      <div className="b-titolo">{saluto(T[lingua])}, {soggiorno.nome}!</div>
      <p className="b-sub">
        {soggiorno.stato === 'presto' ? t.presto(giorno(soggiorno.checkin)) : t.inCorso(giorno(soggiorno.checkout))}
      </p>
      <div className="b-date">
        <div className="b-data">
          <span className="b-eti">{t.checkin}</span>
          <span className="b-val">{giorno(soggiorno.checkin)}</span>
          {oraIn && <span className="b-ora">{oraIn}</span>}
        </div>
        <div className="b-data">
          <span className="b-eti">{t.checkout}</span>
          <span className="b-val">{giorno(soggiorno.checkout)}</span>
          {oraOut && <span className="b-ora">{oraOut}</span>}
        </div>
      </div>
    </div>
  )
}
