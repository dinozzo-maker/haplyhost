import { useRef, useState } from 'react'
import { Sparkles, PencilLine, ArrowRight } from 'lucide-react'
import IndirizzoAutomatico from './IndirizzoAutomatico'
import { supabase } from '../supabaseClient'
import { CHIAVE_STRUTTURA_SELEZIONATA } from './RichiedeLogin'
import { PaginaAdmin, Sezione, Campo, classeCampo, Pulsante, Esito } from './ui'
import RetiWifi from './RetiWifi'
import type { ReteWifi } from './RetiWifi'
import PassiConfigurazione from './PassiConfigurazione'
import { useUnita } from '../useUnita'
import { leggiUnita, verificaUnita } from '../../lib/unita.js'

export default function CreaStruttura({ aggiuntiva = false }: { aggiuntiva?: boolean }) {
  const [modalita, setModalita] = useState<'guidata' | 'manuale' | null>(null)
  const [nome, setNome] = useState('')
  const [indirizzo, setIndirizzo] = useState('')
  const [citta, setCitta] = useState('')
  const [link, setLink] = useState('')
  const [hostNome, setHostNome] = useState('')
  const [telefono, setTelefono] = useState('')
  const [checkin, setCheckin] = useState('')
  const [checkout, setCheckout] = useState('')
  const [reti, setReti] = useState<ReteWifi[]>([])
  const [unita, setUnita] = useState('1')
  const { unita: quota } = useUnita()
  const [caricamento, setCaricamento] = useState(false)
  const [errore, setErrore] = useState('')
  const richiestaId = useRef(crypto.randomUUID())
  const invioInCorso = useRef(false)

  async function crea() {
    if (invioInCorso.current) return
    if (!nome.trim() || !indirizzo.trim()) { setErrore('Nome e indirizzo sono obbligatori.'); return }
    if (reti.some(rete => !rete.nome.trim() && (rete.password || rete.zona))) { setErrore('Inserisci il nome di ogni rete Wi-Fi oppure rimuovila.'); return }
    let richieste: number
    try { richieste = leggiUnita(unita) } catch (e) { setErrore(e instanceof Error ? e.message : 'Numero di unità non valido.'); return }
    // Il server e il database ricontrollano: qui si evita solo di far partire la richiesta.
    if (quota) {
      const verifica = verificaUnita({ usate: quota.usate, incluse: quota.incluse, richieste })
      if (!verifica.ok) { setErrore(verifica.messaggio); return }
    }
    invioInCorso.current = true
    setErrore('')
    setCaricamento(true)
    try {
      const { data } = await supabase.auth.getSession()
      const res = await fetch('/api/importa-casa', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nome, indirizzo, citta, link: modalita === 'guidata' ? link : '', unita: richieste,
          host_nome: hostNome, host_telefono: telefono, checkin, checkout, reti_wifi: reti,
          modalita, richiesta_id: richiestaId.current, access_token: data.session?.access_token }),
      })
      const dati = await res.json()
      if (!res.ok) throw new Error(dati.error || 'Errore nella creazione.')
      try { localStorage.setItem(CHIAVE_STRUTTURA_SELEZIONATA, dati.struttura.id) } catch { /* Selezione anche nell’URL. */ }
      window.location.href = `/admin/configurazione?struttura=${encodeURIComponent(dati.struttura.id)}`
    } catch (errore) {
      setErrore(errore instanceof Error ? errore.message : 'Errore di connessione, riprova.')
      setCaricamento(false)
      invioInCorso.current = false
    }
  }

  if (!modalita) return <PaginaAdmin titolo={aggiuntiva ? 'Una nuova casa, una nuova guida' : 'Come vuoi creare la tua guida?'} indietro={aggiuntiva}
    sottotitolo="Scegli da dove partire. Potrai sempre modificare ogni contenuto dal pannello.">
    <div className="grid gap-4 lg:grid-cols-2">
      <button onClick={() => setModalita('guidata')} className="text-left rounded-2xl border-2 border-amber-400 bg-white p-6 shadow-sm hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-amber-500">
        <span className="inline-block rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 mb-5">Consigliata</span>
        <Sparkles className="w-7 h-7 text-amber-600 mb-4" />
        <h2 className="text-lg font-bold text-slate-900">Configurazione guidata</h2>
        <p className="text-sm text-slate-500 leading-relaxed mt-2">Inserisci i dati della casa, scegli le sezioni e lascia a noi la ricerca dei luoghi. Controlli tutto prima di pubblicare.</p>
        <span className="inline-flex items-center gap-2 mt-6 text-sm font-semibold text-slate-900">Iniziamo <ArrowRight className="w-4 h-4" /></span>
      </button>
      <button onClick={() => setModalita('manuale')} className="text-left rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-amber-500">
        <PencilLine className="w-7 h-7 text-slate-500 mb-4" />
        <h2 className="text-lg font-bold text-slate-900">Configurazione manuale</h2>
        <p className="text-sm text-slate-500 leading-relaxed mt-2">Parti da una guida vuota e aggiungi contenuti e luoghi in autonomia. Nessuna ricerca automatica.</p>
        <span className="inline-flex items-center gap-2 mt-6 text-sm font-semibold text-slate-900">Faccio da me <ArrowRight className="w-4 h-4" /></span>
      </button>
    </div>
    <p className="text-xs text-slate-500">La guida resterà in bozza fino a quando deciderai di pubblicarla.</p>
  </PaginaAdmin>

  return <PaginaAdmin titolo="Parlami della tua casa" indietro={aggiuntiva} sottotitolo="Bastano nome e indirizzo per iniziare. Gli altri dettagli puoi aggiungerli anche dopo.">
    <PassiConfigurazione passo={1} />
    <form onSubmit={e => { e.preventDefault(); void crea() }} className="flex flex-col gap-6">
      <fieldset disabled={caricamento} className="flex min-w-0 flex-col gap-6">
        <Sezione titolo="La tua struttura">
          <Campo etichetta="Nome della struttura"><input required maxLength={200} className={classeCampo} value={nome} onChange={e => setNome(e.target.value)} placeholder="Es. Villa Virginia" /></Campo>
          <IndirizzoAutomatico valore={indirizzo} onChange={valore => { setIndirizzo(valore); setCitta('') }} onSeleziona={setCitta} />
          {modalita === 'guidata' && <Campo etichetta="Link del sito o dell’annuncio (facoltativo)" aiuto="Proveremo a ricavare la descrizione. Se il sito non è leggibile, potrai scriverla dal pannello."><input type="url" maxLength={2000} className={classeCampo} value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." /></Campo>}
        </Sezione>
        <Sezione titolo="Camere o alloggi" nota={quota && quota.incluse !== null ? `Il tuo piano include ${quota.incluse} unità: ne hai già usate ${quota.usate}.` : undefined}>
          <Campo etichetta="Quante camere o alloggi prenotabili?" aiuto="Un B&B con 5 camere: 5. Una casa o un appartamento intero: 1. Conta per il limite del tuo piano.">
            <input type="number" required min={1} max={999} className={classeCampo} value={unita} onChange={e => setUnita(e.target.value)} />
          </Campo>
        </Sezione>
        <Sezione titolo="Arrivo e contatti" nota="Informazioni facoltative, utili ai tuoi ospiti.">
          <div className="grid gap-4 lg:grid-cols-2">
            <Campo etichetta="Check-in"><input className={classeCampo} value={checkin} maxLength={100} onChange={e => setCheckin(e.target.value)} placeholder="Es. dalle 15:00" /></Campo>
            <Campo etichetta="Check-out"><input className={classeCampo} value={checkout} maxLength={100} onChange={e => setCheckout(e.target.value)} placeholder="Es. entro le 10:00" /></Campo>
          </div>
          <Campo etichetta="Nome dell’host"><input className={classeCampo} autoComplete="name" maxLength={200} value={hostNome} onChange={e => setHostNome(e.target.value)} /></Campo>
          <Campo etichetta="Numero WhatsApp" aiuto="Inserisci anche il prefisso internazionale, per esempio +39."><input type="tel" className={classeCampo} maxLength={80} value={telefono} onChange={e => setTelefono(e.target.value)} /></Campo>
        </Sezione>
        <Sezione><RetiWifi reti={reti} onChange={setReti} /></Sezione>
      </fieldset>
      {errore && <div role="alert"><Esito ok={false}>{errore}</Esito></div>}
      <div className="sticky bottom-0 bg-slate-50/95 border-t border-slate-200 py-4 grid grid-cols-[1fr_2fr] gap-3">
        <Pulsante type="button" variante="secondario" disabled={caricamento} onClick={() => setModalita(null)}>Indietro</Pulsante>
        <Pulsante type="submit" disabled={caricamento}>{caricamento ? 'Salvo la casa…' : 'Salva e continua'}</Pulsante>
      </div>
    </form>
  </PaginaAdmin>
}
