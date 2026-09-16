import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { ContestoHost } from './RichiedeLogin'
import { PaginaAdmin, Campo, classeCampo, Pulsante, Esito } from './ui'

export default function NoteGennarino() {
  const { struttura } = useOutletContext<ContestoHost>()

  const [note, setNote] = useState('')
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
        .select('note_gennarino')
        .eq('id', struttura.id)
        .single()

      if (error) {
        setErrore('Non riesco a caricare le note.')
      } else {
        setNote(data?.note_gennarino ?? '')
      }
      setCaricamento(false)
    }
    carica()
  }, [struttura])

  async function salva() {
    if (!struttura) return
    setErrore('')
    setSalvataggio(true)
    setSalvato(false)

    const { error } = await supabase
      .from('strutture')
      .update({ note_gennarino: note.trim() || null })
      .eq('id', struttura.id)

    setSalvataggio(false)
    if (error) {
      setErrore('Errore nel salvataggio: ' + error.message)
      return
    }
    setSalvato(true)
  }

  if (!struttura) {
    return (
      <PaginaAdmin titolo="Note per Gennarino">
        <p className="text-sm text-slate-500">Non hai ancora una struttura.</p>
      </PaginaAdmin>
    )
  }

  if (caricamento) return <p className="p-6 text-center text-sm text-slate-500">Caricamento...</p>

  return (
    <PaginaAdmin
      titolo="Note per Gennarino"
      sottotitolo={
        <>
          Scrivi qui tutte le informazioni pratiche sulla casa che non stanno nelle altre pagine.
          Gennarino le usa per rispondere agli ospiti; nella guida <strong>non si vedono</strong> come
          sezione.
        </>
      }
    >
      <Campo
        etichetta="Note pratiche"
        aiuto="Esempi: dove si accendono le luci del giardino, come funziona il condizionatore, dove sono le pastiglie della lavastoviglie, cosa fare se scatta il salvavita, il giorno della differenziata, come si apre il cancello… Una frase per riga, come le diresti a voce."
      >
        <textarea
          className={classeCampo}
          rows={14}
          value={note}
          onChange={(e) => { setNote(e.target.value); setSalvato(false) }}
          placeholder={
            'Le luci del giardino si accendono dall\'interruttore dietro la porta della cucina.\n' +
            'Il termostato del riscaldamento è in corridoio, di solito lasciatelo su 20°.\n' +
            'La raccolta differenziata passa il martedì mattina presto.'
          }
        />
      </Campo>

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
