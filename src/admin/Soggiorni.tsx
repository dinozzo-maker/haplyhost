import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Copy, Check, Trash2, MessageSquareText } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { oggiInItalia, statoSoggiorno } from '../../lib/soggiorni.js'
import { MOMENTI, LINGUE_MESSAGGI, momentoConsigliato, costruisciMessaggio } from '../../lib/messaggi-ospiti.js'
import type { MomentoMessaggio } from '../../lib/messaggi-ospiti.js'
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

// Etichette e suggerimenti dei messaggi pronti (i testi veri sono in lib/messaggi-ospiti.js).
const MESSAGGI_INFO: Record<MomentoMessaggio, { titolo: string; quando: string }> = {
  prima: { titolo: 'Il giorno prima dell\'arrivo', quando: 'Al posto del messaggio che mandi adesso: presenta la guida e dice che lì c\'è il Wi-Fi.' },
  arrivo: { titolo: 'La mattina dell\'arrivo', quando: 'Richiama la guida e il Wi-Fi proprio quando servono.' },
  meta: { titolo: 'A metà soggiorno', quando: 'Ricorda i consigli su cosa fare e Gennarino.' },
  partenza: { titolo: 'Prima della partenza', quando: 'Il giorno prima o la mattina del check-out.' },
  dopo: { titolo: 'Dopo la partenza', quando: 'Ringrazia e chiede una recensione (senza il link della guida).' },
}

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
  // Messaggi pronti: lingua scelta, quale è stato appena copiato, dati della casa per riempirli.
  const [linguaMessaggi, setLinguaMessaggi] = useState('it')
  const [messaggioCopiato, setMessaggioCopiato] = useState<string | null>(null)
  const [casa, setCasa] = useState<{ nome: string; host_nome: string | null; checkin: string | null; checkout: string | null } | null>(null)

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

  // Nome della casa, host e orari standard: servono a scrivere i messaggi pronti.
  useEffect(() => {
    if (!struttura) return
    let attivo = true
    void supabase.from('strutture').select('nome, host_nome, checkin, checkout').eq('id', struttura.id).maybeSingle()
      .then(({ data }) => { if (attivo && data) setCasa(data) })
    return () => { attivo = false }
  }, [struttura])

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

  async function copiaMessaggio(chiave: string, testo: string) {
    try {
      await navigator.clipboard.writeText(testo)
      setMessaggioCopiato(chiave)
      window.setTimeout(() => setMessaggioCopiato((c) => (c === chiave ? null : c)), 2000)
    } catch {
      window.prompt('Copia il messaggio:', testo)
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
        {elenco.length > 0 && (
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            Lingua dei messaggi pronti
            <select
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-normal text-slate-800"
              value={linguaMessaggi}
              onChange={(e) => setLinguaMessaggi(e.target.value)}
            >
              {LINGUE_MESSAGGI.map((l) => <option key={l.codice} value={l.codice}>{l.etichetta}</option>)}
            </select>
          </label>
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
                <details className="rounded-lg border border-slate-200">
                  <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-700">
                    <MessageSquareText className="w-4 h-4" /> Messaggi pronti da copiare
                  </summary>
                  <div className="flex flex-col gap-3 border-t border-slate-200 p-3">
                    {MOMENTI.map((momento) => {
                      const chiave = `${s.id}:${momento}`
                      const testo = costruisciMessaggio(momento, linguaMessaggi, {
                        nome: s.nome,
                        casa: casa?.nome ?? struttura.nome,
                        link: linkOspite(s.token),
                        checkin: s.checkin,
                        checkout: s.checkout,
                        orarioCheckin: casa?.checkin,
                        orarioCheckout: casa?.checkout,
                        host: casa?.host_nome,
                      })
                      const consigliato = momentoConsigliato(s.checkin, s.checkout, oggi) === momento
                      return (
                        <div key={momento} className={`rounded-lg p-3 ${consigliato ? 'border border-amber-300 bg-amber-50' : 'bg-slate-50'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{MESSAGGI_INFO[momento].titolo}</p>
                            {consigliato && <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-900">Consigliato ora</span>}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">{MESSAGGI_INFO[momento].quando}</p>
                          <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-800">{testo}</pre>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => copiaMessaggio(chiave, testo)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {messaggioCopiato === chiave ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                              {messaggioCopiato === chiave ? 'Copiato ✓' : 'Copia il messaggio'}
                            </button>
                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(testo)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center rounded-lg bg-[#25D366] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
                            >
                              Apri in WhatsApp
                            </a>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      </Sezione>
    </PaginaAdmin>
  )
}
