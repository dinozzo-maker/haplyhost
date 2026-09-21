import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { SEZIONI } from '../sezioni'
import SceltaSezioni from './SceltaSezioni'
import { useSezioni } from '../useSezioni'
import type { ContestoHost } from './RichiedeLogin'

import { PaginaAdmin, Pulsante, Esito } from './ui'

export default function SezioniGuida() {
  const { struttura, aggiornaSezioniAttive } = useOutletContext<ContestoHost>()
  const { tutte: sezioniDisponibili } = useSezioni()

  const [attive, setAttive] = useState<Set<string>>(new Set())
  const [caricamento, setCaricamento] = useState(true)
  const [salvataggio, setSalvataggio] = useState(false)
  const [salvato, setSalvato] = useState(false)
  const [errore, setErrore] = useState('')

  useEffect(() => {
    async function carica() {
      if (!struttura) {
        setCaricamento(false)
        return
      }
      const { data, error } = await supabase
        .from('strutture')
        .select('sezioni_attive')
        .eq('id', struttura.id)
        .single()

      if (error) {
        setErrore('Non riesco a caricare le impostazioni.')
        setCaricamento(false)
        return
      }

      const salvate: string[] | null = data?.sezioni_attive ?? null
      // null = tutte le sezioni di sistema attive; le custom partono spente.
      setAttive(new Set(salvate ?? SEZIONI.map((s) => s.chiave)))
      setCaricamento(false)
    }
    carica()
  }, [struttura])

  async function salva() {
    if (!struttura) return
    setSalvataggio(true)
    setSalvato(false)
    setErrore('')

    const { error } = await supabase
      .from('strutture')
      .update({ sezioni_attive: [...attive] })
      .eq('id', struttura.id)

    setSalvataggio(false)
    if (error) {
      setErrore('Errore nel salvataggio: ' + error.message)
      return
    }
    aggiornaSezioniAttive([...attive])
    setSalvato(true)
  }

  if (!struttura) {
    return (
      <PaginaAdmin titolo="Sezioni della guida">
        <p className="text-sm text-slate-500">Non hai ancora una struttura.</p>
      </PaginaAdmin>
    )
  }

  if (caricamento) return <p className="p-6 text-center text-sm text-slate-500">Caricamento...</p>

  return (
    <PaginaAdmin
      titolo="Sezioni della guida"
      sottotitolo="Scegli quali sezioni compaiono nella guida degli ospiti. Quelle spente restano gestibili dal pannello, ma l'ospite non le vede."
    >
      <SceltaSezioni tutte={sezioniDisponibili} attive={[...attive]} onChange={valori => { setAttive(new Set(valori)); setSalvato(false) }} />

      <div className="flex flex-col gap-2">
        <Pulsante onClick={salva} disabled={salvataggio}>
          {salvataggio ? 'Salvo...' : 'Salva'}
        </Pulsante>
        {salvato && <Esito ok>Salvato ✓</Esito>}
        {errore && <Esito ok={false}>{errore}</Esito>}
      </div>
    </PaginaAdmin>
  )
}
