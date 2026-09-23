import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { invalidaCacheSezioni } from '../useSezioni'
import type { ContestoHost } from './RichiedeLogin'
import { Icona } from '../Icona'
import { ICONE_SCELTA } from '../icone'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { PaginaAdmin, Sezione, Campo, classeCampo, Pulsante, Esito } from './ui'

const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase()

// Icone tra cui scegliere per una sezione custom, in righe tematiche (vedi icone.tsx).
const ICONE_PIATTE = ICONE_SCELTA.flat()

type SezioneExtra = {
  chiave: string
  icona: string
  etichetta: string
  descrizione: string | null
  tipo: string
  categoria: string | null
  archiviata: boolean
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
  const [modifica, setModifica] = useState<SezioneExtra | null>(null)

  async function token() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? ''
  }

  async function caricaLista() {
    const { data } = await supabase
      .from('sezioni_extra')
      .select('chiave, icona, etichetta, descrizione, tipo, categoria, archiviata')
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

  function apriModifica(s: SezioneExtra) {
    setErrore('')
    setModifica(s)
    setEtichetta(s.etichetta)
    setIcona(s.icona)
    setDescrizione(s.descrizione ?? '')
    setTipo(s.tipo === 'elenco' ? 'elenco' : 'testo')
    setCategoria(s.categoria ?? '')
    setPickerAperto(false)
  }

  function annullaModifica() {
    setModifica(null)
    setEtichetta('')
    setIcona('')
    setDescrizione('')
    setCategoria('')
    setTipo('testo')
    setPickerAperto(false)
    setErrore('')
  }

  async function salvaModifica() {
    if (!modifica || !etichetta.trim()) {
      setErrore('Serve almeno un nome.')
      return
    }
    setErrore('')
    setInvio(true)
    try {
      const res = await fetch('/api/sezioni-extra', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          access_token: await token(),
          chiave: modifica.chiave,
          etichetta: etichetta.trim(),
          icona: icona.trim(),
          descrizione: descrizione.trim(),
          categoria: modifica.tipo === 'elenco' ? categoria.trim() : '',
        }),
      })
      const dati = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrore(dati.error || 'Errore nel salvataggio.')
        return
      }
      annullaModifica()
      invalidaCacheSezioni()
      await caricaLista()
    } catch {
      setErrore('Errore di connessione, riprova.')
    } finally {
      setInvio(false)
    }
  }

  async function elimina(s: SezioneExtra) {
    if (!window.confirm(`Archiviare la sezione "${s.etichetta}"? Sparirà da tutte le guide, ma i contenuti degli host resteranno conservati e potrai ripristinarla in futuro.`)) return
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
        setErrore(dati.error || 'Non riesco ad archiviare la sezione.')
        return
      }
      invalidaCacheSezioni()
      await caricaLista()
    } catch {
      setErrore('Errore di connessione durante l\'eliminazione.')
    } finally {
      setRimozione('')
    }
  }

  async function ripristina(s: SezioneExtra) {
    setRimozione(s.chiave)
    setErrore('')
    try {
      const res = await fetch('/api/sezioni-extra', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${await token()}`,
        },
        body: JSON.stringify({ chiave: s.chiave }),
      })
      const dati = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrore(dati.error || 'Non riesco a ripristinare la sezione.')
        return
      }
      invalidaCacheSezioni()
      await caricaLista()
    } catch {
      setErrore('Errore di connessione durante il ripristino.')
    } finally {
      setRimozione('')
    }
  }

  if (!isSuperadmin) {
    return (
      <PaginaAdmin titolo="Sezioni della piattaforma" indietro="/admin/piattaforma">
        <p className="text-sm text-slate-500">Sezione riservata all'amministratore della piattaforma.</p>
      </PaginaAdmin>
    )
  }

  return (
    <PaginaAdmin
      titolo="Sezioni della piattaforma"
      sottotitolo="Sezioni extra che si aggiungono a quelle di serie. Ogni host le trova in “Sezioni della guida” e decide se attivarle: nascono spente per tutti."
      indietro="/admin/piattaforma"
    >
      <Sezione>
        {modifica && (
          <p className="text-sm font-semibold text-slate-900">
            Modifica “{modifica.etichetta}”
            <span className="block text-xs font-normal text-slate-500 mt-1">Il tipo resta {modifica.tipo === 'elenco' ? 'lista di luoghi' : 'pagina di testo'} per non rendere invisibili i contenuti esistenti.</span>
          </p>
        )}
        <Campo etichetta="Nome della sezione">
          <input
            className={classeCampo}
            value={etichetta}
            onChange={(e) => setEtichetta(e.target.value)}
            placeholder="Es. Per un'occasione speciale"
          />
        </Campo>

        <Campo etichetta="Icona">
          <button
            type="button"
            onClick={() => setPickerAperto((v) => !v)}
            className={`${classeCampo} flex items-center justify-between cursor-pointer`}
          >
            <span className="inline-flex items-center gap-2 text-slate-700">
              <Icona nome={icona} className="w-5 h-5 text-slate-600" />
              {icona ? 'Cambia icona' : 'Scegli un’icona'}
            </span>
            {pickerAperto ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {pickerAperto && (
            <div className="mt-2 grid grid-cols-8 gap-1 border border-slate-200 rounded-xl p-2 bg-white">
              {ICONE_PIATTE.map((nomeIcona) => (
                <button
                  key={nomeIcona}
                  type="button"
                  onClick={() => { setIcona(nomeIcona); setPickerAperto(false) }}
                  className={`flex items-center justify-center rounded-lg py-1.5 hover:bg-slate-100 ${icona === nomeIcona ? 'bg-amber-100' : ''}`}
                >
                  <Icona nome={nomeIcona} className="w-5 h-5 text-slate-700" />
                </button>
              ))}
            </div>
          )}
        </Campo>

        <Campo etichetta="Descrizione breve">
          <input
            className={classeCampo}
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value)}
            placeholder="Allestimenti e sorprese per compleanni, anniversari, lauree"
          />
        </Campo>

        <Campo etichetta="Tipo">
          <select className={classeCampo} value={tipo} disabled={!!modifica} onChange={(e) => setTipo(e.target.value as 'testo' | 'elenco')}>
            <option value="testo">Pagina di testo (l'host scrive un testo)</option>
            <option value="elenco">Lista di luoghi (con ricerca online)</option>
          </select>
        </Campo>

        {tipo === 'elenco' && (
          <Campo etichetta="Cosa cerca la ricerca online">
            <input
              className={classeCampo}
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Es. noleggi barche e gommoni"
            />
          </Campo>
        )}

        <Pulsante onClick={modifica ? salvaModifica : crea} disabled={invio || !etichetta.trim()}>
          {invio ? 'Salvo...' : modifica ? 'Salva modifiche' : 'Crea sezione'}
        </Pulsante>
        {modifica && <Pulsante variante="secondario" onClick={annullaModifica} disabled={invio}>Annulla</Pulsante>}
        {errore && <Esito ok={false}>{errore}</Esito>}
      </Sezione>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sezioni attive ({lista.filter((s) => !s.archiviata).length})</p>
        {caricamento && <p className="text-sm text-slate-500">Caricamento...</p>}
        <div className="flex flex-col gap-2">
          {lista.filter((s) => !s.archiviata).map((s) => (
            <div key={s.chiave} className="bg-white border border-slate-200 shadow-sm rounded-xl p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 inline-flex items-center gap-1.5">
                    <Icona nome={s.icona} className="w-4 h-4 shrink-0 text-slate-600" /> {s.etichetta}
                  </p>
                  <p className="text-xs text-slate-400">
                    {s.tipo === 'elenco' ? 'lista di luoghi' : 'pagina di testo'}
                    {s.tipo === 'elenco' && s.categoria ? ` · cerca: ${s.categoria}` : ''}
                  </p>
                  {s.descrizione && <p className="text-xs text-slate-500 mt-1">{s.descrizione}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => apriModifica(s)} className="text-xs font-medium text-slate-600 hover:text-slate-900">Modifica</button>
                  <button
                    onClick={() => elimina(s)}
                    disabled={rimozione === s.chiave}
                    className="text-xs text-red-600 disabled:opacity-50"
                  >
                    {rimozione === s.chiave ? '...' : 'Archivia'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {lista.some((s) => s.archiviata) && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Archiviate ({lista.filter((s) => s.archiviata).length})</p>
          {lista.filter((s) => s.archiviata).map((s) => (
            <div key={s.chiave} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-600 inline-flex items-center gap-1.5 min-w-0"><Icona nome={s.icona} className="w-4 h-4 shrink-0" /> {s.etichetta}</p>
              <button onClick={() => ripristina(s)} disabled={rimozione === s.chiave} className="text-xs font-medium text-slate-700 shrink-0 disabled:opacity-50">
                {rimozione === s.chiave ? '...' : 'Ripristina'}
              </button>
            </div>
          ))}
        </div>
      )}
    </PaginaAdmin>
  )
}
