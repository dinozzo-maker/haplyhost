import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useParams, Outlet } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { T, useLingua } from './lingua'
import { LinguaProvider } from './LinguaProvider'
import TabBar from './TabBar'
import GennarinoFab from './GennarinoFab'

export type StrutturaRow = {
  id: string
  nome: string
  citta: string
  sezioni_attive: string[] | null
  accento: string | null
  copertina_url: string | null
  host_telefono: string | null
}

export default function Struttura() {
  const { slug } = useParams()
  const [struttura, setStruttura] = useState<StrutturaRow | null>(null)
  // La RLS pubblica nasconde una struttura con attivo=false esattamente come uno slug
  // sbagliato (data = null in entrambi i casi): per distinguerle si chiede a un
  // endpoint minimo (api/verifica-slug) se lo slug esiste, senza rivelarne i dati.
  const [nonPubblica, setNonPubblica] = useState(false)
  const [caricamento, setCaricamento] = useState(true)

  useEffect(() => {
    async function carica() {
      const { data } = await supabase
        .from('strutture')
        .select('id, nome, citta, sezioni_attive, accento, copertina_url, host_telefono')
        .eq('slug', slug)
        .single()

      if (!data && slug) {
        try {
          const res = await fetch(`/api/verifica-slug?slug=${encodeURIComponent(slug)}`)
          const dati = await res.json()
          setNonPubblica(!!dati.esiste)
        } catch {
          // controllo non riuscito: resta il messaggio generico "non trovata"
        }
      }

      setStruttura(data)
      setCaricamento(false)
    }
    carica()
  }, [slug])

  return (
    <LinguaProvider>
      <Guscio slug={slug ?? ''} struttura={struttura} nonPubblica={nonPubblica} caricamento={caricamento} />
    </LinguaProvider>
  )
}

function Guscio({
  slug,
  struttura,
  nonPubblica,
  caricamento,
}: {
  slug: string
  struttura: StrutturaRow | null
  nonPubblica: boolean
  caricamento: boolean
}) {
  const { lingua } = useLingua()

  if (caricamento) return <p className="g-stato">{T[lingua].caricamento}</p>
  if (!struttura) {
    return <p className="g-stato">{nonPubblica ? T[lingua].guidaInAllestimento : T[lingua].strutturaNonTrovata}</p>
  }

  // Colore d'accento della struttura: iniettato come variabile CSS sullo shell,
  // così i derivati color-mix (--g-accent-d, --g-grad-b, ...) si ricalcolano da qui.
  const stile = struttura.accento
    ? ({ '--g-accent': struttura.accento } as CSSProperties)
    : undefined

  // Il selettore lingua è in Home.tsx (riga sotto la copertina), non qui: la scelta
  // vale per tutta la guida perché è ricordata (localStorage + context).
  return (
    <div className="g-shell" style={stile}>
      <Outlet context={struttura} />
      <GennarinoFab slug={slug} struttura={struttura} />
      <TabBar slug={slug} struttura={struttura} />
    </div>
  )
}
