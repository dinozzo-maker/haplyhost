import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useParams, Outlet } from 'react-router-dom'
import { supabase } from './supabaseClient'
import TabBar from './TabBar'
import GennarinoFab from './GennarinoFab'

export type StrutturaRow = {
  id: string
  nome: string
  citta: string
  sezioni_attive: string[] | null
  accento: string | null
  copertina_url: string | null
}

export default function Struttura() {
  const { slug } = useParams()
  const [struttura, setStruttura] = useState<StrutturaRow | null>(null)
  const [caricamento, setCaricamento] = useState(true)

  useEffect(() => {
    async function carica() {
      const { data } = await supabase
        .from('strutture')
        .select('id, nome, citta, sezioni_attive, accento, copertina_url')
        .eq('slug', slug)
        .single()

      setStruttura(data)
      setCaricamento(false)
    }
    carica()
  }, [slug])

  if (caricamento) return <p className="g-stato">Caricamento...</p>
  if (!struttura) return <p className="g-stato">Struttura non trovata.</p>

  // Colore d'accento della struttura: iniettato come variabile CSS sullo shell,
  // così i derivati color-mix (--g-accent-d, --g-grad-b, ...) si ricalcolano da qui.
  const stile = struttura.accento
    ? ({ '--g-accent': struttura.accento } as CSSProperties)
    : undefined

  return (
    <div className="g-shell" style={stile}>
      <Outlet context={struttura} />
      <GennarinoFab slug={slug!} struttura={struttura} />
      <TabBar slug={slug!} struttura={struttura} />
    </div>
  )
}
