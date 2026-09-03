import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { invalidaCacheSezioni } from '../useSezioni'
import type { ContestoHost } from './RichiedeLogin'

const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase()

// Emoji tra cui scegliere l'icona di una sezione custom.
const EMOJI = [
  '🏠', '🛏️', '🔑', '📶', '🅿️', '🧺', '🌿', '🕯️',
  '🏖️', '🏊', '⛱️', '🌊', '⛵', '🚤', '🐚', '🏄',
  '🍝', '🍕', '🍷', '☕', '🍦', '🥐', '🍺', '🐟',
  '🛒', '💊', '🏧', '🥖', '🧴', '🏪', '📮', '🛍️',
  '🏛️', '⛪', '🖼️', '🎭', '📸', '🏰', '🗿', '⛲',
  '🎡', '🎢', '🎯', '🚴', '🥾', '🧗', '🎣', '🎾',
  '🗺️', '🚌', '🚕', '🚗', '🚲', '🚂', '✈️', '⛴️',
  '♻️', '📋', '🚨', '📞', '🎉', '🎂', '💍', '🎓',
]

type SezioneExtra = {
  chiave: string
  icona: string
  etichetta: string
  descrizione: string | null
  tipo: string
  categoria: string | null
}

export default function SezioniExtra() {
  const { session } = useOutletContext<ContestoHost>()
  const isSuperadmin = !!ADMIN_EMAIL && session.user.email?.toLowerCase() === ADMIN_EMAIL

  const [lista, setLista] = useState<SezioneExtra[]>([])
  const [caricamento, setCaricamento] = useState(true)

  const [etichetta, setEtichetta] = useState('')
  const [icona, setIcona] = useState('')
  const [pickerAperto, setPickerAperto] = useState(false)
  const [descrizione, setDescrizione] = useState('')
  const [tipo, setTipo] = useState<'testo' | 'elenco'>('testo')
  const [categoria, setCategoria] = useState('')

  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState('')
  const [rimozione, setRimozione] = useState('')

  async function token() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? ''
  }

  async function caricaLista() {
    const { data } = await supabase
      .from('sezioni_extra')
      .select('chiave, icona, etichetta, descrizione, tipo, categoria')
      .order('ordine')
    setLista(data ?? [])
    setCaricamento(false)
  }

  useEffect(() => {
    async function carica() {
      if (isSuperadmin) await caricaLista()
    }
    carica()
  }, [isSuperadmin])

  async function crea() {
    if (!etichetta.trim()) {
      setErrore('Serve almeno un nome.')
      return
    }
    setErrore('')
    setInvio(true)
    try {
      const res = await fetch('/api/sezioni-extra', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          access_token: await token(),
          etichetta: etichetta.trim(),
          icona: icona.trim(),
          descrizione: descrizione.trim(),
          tipo,
          categoria: tipo === 'elenco' ? categoria.trim() : '',
        }),
      })
      const dati = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrore(dati.error || 'Errore nella creazione.')
        return
      }
      setEtichetta('')
      setIcona('')
      setPickerAperto(false)
      setDescrizione('')
      setCategoria('')
      setTipo('testo')
      invalidaCacheSezioni()
      await caricaLista()
    } catch {
      setErrore('Errore di connessione, riprova.')
    } finally {
      setInvio(false)
    }
  }

  async function elimina(s: SezioneExtra) {
    if (!window.confirm(`Eliminare la sezione "${s.etichetta}"? Sparirà da tutte le guide. Il contenuto già scritto dagli host resta salvato ma nascosto.`)) return
    setRimozione(s.chiave)
    try {
      const res = await fetch('/api/sezioni-extra', {
        method: 'DELETE',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${await token()}`,
        },
        body: JSON.stringify({ chiave: s.chiave }),
      })
      const dati = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrore(dati.error || 'Non riesco a eliminare la sezione.')
      }
      invalidaCacheSezioni()
      await caricaLista()
    } catch {
      setErrore('Errore di connessione durante l\'eliminazione.')
    } finally {
      setRimozione('')
    }
  }

  if (!isSuperadmin) {
    return (
      <div className="max-w-sm mx-auto p-6">
        <Link to="/admin" className="text-sm text-blue-600">&larr; Torna al pannello</Link>
        <p className="mt-4 text-sm">Sezione riservata all'amministratore della piattaforma.</p>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto p-6">
      <Link to="/admin" className="text-sm text-blue-600">&larr; Torna al pannello</Link>
      <h1 className="text-xl font-bold mt-2 mb-1">Sezioni della piattaforma</h1>
      <p className="text-sm text-gray-500 mb-4">
        Sezioni extra che si aggiungono a quelle di serie. Ogni host le trova in "Sezioni della guida"
        e decide se attivarle: nascono spente per tutti.
      </p>

      <label className="text-xs text-gray-500">Nome della sezione</label>
      <input
        className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
        value={etichetta}
        onChange={(e) => setEtichetta(e.target.value)}
        placeholder="Es. Per un'occasione speciale"
      />

      <label className="text-xs text-gray-500">Icona</label>
      <div className="mb-3">
        <button
          type="button"
          onClick={() => setPickerAperto((v) => !v)}
          className="w-full border rounded-lg px-3 py-2 text-sm flex items-center justify-between"
        >
          <span>
            <span className="text-lg mr-2">{icona || '📄'}</span>
            {icona ? 'Cambia icona' : 'Scegli un’icona'}
          </span>
          <span className="text-gray-400">{pickerAperto ? '▲' : '▼'}</span>
        </button>
        {pickerAperto && (
          <div className="mt-2 grid grid-cols-8 gap-1 border rounded-lg p-2 bg-white">
            {EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => { setIcona(e); setPickerAperto(false) }}
                className={`text-xl rounded-md py-1 hover:bg-gray-100 ${icona === e ? 'bg-blue-100' : ''}`}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      <label className="text-xs text-gray-500">Descrizione breve</label>
      <input
        className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
        value={descrizione}
        onChange={(e) => setDescrizione(e.target.value)}
        placeholder="Allestimenti e sorprese per compleanni, anniversari, lauree"
      />

      <label className="text-xs text-gray-500">Tipo</label>
      <select
        className="w-full border rounded-lg px-3 py-2 text-sm mb-3 bg-white"
        value={tipo}
        onChange={(e) => setTipo(e.target.value as 'testo' | 'elenco')}
      >
        <option value="testo">Pagina di testo (l'host scrive un testo)</option>
        <option value="elenco">Lista di luoghi (con ricerca online)</option>
      </select>

      {tipo === 'elenco' && (
        <>
          <label className="text-xs text-gray-500">Cosa cerca la ricerca online</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Es. noleggi barche e gommoni"
          />
        </>
      )}

      <button
        onClick={crea}
        disabled={invio}
        className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm disabled:opacity-50"
      >
        {invio ? 'Creo...' : 'Crea sezione'}
      </button>
      {errore && <p className="text-red-600 text-sm mt-2">{errore}</p>}

      <hr className="my-6 border-gray-200" />

      <p className="text-xs font-medium text-gray-400 mb-2">SEZIONI EXTRA ({lista.length})</p>
      {caricamento && <p className="text-sm">Caricamento...</p>}
      <div className="flex flex-col gap-2">
        {lista.map((s) => (
          <div key={s.chiave} className="bg-white shadow rounded-xl p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{s.icona} {s.etichetta}</p>
                <p className="text-xs text-gray-400">
                  {s.tipo === 'elenco' ? 'lista di luoghi' : 'pagina di testo'}
                  {s.tipo === 'elenco' && s.categoria ? ` · cerca: ${s.categoria}` : ''}
                </p>
                {s.descrizione && <p className="text-xs text-gray-500 mt-1">{s.descrizione}</p>}
              </div>
              <button
                onClick={() => elimina(s)}
                disabled={rimozione === s.chiave}
                className="text-xs text-red-600 shrink-0 disabled:opacity-50"
              >
                {rimozione === s.chiave ? '...' : 'Elimina'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
