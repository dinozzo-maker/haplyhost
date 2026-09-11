import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { CHIAVE_STRUTTURA_SELEZIONATA } from './RichiedeLogin'

// `aggiuntiva`: usato sia per la primissima struttura di un host (Admin.tsx la mostra
// quando non ne ha ancora nessuna) sia per aggiungerne un'altra (rotta /admin/nuova-struttura,
// per chi ha più proprietà). Stesso form, cambia solo il testo introduttivo.
export default function CreaStruttura({ aggiuntiva = false }: { aggiuntiva?: boolean }) {
  const [nome, setNome] = useState('')
  const [indirizzo, setIndirizzo] = useState('')
  const [link, setLink] = useState('')
  const [caricamento, setCaricamento] = useState(false)
  const [errore, setErrore] = useState('')

  async function crea() {
    if (!nome.trim() || !indirizzo.trim()) {
      setErrore('Nome e indirizzo sono obbligatori.')
      return
    }
    setErrore('')
    setCaricamento(true)

    const { data: sessionData } = await supabase.auth.getSession()
    const access_token = sessionData.session?.access_token

    try {
      const res = await fetch('/api/importa-casa', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nome, indirizzo, link, access_token }),
      })
      const dati = await res.json()
      if (!res.ok) {
        setErrore(dati.error || 'Errore nella creazione.')
        setCaricamento(false)
        return
      }
      // Fa comparire subito la struttura appena creata (non necessariamente la prima
      // in ordine di data, che è quella scelta di default dopo il ricaricamento).
      try {
        if (dati.struttura?.id) localStorage.setItem(CHIAVE_STRUTTURA_SELEZIONATA, dati.struttura.id)
      } catch {
        // navigazione privata: non grave, si parte dalla prima struttura
      }
      window.location.href = '/admin'
    } catch {
      setErrore('Errore di connessione, riprova.')
      setCaricamento(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto p-6">
      {aggiuntiva && <Link to="/admin" className="text-sm text-blue-600">&larr; Torna al pannello</Link>}
      <h1 className={`text-xl font-bold mb-1 ${aggiuntiva ? 'mt-2' : ''}`}>
        {aggiuntiva ? 'Aggiungi un\'altra struttura' : 'Crea la tua struttura'}
      </h1>
      <p className="text-sm text-gray-500 mb-4">
        Proveremo a scrivere da soli la descrizione della casa leggendo il link. Funziona meglio con siti semplici; con Airbnb o Booking potrebbe non riuscire a leggere tutto — potrai comunque correggere il testo dopo, dal pannello.
      </p>

      <label className="text-xs text-gray-500">Nome della struttura</label>
      <input className="w-full border rounded-lg px-3 py-2 text-sm mb-3" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. Villa Virginia" />

      <label className="text-xs text-gray-500">Indirizzo</label>
      <input className="w-full border rounded-lg px-3 py-2 text-sm mb-3" value={indirizzo} onChange={(e) => setIndirizzo(e.target.value)} placeholder="Via, città, provincia" />

      <label className="text-xs text-gray-500">Link (annuncio, sito — facoltativo)</label>
      <input className="w-full border rounded-lg px-3 py-2 text-sm mb-4" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />

      <button onClick={crea} disabled={caricamento} className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm disabled:opacity-50">
        {caricamento ? 'Sto leggendo e scrivendo la descrizione...' : 'Crea struttura'}
      </button>

      {errore && <p className="text-red-600 text-sm mt-3">{errore}</p>}
    </div>
  )
}