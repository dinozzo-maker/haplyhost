import { useEffect, useState } from 'react'
import { useParams, Outlet } from 'react-router-dom'
import { supabase } from './supabaseClient'

export type StrutturaRow = {
  id: string
  nome: string
  citta: string
}

export default function Struttura() {
  const { slug } = useParams()
  const [struttura, setStruttura] = useState<StrutturaRow | null>(null)
  const [caricamento, setCaricamento] = useState(true)

  useEffect(() => {
    async function carica() {
      const { data } = await supabase
        .from('strutture')
        .select('id, nome, citta')
        .eq('slug', slug)
        .single()

      setStruttura(data)
      setCaricamento(false)
    }
    carica()
  }, [slug])

  if (caricamento) return <p className="p-8 text-center">Caricamento...</p>
  if (!struttura) return <p className="p-8 text-center">Struttura non trovata.</p>

  return <Outlet context={struttura} />
}