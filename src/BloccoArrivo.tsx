import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { useLingua } from './lingua'
import { TESTI_ARRIVO } from './testiArrivo'
import { leggiTokenSoggiorno } from './soggiornoOspite'

type Risposta =
  | { stato: 'in_corso'; testo: string }
  | { stato: 'presto'; checkin: string; presente: boolean }
  | { stato: 'scaduto' }
  | { stato: 'non_valido' }

// «Come entrare» nella pagina Casa & Wi-Fi: le istruzioni di arrivo RISERVATE scritte dall'host
// (codice porta o cassetta chiavi, parcheggio…). Come il Wi-Fi, il testo non è mai nella pagina
// pubblica: lo chiede a /api/ospite?azione=arrivo con il token del soggiorno e il server lo dà solo
// dal giorno del check-in a quello del check-out. Senza link personale, o se l'host non ha scritto
// niente, il blocco non compare affatto (l'ospite non sa nemmeno che dovrebbe esserci).
export default function BloccoArrivo({ slug }: { slug: string }) {
  const { lingua } = useLingua()
  const { hash } = useLocation()
  const t = TESTI_ARRIVO[lingua]
  const [token] = useState(() => leggiTokenSoggiorno(slug))
  const [risposta, setRisposta] = useState<Risposta | null>(null)
  const [erroreRete, setErroreRete] = useState(false)

  useEffect(() => {
    if (!token) return
    let attivo = true
    fetch(`/api/ospite?azione=arrivo&slug=${encodeURIComponent(slug)}&s=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.status === 404) return { stato: 'non_valido' } as Risposta
        if (!res.ok) throw new Error(String(res.status))
        return (await res.json()) as Risposta
      })
      .then((dati) => attivo && setRisposta(dati))
      .catch(() => attivo && setErroreRete(true))
    return () => {
      attivo = false
    }
  }, [slug, token])

  // Arrivando dal pulsante «Istruzioni di arrivo» della home (#arrivo) il blocco compare solo dopo la
  // risposta del server: si scorre fin lì appena c'è.
  const visibile = !!risposta
  useEffect(() => {
    if (visibile && hash === '#arrivo') document.getElementById('arrivo')?.scrollIntoView({ block: 'start' })
  }, [visibile, hash])

  function dataLeggibile(giorno: string) {
    return new Date(`${giorno}T12:00:00`).toLocaleDateString(lingua, { day: 'numeric', month: 'long' })
  }

  let contenuto = null
  if (!token) return null
  if (erroreRete) contenuto = <p className="g-wifi-nota">{t.errore}</p>
  else if (!risposta) return null
  else if (risposta.stato === 'non_valido') contenuto = <p className="g-wifi-nota">{t.nonValido}</p>
  // Dopo il check-out non si mostra niente: non c'è nulla da spiegare (e l'host potrebbe non aver mai scritto istruzioni).
  else if (risposta.stato === 'scaduto') return null
  else if (risposta.stato === 'presto') {
    if (!risposta.presente) return null
    contenuto = <p className="g-wifi-nota">{t.presto(dataLeggibile(risposta.checkin))}</p>
  } else {
    if (!risposta.testo) return null
    contenuto = <div className="g-arrivo-testo">{risposta.testo}</div>
  }

  return (
    <div className="g-wifi g-arrivo" id="arrivo">
      <div className="g-wifi-titolo">
        <KeyRound size={18} /> {t.titolo}
      </div>
      {contenuto}
    </div>
  )
}
