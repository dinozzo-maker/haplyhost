import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { SEZIONI } from './sezioni'
import type { Sezione, TipoSezione } from './sezioni'

// Le sezioni custom (tabella sezioni_extra) si aggiungono alle 14 di sistema.
// Cache + promise in-flight a livello di modulo: una sola fetch per sessione anche
// se più componenti chiamano useSezioni() insieme.
let cache: Sezione[] | null = null
let inflight: Promise<Sezione[]> | null = null

export function invalidaCacheSezioni() {
  cache = null
  inflight = null
}

function mappa(r: {
  chiave: string
  icona: string | null
  etichetta: string
  descrizione: string | null
  tipo: string | null
}): Sezione {
  return {
    chiave: r.chiave,
    icona: r.icona || '📄',
    etichetta: r.etichetta,
    descrizione: r.descrizione ?? undefined,
    tipo: (r.tipo === 'elenco' ? 'elenco' : 'testo') as TipoSezione,
  }
}

async function caricaCustom(): Promise<Sezione[]> {
  if (cache !== null) return cache
  if (!inflight) {
    inflight = (async () => {
      const { data, error } = await supabase
        .from('sezioni_extra')
        .select('chiave, icona, etichetta, descrizione, tipo, ordine')
        .order('ordine')
      // Se la tabella non esiste ancora (migration 0004 non lanciata) o errore → degrada
      // alle sole sezioni di sistema.
      const risultato: Sezione[] = error || !data ? [] : data.map(mappa)
      cache = risultato
      return risultato
    })()
  }
  return inflight
}

export function useSezioni(): { tutte: Sezione[]; caricamento: boolean } {
  const [custom, setCustom] = useState<Sezione[]>(cache ?? [])
  const [caricamento, setCaricamento] = useState(cache === null)

  useEffect(() => {
    if (cache !== null) return
    let vivo = true
    caricaCustom().then((c) => {
      if (!vivo) return
      setCustom(c)
      setCaricamento(false)
    })
    return () => {
      vivo = false
    }
  }, [])

  return { tutte: [...SEZIONI, ...custom], caricamento }
}
