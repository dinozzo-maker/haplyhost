import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { ContestoHost } from './RichiedeLogin'

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
      <div className="max-w-sm mx-auto p-6">
        <Link to="/admin" className="text-sm text-blue-600">&larr; Torna al pannello</Link>
        <p className="mt-4 text-sm">Non hai ancora una struttura.</p>
      </div>
    )
  }

  if (caricamento) return <p className="p-6 text-center">Caricamento...</p>

  return (
    <div className="max-w-sm mx-auto p-6">
      <Link to="/admin" className="text-sm text-blue-600">&larr; Torna al pannello</Link>
      <h1 className="text-xl font-bold mt-2 mb-2">Note per Gennarino</h1>
      <p className="text-sm text-gray-500 mb-2">
        Scrivi qui tutte le informazioni pratiche sulla casa che non stanno nelle altre pagine.
        Gennarino le usa per rispondere agli ospiti; nella guida <strong>non si vedono</strong> come
        sezione.
      </p>
      <p className="text-xs text-gray-400 mb-3">
        Esempi: dove si accendono le luci del giardino, come funziona il condizionatore, dove sono le
        pastiglie della lavastoviglie, cosa fare se scatta il salvavita, il giorno della
        differenziata, come si apre il cancello… Una frase per riga, come le diresti a voce.
      </p>

      <textarea
        className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
        rows={14}
        value={note}
        onChange={(e) => { setNote(e.target.value); setSalvato(false) }}
        placeholder={
          'Le luci del giardino si accendono dall\'interruttore dietro la porta della cucina.\n' +
          'Il termostato del riscaldamento è in corridoio, di solito lasciatelo su 20°.\n' +
          'La raccolta differenziata passa il martedì mattina presto.'
        }
      />

      <button
        onClick={salva}
        disabled={salvataggio}
        className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm disabled:opacity-50"
      >
        {salvataggio ? 'Salvo...' : 'Salva'}
      </button>
      {salvato && <p className="text-sm text-green-600 mt-2 text-center">Salvato ✓</p>}
      {errore && <p className="text-red-600 text-sm mt-2">{errore}</p>}
    </div>
  )
}
