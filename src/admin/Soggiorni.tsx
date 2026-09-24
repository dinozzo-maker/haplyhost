import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Copy, Check, Trash2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { oggiInItalia, statoSoggiorno } from '../../lib/soggiorni.js'
import type { ContestoHost } from './RichiedeLogin'
import { PaginaAdmin, Sezione, Campo, classeCampo, Pulsante, Esito } from './ui'

type Soggiorno = {
  id: string
  nome: string
  checkin: string
  checkout: string
  token: string
  // Aperture della guida col link di questo soggiorno (migration 0024). Assenti se la
  // migration non è ancora stata lanciata: la pagina funziona lo stesso, senza conteggio.
  aperture?: number
  ultima_apertura?: string | null
}

const ETICHETTA_STATO = {
  presto: { testo: 'In arrivo', classe: 'bg-amber-100 text-amber-800' },
  in_corso: { testo: 'In corso', classe: 'bg-green-100 text-green-800' },
  scaduto: { testo: 'Concluso', classe: 'bg-slate-100 text-slate-500' },
} as const

function formatta(giorno: string) {
  return new Date(`${giorno}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formattaOra(istante: string) {
  return new Date(istante).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function Soggiorni() {
  const { struttura } = useOutletContext<ContestoHost>()

  const [elenco, setElenco] = useState<Soggiorno[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [nome, setNome] = useState('')
  const [checkin, setCheckin] = useState('')
  const [checkout, setCheckout] = useState('')
  const [salvataggio, setSalvataggio] = useState(false)
  const [errore, setErrore] = useState('')
  const [copiato, setCopiato] = useState<string | null>(null)

  const carica = useCallback(async () => {
    if (!struttura) return
    const base = 'id, nome, checkin, checkout, token'
    let righe: Soggiorno[] | null = null
    let fallita = false
    const completa = await supabase
      .from('soggiorni')
      .select(`${base}, aperture, ultima_apertura`)
      .eq('struttura_id', struttura.id)
      .order('checkin', { ascending: false })
    if (!completa.error) {
      righe = completa.data as Soggiorno[]
    } else {
      // Senza le colonne nuove (migration 0024 non ancora lanciata) si carica comunque l'elenco.
      const semplice = await supabase
        .from('soggiorni')
        .select(base)
        .eq('struttura_id', struttura.id)
        .order('checkin', { ascending: false })
      if (semplice.error) fallita = true
      else righe = semplice.data as Soggiorno[]
    }
    if (fallita) {
      setErrore('Non riesco a caricare i soggiorni.')
    } else {
      setElenco(righe ?? [])
    }
    setCaricamento(false)
  }, [struttura])

  useEffect(() => {
    void carica()
  }, [carica])

  if (!struttura) {
    return (
      <PaginaAdmin titolo="Soggiorni e Wi-Fi">
        <p className="text-sm text-slate-500">Non hai ancora una struttura.</p>
      </PaginaAdmin>
    )
  }

  const linkOspite = (token: string) => `${window.location.origin}/${struttura.slug}?s=${token}`

  async function aggiungi() {
    if (!struttura) return
    setErrore('')
    if (!nome.trim()) return setErrore('Scrivi il nome dell’ospite: compare nel suo benvenuto (es. Famiglia Rossi).')
    if (!checkin || !checkout) return setErrore('Scegli la data di check-in e quella di check-out.')
    if (checkout < checkin) return setErrore('Il check-out non può essere prima del check-in.')

    setSalvataggio(true)
    const { error } = await supabase
      .from('soggiorni')
      .insert({ struttura_id: struttura.id, nome: nome.trim(), checkin, checkout })
    setSalvataggio(false)
    if (error) return setErrore('Errore nel salvataggio: ' + error.message)

    setNome('')
    setCheckin('')
    setCheckout('')
    await carica()
  }

  async function elimina(s: Soggiorno) {
    if (!window.confirm(`Eliminare il soggiorno di ${s.nome}? Il suo link smetterà subito di funzionare.`)) return
    const { error } = await supabase.from('soggiorni').delete().eq('id', s.id)
    if (error) return setErrore('Errore: ' + error.message)
    await carica()
  }

  async function copiaLink(s: Soggiorno) {
    try {
      await navigator.clipboard.writeText(linkOspite(s.token))
      setCopiato(s.id)
      window.setTimeout(() => setCopiato((c) => (c === s.id ? null : c)), 2000)
    } catch {
      window.prompt('Copia il link:', linkOspite(s.token))
    }
  }

  const oggi = oggiInItalia()

  return (
    <PaginaAdmin
      titolo="Soggiorni e Wi-Fi"
      sottotitolo={
        <>
          Con il suo link personale l’ospite vede un benvenuto con il suo nome e le sue date, e la password del Wi-Fi <strong>solo dal giorno del check-in al giorno del
          check-out</strong>. Crea un soggiorno, copia il link e mandalo
          all’ospite (WhatsApp, email…). Le reti si inseriscono in{' '}
          <Link to="/admin/modifica-casa" className="underline">Dati della casa</Link>.
          Vedi anche se l'ospite ha aperto la guida (conta una visita ogni 30 minuti; anche le aperture che fai tu per provare il link).
        </>
      }
    >
      <Sezione titolo="Nuovo soggiorno">
        <Campo etichetta="Nome dell’ospite" aiuto="Compare nel benvenuto dell’ospite (es. «Buongiorno, Famiglia Rossi!») e serve a te per riconoscere il soggiorno. Lo vede solo chi apre il suo link.">
          <input className={classeCampo} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. Famiglia Rossi" maxLength={80} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etichetta="Check-in">
            <input type="date" className={classeCampo} value={checkin} onChange={(e) => {
              setCheckin(e.target.value)
              if (!checkout || checkout < e.target.value) setCheckout(e.target.value)
            }} />
          </Campo>
          <Campo etichetta="Check-out">
            <input type="date" className={classeCampo} value={checkout} min={checkin || undefined} onChange={(e) => setCheckout(e.target.value)} />
          </Campo>
        </div>
        <Pulsante onClick={aggiungi} disabled={salvataggio}>{salvataggio ? 'Salvo...' : 'Crea soggiorno e link'}</Pulsante>
        {errore && <Esito ok={false}>{errore}</Esito>}
      </Sezione>

      <Sezione titolo="Soggiorni">
        {caricamento && <p className="text-sm text-slate-500">Caricamento...</p>}
        {!caricamento && elenco.length === 0 && (
          <p className="text-sm text-slate-500">Nessun soggiorno ancora. Creane uno qui sopra.</p>
        )}
        <ul className="flex flex-col gap-3">
          {elenco.map((s) => {
            const statoChiave = statoSoggiorno(s.checkin, s.checkout, oggi)
            const stato = ETICHETTA_STATO[statoChiave]
            return (
              <li key={s.id} className="flex flex-col gap-2 border border-slate-200 rounded-xl p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{s.nome}</p>
                    <p className="text-xs text-slate-500">{formatta(s.checkin)} → {formatta(s.checkout)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${stato.classe}`}>{stato.testo}</span>
                </div>
                {s.aperture !== undefined && (
                  s.aperture > 0 ? (
                    <p className="text-xs text-green-700">
                      Guida aperta {s.aperture} {s.aperture === 1 ? 'volta' : 'volte'}
                      {s.ultima_apertura ? ` · ultima il ${formattaOra(s.ultima_apertura)}` : ''}
                    </p>
                  ) : (
                    <p className={`text-xs ${statoChiave === 'in_corso' ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>
                      {statoChiave === 'in_corso'
                        ? 'Non ha ancora aperto la guida: potresti mandargli un promemoria.'
                        : statoChiave === 'scaduto' ? 'La guida non è stata aperta.' : 'Non ancora aperta.'}
                    </p>
                  )
                )}
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => copiaLink(s)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {copiato === s.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    {copiato === s.id ? 'Link copiato ✓' : 'Copia il link'}
                  </button>
                  <button
                    onClick={() => elimina(s)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" /> Elimina
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </Sezione>
    </PaginaAdmin>
  )
}
