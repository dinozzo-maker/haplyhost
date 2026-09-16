import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { CHIAVE_STRUTTURA_SELEZIONATA } from './RichiedeLogin'
import { PaginaAdmin, Campo, classeCampo, Pulsante, Esito } from './ui'

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
    <PaginaAdmin
      titolo={aggiuntiva ? 'Aggiungi un\'altra struttura' : 'Crea la tua struttura'}
      indietro={aggiuntiva}
      sottotitolo="Proveremo a scrivere da soli la descrizione della casa leggendo il link. Funziona meglio con siti semplici; con Airbnb o Booking potrebbe non riuscire a leggere tutto — potrai comunque correggere il testo dopo, dal pannello."
    >
      <Campo etichetta="Nome della struttura">
        <input className={classeCampo} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. Villa Virginia" />
      </Campo>

      <Campo etichetta="Indirizzo">
        <input className={classeCampo} value={indirizzo} onChange={(e) => setIndirizzo(e.target.value)} placeholder="Via, città, provincia" />
      </Campo>

      <Campo etichetta="Link (annuncio, sito — facoltativo)">
        <input className={classeCampo} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
      </Campo>

      <div className="flex flex-col gap-2">
        <Pulsante onClick={crea} disabled={caricamento}>
          {caricamento ? 'Sto leggendo e scrivendo la descrizione...' : 'Crea struttura'}
        </Pulsante>
        {errore && <Esito ok={false}>{errore}</Esito>}
      </div>
    </PaginaAdmin>
  )
}
