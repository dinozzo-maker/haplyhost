import { useEffect, useRef, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import { Sparkles, Check, LoaderCircle } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useSezioni } from '../useSezioni'
import { filtraVisibili } from '../sezioni'
import type { ContestoHost, StrutturaHost } from './RichiedeLogin'
import { PaginaAdmin, Sezione, Pulsante, Esito } from './ui'
import PassiConfigurazione from './PassiConfigurazione'
import SceltaSezioni from './SceltaSezioni'
import { possibileDuplicato } from '../../lib/identita-luoghi.js'

type Ricerca = { sezione: string; stato: 'in_corso' | 'completata' | 'errore' }
type Proposta = { id: string; sezione: string; nome: string; descrizione: string; distanza: string; verifica: { fonti?: { url: string; titolo: string }[] } | null }
const RAGGI: Record<string, number> = { vicinanze: 1, trasporti: 1, mangiare: 5, spiagge: 5, visitare: 15, divertimento: 5, gite: 30 }
const FASCE: Record<number, string> = { 1: 'entro 1 km', 5: 'entro 5 km', 15: 'entro 15 km', 30: 'entro 30 km' }

export default function ConfiguraGuida() {
  const contesto = useOutletContext<ContestoHost>()
  const [parametri, setParametri] = useSearchParams()
  const richiesta = parametri.get('struttura')
  useEffect(() => {
    if (!richiesta) return
    if (contesto.strutture.some(s => s.id === richiesta)) contesto.selezionaStruttura(richiesta)
    setParametri({}, { replace: true })
  }, [richiesta, contesto, setParametri])
  if (!contesto.struttura || richiesta) return <p className="p-6 text-slate-500">Caricamento configurazione…</p>
  return <Percorso key={contesto.struttura.id} struttura={contesto.struttura} aggiornaSezioni={contesto.aggiornaSezioniAttive} />
}

function Percorso({ struttura, aggiornaSezioni }: { struttura: StrutturaHost; aggiornaSezioni: (sezioni: string[]) => void }) {
  const { tutte, caricamento: caricamentoSezioni } = useSezioni()
  const [passo, setPasso] = useState(2)
  const [modalita, setModalita] = useState<'guidata' | 'manuale'>('guidata')
  const [attive, setAttive] = useState<string[]>([])
  const [ricerche, setRicerche] = useState<Ricerca[]>([])
  const [proposte, setProposte] = useState<Proposta[]>([])
  const [scelte, setScelte] = useState<string[]>([])
  const [pagine, setPagine] = useState<string[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [erroreIniziale, setErroreIniziale] = useState('')
  const [occupato, setOccupato] = useState(false)
  const [errore, setErrore] = useState('')
  const [messaggio, setMessaggio] = useState('')
  const [attuale, setAttuale] = useState('')
  const [online, setOnline] = useState(struttura.attivo)
  const blocco = useRef(false)
  const vivo = useRef(true)
  useEffect(() => { vivo.current = true; return () => { vivo.current = false } }, [])

  async function caricaRiepilogo() {
    const [r, p, l, pag] = await Promise.all([
      supabase.from('ricerche_configurazione').select('sezione, stato').eq('struttura_id', struttura.id),
      supabase.from('proposte').select('id, sezione, nome, descrizione, distanza, verifica').eq('struttura_id', struttura.id),
      supabase.from('luoghi').select('nome').eq('struttura_id', struttura.id),
      supabase.from('pagine').select('chiave, contenuto').eq('struttura_id', struttura.id),
    ])
    if (r.error || p.error || l.error || pag.error) throw new Error('Non riesco a caricare il riepilogo. Riprova.')
    if (!vivo.current) return
    const nomi = (l.data || []).map(luogo => luogo.nome)
    const valide = (p.data || []).filter(proposta => !possibileDuplicato(proposta.nome, nomi))
    setRicerche(r.data as Ricerca[])
    setProposte(valide)
    // La selezione resta esplicita: leggere una proposta non significa approvarla.
    setScelte(precedenti => precedenti.filter(id => valide.some(p => p.id === id)))
    setPagine((pag.data || []).filter(pagina => pagina.contenuto?.trim()).map(pagina => pagina.chiave))
  }

  useEffect(() => {
    if (caricamentoSezioni) return
    let attivo = true
    void (async () => {
      try {
        const { data, error } = await supabase.from('configurazioni_guida').select('modalita, passo').eq('struttura_id', struttura.id).maybeSingle()
        if (error) throw new Error('Configurazione non disponibile: serve l’aggiornamento del database.')
        if (!data) throw new Error('Questa struttura si gestisce dal pannello. Il percorso guidato è riservato alle nuove strutture.')
        if (!attivo) return
        setModalita(data.modalita)
        setPasso(data.passo)
        setAttive(filtraVisibili(tutte, struttura.sezioni_attive).map(s => s.chiave))
        await caricaRiepilogo()
      } catch (errore) { if (attivo) setErroreIniziale(errore instanceof Error ? errore.message : 'Errore di caricamento.') }
      finally { if (attivo) setCaricamento(false) }
    })()
    return () => { attivo = false }
    // Caricamento iniziale per struttura; le scelte successive vivono in questo modulo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [struttura.id, caricamentoSezioni])

  const elenchi = tutte.filter(s => s.tipo === 'elenco' && attive.includes(s.chiave))
  const visibili = proposte.filter(p => attive.includes(p.sezione))
  const mancanti = tutte.filter(s => s.tipo === 'testo' && attive.includes(s.chiave) && !pagine.includes(s.chiave))
  const daCercare = elenchi.filter(s => !ricerche.some(r => r.sezione === s.chiave))
  const numeroScelte = scelte.filter(id => visibili.some(p => p.id === id)).length

  async function esegui(azione: () => Promise<void>) {
    if (blocco.current) return
    blocco.current = true; setOccupato(true); setErrore(''); setMessaggio('')
    try { await azione() } catch (errore) { if (vivo.current) setErrore(errore instanceof Error ? errore.message : 'Operazione non riuscita. Riprova.') }
    finally { blocco.current = false; if (vivo.current) { setOccupato(false); setAttuale('') } }
  }
  async function continua() {
    if (!attive.length) throw new Error('Scegli almeno una sezione per la tua guida.')
    if (modalita === 'guidata' && elenchi.length > 10) throw new Error('Scegli al massimo 10 sezioni di luoghi per la prima ricerca.')
    const { error } = await supabase.from('strutture').update({ sezioni_attive: attive }).eq('id', struttura.id)
    if (error) throw new Error('Non riesco a salvare le sezioni.')
    aggiornaSezioni(attive)
    const risultato = await supabase.from('configurazioni_guida').update({ passo: 3 }).eq('struttura_id', struttura.id)
    if (risultato.error) throw new Error('Sezioni salvate. Riprova per continuare.')
    setPasso(3)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  async function prepara() {
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw new Error('Sessione scaduta. Accedi di nuovo.')
    for (const sezione of daCercare) {
      if (!vivo.current) break
      setAttuale(sezione.etichetta)
      const risposta = await fetch('/api/scout', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ struttura_id: struttura.id, sezione: sezione.chiave, raggio_km: RAGGI[sezione.chiave] || 5, configurazione: true }),
      })
      const risultato = await risposta.json()
      await caricaRiepilogo()
      if (!risposta.ok) throw new Error(risultato.error || 'Ricerca interrotta. Le proposte già trovate sono salvate.')
    }
    if (vivo.current) setMessaggio('Ricerca terminata. Seleziona i luoghi che vuoi inserire nella guida.')
  }
  async function salvaScelte() {
    for (const sezione of elenchi) {
      const gruppo = visibili.filter(p => p.sezione === sezione.chiave)
      if (!gruppo.length) continue
      const { error } = await supabase.rpc('salva_scelte_proposte', { p_struttura_id: struttura.id, p_sezione: sezione.chiave,
        p_proposte: gruppo.map(p => p.id), p_scelte: gruppo.filter(p => scelte.includes(p.id)).map(p => p.id) })
      if (error) { await caricaRiepilogo(); throw new Error('Alcune scelte non sono state salvate. Controlla il riepilogo e riprova.') }
    }
    await caricaRiepilogo()
    setMessaggio('Scelte salvate. Puoi aggiungere i tuoi luoghi preferiti dal pannello.')
  }
  async function pubblica() {
    const { error } = await supabase.from('strutture').update({ attivo: true }).eq('id', struttura.id)
    if (error) throw new Error('Non riesco a pubblicare. Riprova.')
    setOnline(true)
    setMessaggio('La guida è online e pronta da condividere.')
  }

  if (caricamento) return <p className="p-6 text-center text-sm text-slate-500">Carico i tuoi progressi…</p>
  if (erroreIniziale) return <PaginaAdmin titolo="Configurazione della guida"><Esito ok={false}>{erroreIniziale}</Esito><Pulsante variante="secondario" onClick={() => window.location.reload()}>Riprova</Pulsante></PaginaAdmin>
  return <PaginaAdmin titolo={passo === 2 ? 'Cosa vuoi far scoprire ai tuoi ospiti?' : 'Prepariamo la tua guida'} sottotitolo={passo === 2 ? 'Abbiamo selezionato un punto di partenza. Scegli quello che serve alla tua casa.' : `${struttura.nome} · Controlla i contenuti prima di pubblicare.`}>
    <PassiConfigurazione passo={passo} />
    {errore && <div role="alert"><Esito ok={false}>{errore}</Esito></div>}
    {messaggio && <div role="status"><Esito ok>{messaggio}</Esito></div>}
    <fieldset disabled={occupato} className="flex min-w-0 flex-col gap-6">
      {passo === 2 ? <>
        <SceltaSezioni tutte={tutte} attive={attive} onChange={setAttive} />
        <p className="text-xs text-slate-500">Le pagine sulla casa vanno completate con le tue informazioni. La ricerca automatica riguarda solo i luoghi.</p>
        <div className="grid grid-cols-[1fr_2fr] gap-3 border-t border-slate-200 bg-slate-50 py-4 sticky bottom-0">
          <Link to="/admin/modifica-casa" className="text-center text-sm text-slate-600 py-2.5">Dati casa</Link>
          <Pulsante onClick={() => void esegui(continua)}>Salva e continua</Pulsante>
        </div>
      </> : <>
        {modalita === 'guidata' && <Sezione titolo="Una prima selezione per i tuoi ospiti" nota="Una ricerca per sezione, fino a 10 sezioni. I risultati restano da approvare; non avviamo ricerche periodiche.">
          <ul className="flex flex-col gap-3">
            {elenchi.map(sezione => {
              const ricerca = ricerche.find(r => r.sezione === sezione.chiave)
              return <li key={sezione.chiave} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-700">{sezione.etichetta}<span className="block text-xs text-slate-400">{FASCE[RAGGI[sezione.chiave] || 5]}</span></span>
                <span className="text-xs text-slate-500">{attuale === sezione.etichetta ? 'Cerco…' : ricerca?.stato === 'completata' ? 'Ricerca completata' : ricerca ? 'Da verificare' : 'Da cercare'}</span>
              </li>
            })}
          </ul>
          {!!daCercare.length && <Pulsante onClick={() => void esegui(prepara)}><Sparkles className="w-4 h-4 inline mr-2" />{ricerche.length ? 'Riprendi la preparazione' : 'Prepara la mia guida'}</Pulsante>}
          {ricerche.some(r => r.stato !== 'completata') && <p className="text-xs text-amber-800">Una ricerca potrebbe essere ancora in corso o non essere riuscita. Aggiorna il riepilogo; le sezioni già avviate non vengono ripetute automaticamente.</p>}
          <Pulsante variante="secondario" onClick={() => void esegui(caricaRiepilogo)}>Aggiorna il riepilogo</Pulsante>
        </Sezione>}
        {modalita === 'manuale' && <Sezione titolo="La base è pronta"><p className="text-sm text-slate-600">Aggiungi le informazioni e i luoghi che consigli personalmente. Puoi tornare qui per vedere l’anteprima e pubblicare.</p></Sezione>}
        {!!visibili.length && <Sezione titolo="Scegli i luoghi da inserire" nota="Seleziona quelli che consigli. Salvando, le proposte non selezionate vengono scartate.">
          {elenchi.map(sezione => <div key={sezione.chiave} className="flex flex-col gap-3">
            {visibili.some(p => p.sezione === sezione.chiave) && <h3 className="font-semibold text-sm text-slate-900">{sezione.etichetta}</h3>}
            {visibili.filter(p => p.sezione === sezione.chiave).map(proposta => <div key={proposta.id} className="border border-slate-200 rounded-xl p-4">
              <label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-slate-900 shrink-0" checked={scelte.includes(proposta.id)} onChange={e => setScelte(e.target.checked ? [...scelte, proposta.id] : scelte.filter(id => id !== proposta.id))} />
                <span className="min-w-0"><span className="block font-semibold text-sm text-slate-900">{proposta.nome}</span><span className="block text-xs text-slate-400 mt-1">{proposta.distanza}</span><span className="block text-sm text-slate-600 mt-2">{proposta.descrizione}</span></span>
              </label>
              <div className="flex flex-wrap gap-3 mt-3">{proposta.verifica?.fonti?.filter(f => /^https?:\/\//i.test(f.url)).map((fonte, indice) => <a key={indice} href={fonte.url} target="_blank" rel="noreferrer" className="text-xs text-slate-500 underline break-all">{fonte.titolo || 'Fonte'}</a>)}</div>
            </div>)}
          </div>)}
          <Pulsante onClick={() => void esegui(salvaScelte)}>{numeroScelte === 0 ? 'Scarta tutte le proposte' : numeroScelte === 1 ? 'Salva 1 luogo selezionato' : `Salva ${numeroScelte} luoghi selezionati`}</Pulsante>
        </Sezione>}
        <Sezione titolo="Completa e controlla">
          {mancanti.length > 0 && <div><p className="text-sm text-slate-600 mb-2">Queste pagine sono ancora da compilare:</p><div className="flex flex-wrap gap-2">{mancanti.map(s => <Link key={s.chiave} to={`/admin/${s.chiave}`} className="text-xs rounded-lg border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2">{s.etichetta}</Link>)}</div></div>}
          <Link to="/admin/modifica-casa" className="text-sm text-slate-700 underline">Controlla descrizione, contatti e reti Wi-Fi</Link>
          <div className="flex flex-wrap gap-3">{elenchi.map(s => <Link key={s.chiave} to={`/admin/${s.chiave}`} className="text-xs text-slate-600 underline">Aggiungi o modifica: {s.etichetta}</Link>)}</div>
          <Link to="/admin/traduzioni" className="text-sm text-slate-700 underline">Traduci i contenuti approvati</Link>
          <a href={`/${struttura.slug}`} target="_blank" rel="noreferrer" className="text-center rounded-xl border border-slate-300 py-3 text-sm font-semibold text-slate-700">Apri l’anteprima della guida</a>
          {online ? <p className="text-sm text-green-700"><Check className="inline w-4 h-4 mr-1" />La guida è online</p> : <Pulsante disabled={visibili.length > 0} onClick={() => void esegui(pubblica)}>Pubblica la guida</Pulsante>}
          {visibili.length > 0 && <p className="text-xs text-slate-500">Salva le scelte sui luoghi prima di pubblicare.</p>}
        </Sezione>
        <Pulsante variante="secondario" onClick={() => setPasso(2)}>Indietro alle sezioni</Pulsante>
      </>}
    </fieldset>
    {occupato && <p role="status" className="sticky bottom-3 bg-slate-900 text-white rounded-xl p-4 text-sm shadow-lg"><LoaderCircle className="inline w-4 h-4 animate-spin mr-2" />{attuale ? `Cerco: ${attuale}. I risultati saranno salvati.` : 'Salvo i tuoi progressi…'}</p>}
  </PaginaAdmin>
}
