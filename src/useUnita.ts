import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// Unità (camere o alloggi prenotabili) usate dall'host e quelle incluse nel suo piano —
// vedi lib/unita.js e la migration 0023. `incluse` null = nessun limite (superadmin).
// `unita` è null finché non arriva, e resta null se la funzione del database non c'è
// ancora o fallisce: il pannello allora non mostra nessun limite (i controlli veri sono
// comunque lato server e database).
export type UnitaHost = { usate: number; incluse: number | null }

export function useUnita() {
  const [unita, setUnita] = useState<UnitaHost | null>(null)

  const ricarica = useCallback(async () => {
    const { data, error } = await supabase.rpc('mie_unita')
    if (!error && data && typeof data.usate === 'number') setUnita(data as UnitaHost)
  }, [])

  useEffect(() => {
    void ricarica()
  }, [ricarica])

  return { unita, ricarica }
}
