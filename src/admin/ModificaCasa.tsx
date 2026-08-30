import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { ContestoHost } from './RichiedeLogin'

type DatiCasa = {
  nome: string
  indirizzo: string
  citta: string
  descrizione_casa: string
  host_nome: string
  host_telefono: string
  checkin: string
  checkout: string
  max_ospiti: string
}

const VUOTO: DatiCasa = {
  nome: '',
  indirizzo: '',
  citta: '',
  descrizione_casa: '',
  host_nome: '',
  host_telefono: '',
  checkin: '',
  checkout: '',
  max_ospiti: '',
}

export default function ModificaCasa() {
  const { struttura } = useOutletContext<ContestoHost>()

  const [dati, setDati] = useState<DatiCasa>(VUOTO)
  const [caricamento, setCaricamento] = useState(true)
  const [salvataggio, setSalvataggio] = useState(false)
  const [salvato, setSalvato] = useState(false)
  const [errore, setErrore] = useState('')

  // Riquadro separato: rigenera la descrizione da un nuovo link
  const [link, setLink] = useState('')
  const [rigenerando, setRigenerando] = useState(false)
  const [rigenerato, setRigenerato] = useState(false)
  const [erroreRigenera, setErroreRigenera] = useState('')

  useEffect(() => {
    async function carica() {
      if (!struttura) {
        setCaricamento(false)
        return
      }

      const { data, error } = await supabase
        .from('strutture')
        .select('nome, indirizzo, citta, descrizione_casa, host_nome, host_telefono, checkin, checkout, max_ospiti, link_riferimento')
        .eq('id', struttura.id)
        .single()

      if (error || !data) {
        setErrore('Non riesco a caricare i dati della struttura.')
        setCaricamento(false)
        return
      }

      setDati({
        nome: data.nome ?? '',
        indirizzo: data.indirizzo ?? '',
        citta: data.citta ?? '',
        descrizione_casa: data.descrizione_casa ?? '',
        host_nome: data.host_nome ?? '',
        host_telefono: data.host_telefono ?? '',
        checkin: data.checkin ?? '',
        checkout: data.checkout ?? '',
        max_ospiti: data.max_ospiti != null ? String(data.max_ospiti) : '',
      })
      setLink(data.link_riferimento ?? '')
      setCaricamento(false)
    }
    carica()
  }, [struttura])

  function aggiorna(campo: keyof DatiCasa, valore: string) {
    setDati((d) => ({ ...d, [campo]: valore }))
    setSalvato(false)
  }

  async function salva() {
    if (!struttura) return
    if (!dati.nome.trim() || !dati.indirizzo.trim()) {
      setErrore('Nome e indirizzo sono obbligatori.')
      return
    }
    setErrore('')
    setSalvataggio(true)
    setSalvato(false)

    const { error } = await supabase
      .from('strutture')
      .update({
        nome: dati.nome.trim(),
        indirizzo: dati.indirizzo.trim(),
        citta: dati.citta.trim(),
        descrizione_casa: dati.descrizione_casa.trim(),
        host_nome: dati.host_nome.trim(),
        host_telefono: dati.host_telefono.trim(),
        checkin: dati.checkin.trim(),
        checkout: dati.checkout.trim(),
        max_ospiti: dati.max_ospiti.trim() ? Number(dati.max_ospiti) : null,
      })
      .eq('id', struttura.id)

    setSalvataggio(false)

    if (error) {
      setErrore('Errore nel salvataggio: ' + error.message)
      return
    }
    setSalvato(true)
  }

  async function rigenera() {
    if (!struttura) return
    if (!link.trim()) {
      setErroreRigenera('Inserisci un link.')
      return
    }
    setErroreRigenera('')
    setRigenerato(false)
    setRigenerando(true)

    const { data: sessionData } = await supabase.auth.getSession()
    const access_token = sessionData.session?.access_token

    try {
      const res = await fetch('/api/aggiorna-casa', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ struttura_id: struttura.id, link: link.trim(), access_token }),
      })
      const risposta = await res.json()
      if (!res.ok) {
        setErroreRigenera(risposta.error || 'Errore nella rigenerazione.')
        setRigenerando(false)
        return
      }
      setDati((d) => ({
        ...d,
        descrizione_casa: risposta.descrizione ?? d.descrizione_casa,
        citta: risposta.citta || d.citta,
      }))
      setSalvato(false)
      setRigenerato(true)
    } catch {
      setErroreRigenera('Errore di connessione, riprova.')
    } finally {
      setRigenerando(false)
    }
  }

  if (!struttura) {
    return (
      <div className="max-w-sm mx-auto p-6">
        <Link to="/admin" className="text-sm text-blue-600">&larr; Torna al pannello</Link>
        <p className="mt-4 text-sm">Non hai ancora una struttura da modificare.</p>
      </div>
    )
  }

  if (caricamento) return <p className="p-6 text-center">Caricamento...</p>

  return (
    <div className="max-w-sm mx-auto p-6">
      <Link to="/admin" className="text-sm text-blue-600">&larr; Torna al pannello</Link>
      <h1 className="text-xl font-bold mt-2 mb-4">Modifica dati della casa</h1>

      <label className="text-xs text-gray-500">Nome della struttura</label>
      <input
        className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
        value={dati.nome}
        onChange={(e) => aggiorna('nome', e.target.value)}
      />

      <label className="text-xs text-gray-500">Indirizzo</label>
      <input
        className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
        value={dati.indirizzo}
        onChange={(e) => aggiorna('indirizzo', e.target.value)}
        placeholder="Via, numero civico, provincia"
      />

      <label className="text-xs text-gray-500">Città</label>
      <input
        className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
        value={dati.citta}
        onChange={(e) => aggiorna('citta', e.target.value)}
        placeholder="Es. Sorrento"
      />

      <label className="text-xs text-gray-500">Descrizione della casa</label>
      <textarea
        className="w-full border rounded-lg px-3 py-2 text-sm mb-1"
        rows={6}
        value={dati.descrizione_casa}
        onChange={(e) => aggiorna('descrizione_casa', e.target.value)}
      />
      <p className="text-xs text-gray-400 mb-3">
        Gennarino usa questo testo per rispondere alle domande degli ospiti sulla casa.
      </p>

      <label className="text-xs text-gray-500">Nome host</label>
      <input
        className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
        value={dati.host_nome}
        onChange={(e) => aggiorna('host_nome', e.target.value)}
      />

      <label className="text-xs text-gray-500">Telefono host</label>
      <input
        className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
        value={dati.host_telefono}
        onChange={(e) => aggiorna('host_telefono', e.target.value)}
      />

      <div className="flex gap-3 mb-3">
        <div className="flex-1">
          <label className="text-xs text-gray-500">Check-in</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={dati.checkin}
            onChange={(e) => aggiorna('checkin', e.target.value)}
            placeholder="15:00"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500">Check-out</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={dati.checkout}
            onChange={(e) => aggiorna('checkout', e.target.value)}
            placeholder="10:00"
          />
        </div>
      </div>

      <label className="text-xs text-gray-500">Ospiti massimi</label>
      <input
        type="number"
        min="1"
        className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
        value={dati.max_ospiti}
        onChange={(e) => aggiorna('max_ospiti', e.target.value)}
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

      <hr className="my-6 border-gray-200" />

      <h2 className="text-sm font-bold mb-1">Rigenera la descrizione da un link</h2>
      <p className="text-xs text-gray-500 mb-3">
        Incolla il link dell'annuncio o del sito della casa: l'assistente lo rilegge e riscrive
        descrizione e città. Il testo attuale verrà sostituito (potrai comunque correggerlo qui sopra
        prima di salvare).
      </p>
      <input
        className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
        value={link}
        onChange={(e) => { setLink(e.target.value); setRigenerato(false) }}
        placeholder="https://..."
      />
      <button
        onClick={rigenera}
        disabled={rigenerando}
        className="w-full border border-blue-600 text-blue-600 rounded-lg py-2 text-sm disabled:opacity-50"
      >
        {rigenerando ? 'Sto rileggendo il link e riscrivendo...' : 'Rigenera descrizione'}
      </button>
      {rigenerato && (
        <p className="text-sm text-green-600 mt-2 text-center">
          Descrizione aggiornata ✓ Controllala qui sopra, poi premi Salva se vuoi ritoccarla.
        </p>
      )}
      {erroreRigenera && <p className="text-red-600 text-sm mt-2">{erroreRigenera}</p>}
    </div>
  )
}
