import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { SEZIONI } from './sezioni'
import type { Sezione, TipoSezione } from './sezioni'

// Le sezioni custom (tabella sezioni_extra) si aggiungono alle 14 di sistema.
// Cache + promise in-flight a livello di modulo: una sola fetch per sessione anche
// se più componenti chiamano useSezioni() insieme.
// I consumatori montati si registrano in `abbonati`: invalidaCacheSezioni() li
// riallinea tutti, così dopo una crea/elimina le rotte generate in App.tsx si
// aggiornano senza bisogno di ricaricare la pagina.
let cache: Sezione[] | null = null
let inflight: Promise<Sezione[]> | null = null
const abbonati = new Set<() => void>()

export function invalidaCacheSezioni() {
  cache = null
  inflight = null
  abbonati.forEach((sincronizza) => sincronizza())
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
      inflight = null
      return risultato
    })()
  }
  return inflight
}

export function useSezioni(): { tutte: Sezione[]; caricamento: boolean } {
  const [custom, setCustom] = useState<Sezione[]>(cache ?? [])
  const [caricamento, setCaricamento] = useState(cache === null)

  useEffect(() => {
    let vivo = true

    function sincronizza() {
      if (cache !== null) {
        setCustom(cache)
        setCaricamento(false)
        return
      }
      setCaricamento(true)
      caricaCustom().then((c) => {
        if (vivo) {
          setCustom(c)
          setCaricamento(false)
        }
      })
    }

    sincronizza()
    abbonati.add(sincronizza)
    return () => {
      vivo = false
      abbonati.delete(sincronizza)
    }
  }, [])

  return { tutte: [...SEZIONI, ...custom], caricamento }
}
