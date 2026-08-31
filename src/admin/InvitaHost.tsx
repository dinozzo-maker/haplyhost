import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { ContestoHost } from './RichiedeLogin'

const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase()

type HostRow = {
  email: string
  nome_riferimento: string | null
  piano: string | null
  note: string | null
  autorizzato_il: string
  registrato_il: string | null
}

const PIANI = [
  { valore: 'guida', etichetta: 'Guida' },
  { valore: 'concierge', etichetta: 'Concierge' },
  { valore: 'portfolio', etichetta: 'Portfolio' },
]

export default function InvitaHost() {
  const { session } = useOutletContext<ContestoHost>()
  const isSuperadmin = !!ADMIN_EMAIL && session.user.email?.toLowerCase() === ADMIN_EMAIL

  const [lista, setLista] = useState<HostRow[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [erroreLista, setErroreLista] = useState('')

  const [email, setEmail] = useState('')
  const [nomeRiferimento, setNomeRiferimento] = useState('')
  const [piano, setPiano] = useState('guida')
  const [note, setNote] = useState('')

  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState('')
  const [link, setLink] = useState('')
  const [copiato, setCopiato] = useState(false)
  const [rimozione, setRimozione] = useState('')

  async function token() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? ''
  }

  async function caricaLista() {
    setErroreLista('')
    try {
      const res = await fetch('/api/host-autorizzati', {
        headers: { Authorization: `Bearer ${await token()}` },
      })
      const dati = await res.json()
      if (!res.ok) {
        setErroreLista(dati.error || 'Non riesco a caricare l\'elenco.')
      } else {
        setLista(dati.host || [])
      }
    } catch {
      setErroreLista('Non riesco a caricare l\'elenco (serve il sito online).')
    } finally {
      setCaricamento(false)
    }
  }

  useEffect(() => {
    // Solo il superadmin carica l'elenco; per gli altri la pagina mostra comunque
    // il messaggio "sezione riservata" (il valore di `caricamento` non viene letto).
    async function carica() {
      if (isSuperadmin) await caricaLista()
    }
    carica()
  }, [isSuperadmin])

  async function invita() {
    if (!email.trim() || !email.includes('@')) {
      setErrore('Inserisci un\'email valida.')
      return
    }
    setErrore('')
    setLink('')
    setCopiato(false)
    setInvio(true)

    try {
      const res = await fetch('/api/host-autorizzati', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          access_token: await token(),
          email: email.trim(),
          nome_riferimento: nomeRiferimento.trim(),
          piano,
          note: note.trim(),
        }),
      })
      const dati = await res.json()
      if (!res.ok) {
        setErrore(dati.error || 'Errore durante l\'invito.')
        setInvio(false)
        return
      }
      setLink(dati.link || '')
      setEmail('')
      setNomeRiferimento('')
      setNote('')
      await caricaLista()
    } catch {
      setErrore('Errore di connessione, riprova.')
    } finally {
      setInvio(false)
    }
  }

  async function copia() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiato(true)
      setTimeout(() => setCopiato(false), 2000)
    } catch {
      setCopiato(false)
    }
  }

  async function rimuovi(emailDaRimuovere: string) {
    if (!window.confirm(`Rimuovere ${emailDaRimuovere} dagli host autorizzati?`)) return
    setRimozione(emailDaRimuovere)
    try {
      const res = await fetch('/api/host-autorizzati', {
        method: 'DELETE',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${await token()}`,
        },
        body: JSON.stringify({ email: emailDaRimuovere }),
      })
      const dati = await res.json()
      if (!res.ok) {
        setErroreLista(dati.error || 'Non riesco a rimuovere questo host.')
      } else if (dati.nota) {
        setErroreLista(dati.nota)
      }
      await caricaLista()
    } catch {
      setErroreLista('Errore di connessione durante la rimozione.')
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
      <h1 className="text-xl font-bold mt-2 mb-1">Invita un nuovo host</h1>
      <p className="text-sm text-gray-500 mb-4">
        Autorizza l'email del cliente e ottieni un link da mandargli. Solo le email autorizzate qui
        possono accedere al pannello.
      </p>

      <label className="text-xs text-gray-500">Email del cliente</label>
      <input
        className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="cliente@esempio.com"
      />

      <label className="text-xs text-gray-500">Nome di riferimento</label>
      <input
        className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
        value={nomeRiferimento}
        onChange={(e) => setNomeRiferimento(e.target.value)}
        placeholder="Es. Mario Rossi — B&B Il Sole"
      />

      <label className="text-xs text-gray-500">Piano</label>
      <select
        className="w-full border rounded-lg px-3 py-2 text-sm mb-3 bg-white"
        value={piano}
        onChange={(e) => setPiano(e.target.value)}
      >
        {PIANI.map((p) => (
          <option key={p.valore} value={p.valore}>{p.etichetta}</option>
        ))}
      </select>

      <label className="text-xs text-gray-500">Note (facoltative)</label>
      <textarea
        className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <button
        onClick={invita}
        disabled={invio}
        className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm disabled:opacity-50"
      >
        {invio ? 'Sto creando l\'invito...' : 'Autorizza e genera il link'}
      </button>
      {errore && <p className="text-red-600 text-sm mt-2">{errore}</p>}

      {link && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-3">
          <p className="text-xs font-medium text-green-800 mb-2">Link di invito — mandalo al cliente</p>
          <input readOnly value={link} className="w-full border rounded-lg px-2 py-1.5 text-xs mb-2 bg-white" />
          <button onClick={copia} className="w-full border border-green-600 text-green-700 rounded-lg py-1.5 text-xs">
            {copiato ? 'Copiato ✓' : 'Copia link'}
          </button>
        </div>
      )}

      <hr className="my-6 border-gray-200" />

      <p className="text-xs font-medium text-gray-400 mb-2">HOST AUTORIZZATI ({lista.length})</p>
      {caricamento && <p className="text-sm">Caricamento...</p>}
      {erroreLista && <p className="text-sm text-gray-500">{erroreLista}</p>}
      <div className="flex flex-col gap-2">
        {lista.map((h) => (
          <div key={h.email} className="bg-white shadow rounded-xl p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm break-all">{h.email}</p>
                {h.nome_riferimento && <p className="text-xs text-gray-500">{h.nome_riferimento}</p>}
              </div>
              {h.email.toLowerCase() !== ADMIN_EMAIL && (
                <button
                  onClick={() => rimuovi(h.email)}
                  disabled={rimozione === h.email}
                  className="text-xs text-red-600 shrink-0 disabled:opacity-50"
                >
                  {rimozione === h.email ? '...' : 'Rimuovi'}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {h.piano ? h.piano[0].toUpperCase() + h.piano.slice(1) : 'nessun piano'}
              {' · '}
              {h.registrato_il ? 'registrato' : 'in attesa di registrazione'}
            </p>
            {h.note && <p className="text-xs text-gray-500 mt-1">{h.note}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
