import { useEffect, useState } from 'react'
import { leggiTokenSoggiorno } from './soggiornoOspite'

export type SoggiornoOspite = {
  stato: 'presto' | 'in_corso' | 'scaduto'
  nome: string
  checkin: string
  checkout: string
}

// Il soggiorno dell'ospite che ha aperto la guida dal suo link personale (vedi
// soggiornoOspite.ts). Senza link, o con link non valido/errore di rete, `soggiorno` è
// null e la home mostra il benvenuto generico: il benvenuto personale è un in più, mai
// una condizione per usare la guida. `caricamento` serve a non far lampeggiare il
// benvenuto generico prima di quello personale.
export function useSoggiorno(slug: string) {
  const [token] = useState(() => leggiTokenSoggiorno(slug))
  const [esito, setEsito] = useState<{ soggiorno: SoggiornoOspite | null; finito: boolean }>({
    soggiorno: null,
    finito: !token,
  })

  useEffect(() => {
    if (!token) return
    let attivo = true
    fetch(`/api/ospite?azione=soggiorno&slug=${encodeURIComponent(slug)}&s=${encodeURIComponent(token)}`)
      .then(async (res) => (res.ok ? ((await res.json()) as SoggiornoOspite) : null))
      .catch(() => null)
      .then((dati) => attivo && setEsito({ soggiorno: dati, finito: true }))
    return () => {
      attivo = false
    }
  }, [slug, token])

  return { soggiorno: esito.soggiorno, caricamento: !esito.finito }
}
