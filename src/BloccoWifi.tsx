import { useEffect, useState } from 'react'
import { Wifi, Copy, Check } from 'lucide-react'
import { useLingua } from './lingua'
import { TESTI_WIFI } from './testiWifi'
import { leggiTokenSoggiorno } from './soggiornoOspite'

type Rete = { nome: string; password: string; zona: string }
type Risposta =
  | { stato: 'in_corso'; checkout: string; reti: Rete[] }
  | { stato: 'presto'; checkin: string }
  | { stato: 'scaduto' }
  | { stato: 'non_valido' }

async function copiaTesto(testo: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(testo)
    return true
  } catch {
    // Clipboard API non disponibile (es. pagina non sicura o browser vecchio): ripiego.
    try {
      const campo = document.createElement('textarea')
      campo.value = testo
      campo.style.position = 'fixed'
      campo.style.opacity = '0'
      document.body.appendChild(campo)
      campo.select()
      const ok = document.execCommand('copy')
      campo.remove()
      return ok
    } catch {
      return false
    }
  }
}

// Wi-Fi nella pagina "Casa & Wi-Fi". La password non è mai nella pagina pubblica: la
// chiede a /api/ospite?azione=wifi con il token del soggiorno, e il server la dà solo dal giorno del
// check-in al giorno del check-out. Senza link personale mostra solo come ottenerla.
export default function BloccoWifi({ slug }: { slug: string }) {
  const { lingua } = useLingua()
  const t = TESTI_WIFI[lingua]
  const [token] = useState(() => leggiTokenSoggiorno(slug))
  const [risposta, setRisposta] = useState<Risposta | null>(null)
  const [erroreRete, setErroreRete] = useState(false)
  const [copiata, setCopiata] = useState<number | null>(null)

  useEffect(() => {
    if (!token) return
    let attivo = true
    fetch(`/api/ospite?azione=wifi&slug=${encodeURIComponent(slug)}&s=${encodeURIComponent(token)}`)
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

  async function copia(indice: number, password: string) {
    if (await copiaTesto(password)) {
      setCopiata(indice)
      window.setTimeout(() => setCopiata((c) => (c === indice ? null : c)), 2000)
    }
  }

  function dataLeggibile(giorno: string) {
    return new Date(`${giorno}T12:00:00`).toLocaleDateString(lingua, { day: 'numeric', month: 'long' })
  }

  let contenuto
  if (!token) {
    contenuto = <p className="g-wifi-nota">{t.senzaLink}</p>
  } else if (erroreRete) {
    contenuto = <p className="g-wifi-nota">{t.errore}</p>
  } else if (!risposta) {
    contenuto = null
  } else if (risposta.stato === 'presto') {
    contenuto = <p className="g-wifi-nota">{t.presto(dataLeggibile(risposta.checkin))}</p>
  } else if (risposta.stato === 'scaduto') {
    contenuto = <p className="g-wifi-nota">{t.scaduto}</p>
  } else if (risposta.stato === 'non_valido') {
    contenuto = <p className="g-wifi-nota">{t.nonValido}</p>
  } else {
    contenuto = risposta.reti.map((rete, i) => (
      <div className="g-wifi-rete" key={i}>
        {rete.zona && <div className="g-wifi-zona">{rete.zona}</div>}
        <div className="g-wifi-riga">
          <span className="g-wifi-etichetta">{t.rete}</span>
          <span className="g-wifi-valore">{rete.nome}</span>
        </div>
        <div className="g-wifi-riga">
          <span className="g-wifi-etichetta">{t.password}</span>
          {rete.password ? (
            <>
              <span className="g-wifi-valore g-wifi-pw">{rete.password}</span>
              <button type="button" className="g-wifi-copia" onClick={() => copia(i, rete.password)}>
                {copiata === i ? <Check size={16} /> : <Copy size={16} />}
                {copiata === i ? t.copiato : t.copia}
              </button>
            </>
          ) : (
            <span className="g-wifi-valore">{t.senzaPassword}</span>
          )}
        </div>
      </div>
    ))
  }

  // Ancora in attesa della risposta: niente blocco (evita un lampeggio di testo).
  if (contenuto === null) return null

  return (
    <div className="g-wifi">
      <div className="g-wifi-titolo">
        <Wifi size={18} /> {t.titolo}
      </div>
      {contenuto}
    </div>
  )
}
