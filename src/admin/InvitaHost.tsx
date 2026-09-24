import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { ContestoHost } from './RichiedeLogin'
import { PaginaAdmin, Sezione, Campo, classeCampo, Pulsante, Esito } from './ui'

const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase()

type HostRow = {
  email: string
  nome_riferimento: string | null
  piano: string | null
  note: string | null
  autorizzato_il: string
  registrato_il: string | null
  unita_incluse: number | null
  unita_usate: number
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
  const [unitaIncluse, setUnitaIncluse] = useState('') // vuoto = piano base (5)

  // Upgrade di un host già autorizzato: bozza del nuovo limite per email, e host in salvataggio.
  const [bozzeUnita, setBozzeUnita] = useState<Record<string, string>>({})
  const [salvandoUnita, setSalvandoUnita] = useState('')

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
          // Solo se scritto: lasciato vuoto un nuovo host parte dal piano base (5 unità) e a un host
          // già autorizzato non si tocca il limite che gli era stato dato.
          ...(unitaIncluse.trim() ? { unita_incluse: unitaIncluse.trim() } : {}),
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
      setUnitaIncluse('')
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

  // Upgrade (o riduzione) del piano: cambia le unità incluse di un host. Abbassare sotto le
  // unità già usate non toglie nulla all'host, gli impedisce solo di aggiungerne altre.
  async function salvaUnita(h: HostRow) {
    const valore = (bozzeUnita[h.email] ?? '').trim()
    if (!valore) return
    setSalvandoUnita(h.email)
    setErroreLista('')
    try {
      const res = await fetch('/api/host-autorizzati', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ email: h.email, unita_incluse: valore }),
      })
      const dati = await res.json()
      if (!res.ok) {
        setErroreLista(dati.error || 'Non riesco ad aggiornare le unità.')
      } else {
        setBozzeUnita((b) => {
          const resto = { ...b }
          delete resto[h.email]
          return resto
        })
        await caricaLista()
      }
    } catch {
      setErroreLista('Errore di connessione durante l\'aggiornamento.')
    } finally {
      setSalvandoUnita('')
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
      <PaginaAdmin titolo="Invita un nuovo host" indietro="/admin/piattaforma">
        <p className="text-sm text-slate-500">Sezione riservata all'amministratore della piattaforma.</p>
      </PaginaAdmin>
    )
  }

  return (
    <PaginaAdmin
      titolo="Invita un nuovo host"
      sottotitolo="Autorizza l'email del cliente e ottieni un link da mandargli. Solo le email autorizzate qui possono accedere al pannello."
      indietro="/admin/piattaforma"
    >
      <Sezione>
        <Campo etichetta="Email del cliente">
          <input
            className={classeCampo}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@esempio.com"
          />
        </Campo>

        <Campo etichetta="Nome di riferimento">
          <input
            className={classeCampo}
            value={nomeRiferimento}
            onChange={(e) => setNomeRiferimento(e.target.value)}
            placeholder="Es. Mario Rossi — B&B Il Sole"
          />
        </Campo>

        <Campo etichetta="Piano">
          <select className={classeCampo} value={piano} onChange={(e) => setPiano(e.target.value)}>
            {PIANI.map((p) => (
              <option key={p.valore} value={p.valore}>{p.etichetta}</option>
            ))}
          </select>
        </Campo>

        <Campo etichetta="Unità incluse (facoltativo)" aiuto="Camere o alloggi inclusi nel piano. Lascia vuoto per 5 (piano base). Per un host già autorizzato, lasciando vuoto il suo limite non cambia.">
          <input
            className={classeCampo}
            type="number"
            min={1}
            max={999}
            value={unitaIncluse}
            onChange={(e) => setUnitaIncluse(e.target.value)}
            placeholder="5"
          />
        </Campo>

        <Campo etichetta="Note (facoltative)">
          <textarea className={classeCampo} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Campo>

        <Pulsante onClick={invita} disabled={invio}>
          {invio ? 'Sto creando l\'invito...' : 'Autorizza e genera il link'}
        </Pulsante>
        {errore && <Esito ok={false}>{errore}</Esito>}

        {link && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 flex flex-col gap-2">
            <p className="text-xs font-medium text-green-800">Link di invito — mandalo al cliente</p>
            <input readOnly value={link} className="w-full border border-green-200 rounded-lg px-2.5 py-1.5 text-xs bg-white" />
            <Pulsante variante="secondario" onClick={copia} className="border-green-300 text-green-700 hover:bg-green-100">
              {copiato ? 'Copiato ✓' : 'Copia link'}
            </Pulsante>
          </div>
        )}
      </Sezione>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Host autorizzati ({lista.length})</p>
        {caricamento && <p className="text-sm text-slate-500">Caricamento...</p>}
        {erroreLista && <p className="text-sm text-slate-500">{erroreLista}</p>}
        <div className="flex flex-col gap-2">
          {lista.map((h) => (
            <div key={h.email} className="bg-white border border-slate-200 shadow-sm rounded-xl p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-slate-900 break-all">{h.email}</p>
                  {h.nome_riferimento && <p className="text-xs text-slate-500">{h.nome_riferimento}</p>}
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
              <p className="text-xs text-slate-400 mt-1">
                {h.piano ? h.piano[0].toUpperCase() + h.piano.slice(1) : 'nessun piano'}
                {' · '}
                {h.registrato_il ? 'registrato' : 'in attesa di registrazione'}
              </p>
              {h.note && <p className="text-xs text-slate-500 mt-1">{h.note}</p>}
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <span>
                  Unità: <strong>{h.unita_usate}</strong> di{' '}
                  <strong>{h.unita_incluse == null || h.unita_incluse >= 999 ? 'illimitate' : h.unita_incluse}</strong>
                </span>
                {h.email.toLowerCase() !== ADMIN_EMAIL && (
                  <>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      aria-label={`Nuove unità incluse per ${h.email}`}
                      className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-xs"
                      value={bozzeUnita[h.email] ?? ''}
                      onChange={(e) => setBozzeUnita((b) => ({ ...b, [h.email]: e.target.value }))}
                      placeholder="nuove"
                    />
                    <button
                      onClick={() => salvaUnita(h)}
                      disabled={salvandoUnita === h.email || !(bozzeUnita[h.email] ?? '').trim()}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      {salvandoUnita === h.email ? '...' : 'Aggiorna'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PaginaAdmin>
  )
}
