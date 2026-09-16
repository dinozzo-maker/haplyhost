import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { ContestoHost } from './RichiedeLogin'
import { PaginaAdmin, Campo, classeCampo, Pulsante, Esito } from './ui'

export default function GestisciPagina({ chiave, etichetta }: { chiave: string; etichetta: string }) {
  const { struttura } = useOutletContext<ContestoHost>()
  const [titolo, setTitolo] = useState('')
  const [contenuto, setContenuto] = useState('')
  const [caricamento, setCaricamento] = useState(true)
  const [salvataggio, setSalvataggio] = useState(false)
  const [salvato, setSalvato] = useState(false)
  const [errore, setErrore] = useState('')

  useEffect(() => {
    async function carica() {
      if (!struttura) { setCaricamento(false); return }

      const { data } = await supabase
        .from('pagine')
        .select('titolo, contenuto')
        .eq('struttura_id', struttura.id)
        .eq('chiave', chiave)
        .maybeSingle()

      setTitolo(data?.titolo ?? etichetta)
      setContenuto(data?.contenuto ?? '')
      setCaricamento(false)
    }
    carica()
  }, [chiave, etichetta, struttura])

  async function salva() {
    if (!struttura) return
    setSalvataggio(true)
    setSalvato(false)
    setErrore('')

    const { error } = await supabase
      .from('pagine')
      .upsert(
        // da_tradurre: il testo è cambiato, le traduzioni EN/FR/DE/ES vanno rifatte
        { struttura_id: struttura.id, chiave, titolo, contenuto, da_tradurre: true },
        { onConflict: 'struttura_id,chiave' }
      )

    setSalvataggio(false)
    if (error) {
      setErrore('Errore nel salvataggio: ' + error.message)
      return
    }
    setSalvato(true)
  }

  if (caricamento) return <p className="p-6 text-center text-sm text-slate-500">Caricamento...</p>

  return (
    <PaginaAdmin titolo={`Modifica ${etichetta}`}>
      <Campo etichetta="Titolo">
        <input
          className={classeCampo}
          value={titolo}
          onChange={(e) => { setTitolo(e.target.value); setSalvato(false) }}
        />
      </Campo>

      <Campo etichetta="Testo">
        <textarea
          className={classeCampo}
          rows={16}
          value={contenuto}
          onChange={(e) => { setContenuto(e.target.value); setSalvato(false) }}
        />
      </Campo>

      <div className="flex flex-col gap-2">
        <Pulsante onClick={salva} disabled={salvataggio}>
          {salvataggio ? 'Salvo...' : 'Salva'}
        </Pulsante>
        {salvato && (
          <Esito ok>
            Salvato ✓ — poi rilancia <Link to="/admin/traduzioni" className="underline">Traduzioni della guida</Link>
          </Esito>
        )}
        {errore && <Esito ok={false}>{errore}</Esito>}
      </div>
    </PaginaAdmin>
  )
}
