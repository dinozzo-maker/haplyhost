import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { ridimensionaImmagine } from '../immagine'
import { ordinaPerDistanza } from '../distanza'
import { possibileDuplicato } from '../../lib/identita-luoghi.js'
import type { ContestoHost } from './RichiedeLogin'
import { Search } from 'lucide-react'
import { PaginaAdmin, Campo, classeCampo, Pulsante, Esito } from './ui'

// INTERRUTTORE: deve restare uguale a RICERCHE_ATTIVE in api/scout.js.
// false = pulsante nascosto e ricerche bloccate.
const RICERCHE_ATTIVE = true

// Opzioni raggio di ricerca — i valori (km) devono restare uguali a RAGGI_KM in api/scout.js.
const RAGGI = [
  { km: 1, etichetta: 'Entro 1 km' },
  { km: 5, etichetta: 'Da oltre 1 a 5 km' },
  { km: 15, etichetta: 'Da oltre 5 a 15 km' },
  { km: 30, etichetta: 'Da oltre 15 a 30 km' },
  { km: 150, etichetta: 'Da oltre 30 a 150 km' },
]

type LuogoRow = {
  id: string
  nome: string
  descrizione: string
  distanza: string
  prezzo: string | null
  voto: string | null
  maps: string
  telefono: string
  attivo: boolean
  foto_url: string | null
}

type Bozza = {
  nome: string
  descrizione: string
  distanza: string
  prezzo: string
  voto: string
  maps: string
  telefono: string
}

const BOZZA_VUOTA: Bozza = { nome: '', descrizione: '', distanza: '', prezzo: '', voto: '', maps: '', telefono: '' }

// Fuori dal componente: il nome nasce quando l'host carica la foto, non durante
// il rendering di React. Evita anche l'avviso del controllo qualità.
function percorsoFotoLuogo(strutturaId: string, luogoId: string, ext: string) {
  return `luoghi/${strutturaId}/${luogoId}-${Date.now()}.${ext}`
}

type PropostaRow = {
  id: string
  nome: string
  descrizione: string
  distanza: string
  prezzo: string | null
  voto: string | null
  maps: string
  telefono: string
  verifica: {
    indirizzo: string
    distanza_km?: number | null
    fascia_min_km?: number
    fascia_max_km?: number | null
    fonti: { url: string; titolo: string; conferma: string }[]
    non_verificato: string[]
    contraddizioni: string[]
    domanda_host: string
    confronto: string
    ricercato_il: string
  } | null
}

function linkFonte(url: string) {
  try {
    const indirizzo = new URL(url)
    return ['http:', 'https:'].includes(indirizzo.protocol) ? indirizzo.href : undefined
  } catch { return undefined }
}

// Campi condivisi dal form di modifica e da quello di aggiunta manuale.
function CampiLuogo({ bozza, setBozza }: { bozza: Bozza; setBozza: (b: Bozza) => void }) {
  return (
    <>
      <Campo etichetta="Nome">
        <input className={classeCampo} value={bozza.nome} onChange={(e) => setBozza({ ...bozza, nome: e.target.value })} />
      </Campo>
      <Campo etichetta="Descrizione">
        <textarea className={classeCampo} rows={3} value={bozza.descrizione} onChange={(e) => setBozza({ ...bozza, descrizione: e.target.value })} />
      </Campo>
      <Campo etichetta="Distanza">
        <input className={classeCampo} placeholder="es. 🚶 5 min a piedi" value={bozza.distanza} onChange={(e) => setBozza({ ...bozza, distanza: e.target.value })} />
      </Campo>
      <div className="flex gap-2">
        <div className="flex-1">
          <Campo etichetta="Fascia di prezzo">
            <input className={classeCampo} placeholder="es. 15-25 €" value={bozza.prezzo} onChange={(e) => setBozza({ ...bozza, prezzo: e.target.value })} />
          </Campo>
        </div>
        <div className="w-28">
          <Campo etichetta="Voto Google">
            <input className={classeCampo} placeholder="4,5" value={bozza.voto} onChange={(e) => setBozza({ ...bozza, voto: e.target.value })} />
          </Campo>
        </div>
      </div>
      <Campo etichetta="Link Google Maps">
        <input className={classeCampo} value={bozza.maps} onChange={(e) => setBozza({ ...bozza, maps: e.target.value })} />
      </Campo>
      <Campo etichetta="Telefono">
        <input className={classeCampo} value={bozza.telefono} onChange={(e) => setBozza({ ...bozza, telefono: e.target.value })} />
      </Campo>
    </>
  )
}

export default function GestisciSezione({ sezione, etichetta }: { sezione: string; etichetta: string }) {
  const { struttura } = useOutletContext<ContestoHost>()
  const strutturaId = struttura?.id ?? null

  const [luoghi, setLuoghi] = useState<LuogoRow[]>([])
  const [scelte, setScelte] = useState<string[]>([])
  const [proposte, setProposte] = useState<PropostaRow[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [modificaId, setModificaId] = useState<string | null>(null)
  const [nuovo, setNuovo] = useState(false)
  const [bozza, setBozza] = useState<Bozza>(BOZZA_VUOTA)
  const [salvataggio, setSalvataggio] = useState(false)
  const [cercando, setCercando] = useState(false)
  const [esitoScout, setEsitoScout] = useState('')
  const [raggio, setRaggio] = useState(5)
  const [caricamentoFotoId, setCaricamentoFotoId] = useState<string | null>(null)
  const [fotoEsito, setFotoEsito] = useState('') // '' | 'ok' | messaggio d'errore

  // Vale anche per le proposte salvate prima del nuovo controllo lato server.
  // Una somiglianza segnala un possibile duplicato; non rinomina nessun luogo.
  const nomiEsistenti = luoghi.map(luogo => luogo.nome)
  const duplicati = new Map(proposte.flatMap(proposta => {
    const esistente = possibileDuplicato(proposta.nome, nomiEsistenti)
    return esistente ? [[proposta.id, esistente] as const] : []
  }))
  const proposteValide = proposte.filter(proposta => !duplicati.has(proposta.id))
  const scelteValide = scelte.filter(id => !duplicati.has(id))

  const caricaTutto = useCallback(async (id: string) => {
    const { data: dl } = await supabase
      .from('luoghi')
      .select('id, nome, descrizione, distanza, prezzo, voto, maps, telefono, attivo, foto_url')
      .eq('struttura_id', id)
      .eq('sezione', sezione)
      .order('ordine')
    // Dal più vicino al più lontano, non nell'ordine di inserimento — stesso ordine che
    // vede l'ospite nella guida.
    setLuoghi(ordinaPerDistanza(dl ?? [], (l) => l.distanza))

    const { data: dp } = await supabase
      .from('proposte')
      .select('id, nome, descrizione, distanza, prezzo, voto, maps, telefono, verifica')
      .eq('struttura_id', id)
      .eq('sezione', sezione)
      .order('creato_il')
    setProposte(dp ?? [])
    setScelte([])
  }, [sezione])

  useEffect(() => {
    async function carica() {
      if (!strutturaId) { setCaricamento(false); return }
      await caricaTutto(strutturaId)
      setCaricamento(false)
    }
    carica()
  }, [caricaTutto, strutturaId])

  async function toggle(id: string, nuovoValore: boolean) {
    setLuoghi(luoghi.map(l => l.id === id ? { ...l, attivo: nuovoValore } : l))
    await supabase.from('luoghi').update({ attivo: nuovoValore }).eq('id', id)
  }

  function apriModifica(l: LuogoRow) {
    setNuovo(false)
    setModificaId(l.id)
    setFotoEsito('')
    setBozza({
      nome: l.nome,
      descrizione: l.descrizione || '',
      distanza: l.distanza || '',
      prezzo: l.prezzo || '',
      voto: l.voto || '',
      maps: l.maps || '',
      telefono: l.telefono || '',
    })
  }

  function apriNuovo() {
    setModificaId(null)
    setBozza(BOZZA_VUOTA)
    setNuovo(true)
  }

  async function salva(id: string) {
    setSalvataggio(true)
    // da_tradurre: il testo è cambiato, va rifatta la traduzione
    await supabase.from('luoghi').update({ ...bozza, da_tradurre: true }).eq('id', id)
    setLuoghi(ordinaPerDistanza(luoghi.map(l => l.id === id ? { ...l, ...bozza } : l), (l) => l.distanza))
    setSalvataggio(false)
    setModificaId(null)
  }

  async function aggiungiLuogo() {
    if (!strutturaId || !bozza.nome.trim()) return
    setSalvataggio(true)
    await supabase.from('luoghi').insert({
      struttura_id: strutturaId,
      sezione,
      nome: bozza.nome.trim(),
      descrizione: bozza.descrizione,
      distanza: bozza.distanza,
      prezzo: bozza.prezzo,
      voto: bozza.voto,
      maps: bozza.maps,
      telefono: bozza.telefono,
      attivo: true,
      ordine: 999,
      da_tradurre: true,
    })
    setSalvataggio(false)
    setNuovo(false)
    await caricaTutto(strutturaId)
  }

  // Foto di un luogo: stesso schema della copertina in ModificaCasa.tsx (compressione
  // client-side, upload su Storage, poi salva subito il link — non aspetta "Salva").
  // Bucket condiviso "copertine", percorso separato per struttura e luogo.
  async function caricaFotoLuogo(l: LuogoRow, file: File) {
    if (!strutturaId) return
    setFotoEsito('')
    if (!file.type.startsWith('image/')) {
      setFotoEsito('Serve un file immagine (jpg, png…).')
      return
    }
    if (file.size > 30 * 1024 * 1024) {
      setFotoEsito('Immagine troppo pesante (massimo 30 MB).')
      return
    }
    setCaricamentoFotoId(l.id)

    let daCaricare: File = file
    try {
      daCaricare = await ridimensionaImmagine(file)
    } catch {
      // ridimensionamento non riuscito: si prova comunque col file originale
    }

    if (daCaricare.size > 8 * 1024 * 1024) {
      setCaricamentoFotoId(null)
      setFotoEsito('Immagine ancora troppo pesante dopo la compressione, provane un\'altra.')
      return
    }

    const ext = (daCaricare.name.match(/\.([a-z0-9]+)$/i)?.[1] || 'jpg').toLowerCase()
    const percorso = percorsoFotoLuogo(strutturaId, l.id, ext)

    const caricamento = await supabase.storage
      .from('copertine')
      .upload(percorso, daCaricare, { upsert: true, cacheControl: '3600' })
    if (caricamento.error) {
      setCaricamentoFotoId(null)
      setFotoEsito('Caricamento non riuscito: ' + caricamento.error.message)
      return
    }

    const { data: pub } = supabase.storage.from('copertine').getPublicUrl(percorso)
    const { error } = await supabase.from('luoghi').update({ foto_url: pub.publicUrl }).eq('id', l.id)

    setCaricamentoFotoId(null)
    if (error) {
      setFotoEsito('Foto caricata ma non salvata: ' + error.message)
      return
    }
    setLuoghi((prev) => prev.map((x) => (x.id === l.id ? { ...x, foto_url: pub.publicUrl } : x)))
    setFotoEsito('ok')
  }

  async function rimuoviFotoLuogo(l: LuogoRow) {
    setFotoEsito('')
    const { error } = await supabase.from('luoghi').update({ foto_url: null }).eq('id', l.id)
    if (error) {
      setFotoEsito('Non sono riuscito a togliere la foto: ' + error.message)
      return
    }
    setLuoghi((prev) => prev.map((x) => (x.id === l.id ? { ...x, foto_url: null } : x)))
  }

  async function elimina(l: LuogoRow) {
    if (!window.confirm(`Eliminare "${l.nome}" da questa sezione? L'operazione non si può annullare.`)) return
    setSalvataggio(true)
    await supabase.from('luoghi').delete().eq('id', l.id)
    setLuoghi(luoghi.filter(x => x.id !== l.id))
    setSalvataggio(false)
    setModificaId(null)
  }

  async function cercaNuovi() {
    if (!strutturaId) return
    setCercando(true)
    setEsitoScout('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const res = await fetch('/api/scout', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token || ''}`,
        },
        body: JSON.stringify({ struttura_id: strutturaId, sezione, raggio_km: raggio }),
      })
      const dati = await res.json().catch(() => ({}))
      if (!res.ok) {
        setEsitoScout(dati.error || 'La ricerca non è riuscita, riprova.')
      } else if (dati.trovati === 0) {
        setEsitoScout(dati.avviso || 'Nessun nuovo luogo con fonti sufficienti trovato questa volta.')
      }
      await caricaTutto(strutturaId)
    } catch {
      setEsitoScout('Errore di connessione durante la ricerca.')
    } finally {
      setCercando(false)
    }
  }

  async function salvaScelte() {
    if (!strutturaId || salvataggio) return
    setSalvataggio(true)
    setEsitoScout('')
    try {
      const { error } = await supabase.rpc('salva_scelte_proposte', {
        p_struttura_id: strutturaId, p_sezione: sezione,
        p_proposte: proposte.map(p => p.id), p_scelte: scelteValide,
      })
      if (error) throw error
      await caricaTutto(strutturaId)
      setEsitoScout('Scelte salvate. Le proposte non selezionate sono state rimosse.')
    } catch {
      setEsitoScout('Salvataggio non riuscito: le proposte sono conservate. Riprova.')
    } finally { setSalvataggio(false) }
  }

  const pulsanteSalvaScelte = (
    <button
      type="button"
      onClick={salvaScelte}
      disabled={salvataggio || cercando}
      className="w-full rounded-xl py-3 text-sm font-semibold transition bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
    >
      {salvataggio ? 'Salvo…' : `Salva le scelte (${scelteValide.length} selezionati)`}
    </button>
  )

  return (
    <PaginaAdmin titolo={`Gestisci ${etichetta}`}>
      {RICERCHE_ATTIVE ? (
        <div className="flex flex-col gap-2">
          <Campo etichetta="Fascia di distanza">
            <select className={classeCampo} value={raggio} onChange={(e) => setRaggio(Number(e.target.value))}>
              {RAGGI.map((r) => (
                <option key={r.km} value={r.km}>{r.etichetta}</option>
              ))}
            </select>
          </Campo>
          <button
            onClick={cercaNuovi}
            disabled={cercando || salvataggio || proposte.length > 0 || !strutturaId}
            className="w-full rounded-xl py-2.5 text-sm font-semibold transition bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {cercando ? 'Gennarino sta cercando online...' : <><Search className="w-4 h-4" /> Cerca nuovi luoghi</>}
          </button>
          <p className="text-xs text-slate-500">Scegli una fascia senza sovrapposizioni con le altre. Seleziona i luoghi con Accetta, poi premi Salva le scelte: le proposte non selezionate verranno rimosse. Salva prima di avviare una nuova ricerca.</p>
          {esitoScout && <p className="text-sm text-slate-500 text-center">{esitoScout}</p>}
        </div>
      ) : (
        <p className="text-sm text-slate-400">La ricerca automatica di nuovi luoghi è disattivata per ora.</p>
      )}

      {proposte.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Proposte da approvare ({proposteValide.length})</p>
          {pulsanteSalvaScelte}
          <p className="text-xs text-slate-500">Al salvataggio saranno aggiunti {scelteValide.length} luoghi e rimosse {proposte.length - scelteValide.length} proposte non selezionate.</p>
          {duplicati.size > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-900" role="status">
              <p className="font-semibold">Possibili duplicati esclusi dalle scelte ({duplicati.size})</p>
              {proposte.filter(p => duplicati.has(p.id)).map(p => (
                <p key={p.id} className="mt-1">“{p.nome}” potrebbe essere “{duplicati.get(p.id)}”, già nella guida.</p>
              ))}
              <p className="mt-2 text-xs">Salva le scelte per scartare queste proposte. Se si tratta di un’attività diversa, puoi aggiungerla a mano dopo aver verificato nome e indirizzo.</p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {proposteValide.map((p) => (
              <div key={p.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                <p className="font-medium text-sm text-slate-900">{p.nome}</p>
                {(p.distanza || p.prezzo || p.voto) && (
                  <p className="text-xs text-slate-500">
                    {[p.distanza, p.prezzo, p.voto && `★ ${p.voto}`].filter(Boolean).join('  ·  ')}
                  </p>
                )}
                <p className="text-xs text-slate-600 mt-1">{p.descrizione}</p>
                {p.verifica ? (
                  <details className="mt-3 text-xs text-slate-700">
                    <summary className="cursor-pointer font-semibold">Fonti e dettagli da verificare</summary>
                    <p className="mt-2">Indirizzo identificato: {p.verifica.indirizzo}</p>
                    {p.verifica.distanza_km != null && <p className="mt-1">Distanza geografica riportata dalla ricerca: {p.verifica.distanza_km} km. Fascia: {p.verifica.fascia_min_km}–{p.verifica.fascia_max_km} km.</p>}
                    <p className="mt-1 text-slate-500">Ricerca del {new Date(p.verifica.ricercato_il).toLocaleDateString('it-IT')}. Controlla le fonti prima di accettare.</p>
                    <ul className="mt-2 space-y-2">
                      {p.verifica.fonti.map((fonte, indice) => (
                        <li key={indice}>
                          <a href={linkFonte(fonte.url)} target="_blank" rel="noopener noreferrer" className="font-medium underline">{fonte.titolo}</a>
                          <p>{fonte.conferma}</p>
                        </li>
                      ))}
                    </ul>
                    {p.verifica.non_verificato.length > 0 && <p className="mt-2"><strong>Non verificato:</strong> {p.verifica.non_verificato.join(' · ')}</p>}
                    {p.verifica.contraddizioni.length > 0 && <p className="mt-2 text-amber-800"><strong>Fonti discordanti:</strong> {p.verifica.contraddizioni.join(' · ')}</p>}
                    {p.verifica.domanda_host && <p className="mt-2"><strong>Da chiarire con te:</strong> {p.verifica.domanda_host} Puoi lasciare la proposta non selezionata e aggiungere il luogo a mano con i dati corretti.</p>}
                    <p className="mt-2 text-slate-500">{p.verifica.confronto}</p>
                  </details>
                ) : <p className="mt-2 text-xs text-amber-800">Proposta precedente al controllo delle fonti. Verifica i dettagli prima di accettarla.</p>}
                <div className="flex gap-2 mt-2.5">
                  <button
                    onClick={() => setScelte(attuali => attuali.includes(p.id) ? attuali.filter(id => id !== p.id) : [...attuali, p.id])}
                    aria-pressed={scelte.includes(p.id)}
                    disabled={salvataggio}
                    className="w-full rounded-xl py-2.5 text-sm font-semibold transition bg-green-600 text-white hover:bg-green-700"
                  >
                    {scelte.includes(p.id) ? '✓ Selezionato — annulla scelta' : 'Accetta'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {pulsanteSalvaScelte}
        </div>
      )}

      {caricamento && <p className="text-sm text-slate-500">Caricamento...</p>}

      {nuovo ? (
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nuovo luogo</p>
          <CampiLuogo bozza={bozza} setBozza={setBozza} />
          <div className="flex gap-2">
            <Pulsante onClick={aggiungiLuogo} disabled={salvataggio || !bozza.nome.trim()}>
              {salvataggio ? 'Aggiungo...' : 'Aggiungi'}
            </Pulsante>
            <Pulsante variante="secondario" onClick={() => setNuovo(false)}>
              Annulla
            </Pulsante>
          </div>
        </div>
      ) : (
        <Pulsante variante="secondario" onClick={apriNuovo} disabled={!strutturaId}>
          + Aggiungi un luogo a mano
        </Pulsante>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Già presenti</p>
        <div className="flex flex-col gap-2">
          {luoghi.map((l) => (
            <div key={l.id} className="bg-white border border-slate-200 shadow-sm rounded-xl p-3.5">
              {modificaId === l.id ? (
                <div className="flex flex-col gap-3">
                  <Campo etichetta="Foto del luogo">
                    {l.foto_url && (
                      <img src={l.foto_url} alt="" className="w-full h-28 object-cover rounded-xl border border-slate-200" />
                    )}
                    <div className="flex gap-2">
                      <label
                        className={`flex-1 text-center rounded-xl py-2.5 text-sm font-semibold cursor-pointer transition ${
                          caricamentoFotoId === l.id ? 'opacity-50 border border-slate-300 text-slate-400' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {caricamentoFotoId === l.id ? 'Carico...' : l.foto_url ? 'Cambia foto' : 'Carica foto'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={caricamentoFotoId === l.id}
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            e.target.value = ''
                            if (f) caricaFotoLuogo(l, f)
                          }}
                        />
                      </label>
                      {l.foto_url && (
                        <button
                          type="button"
                          onClick={() => rimuoviFotoLuogo(l)}
                          className="px-4 rounded-xl text-sm font-semibold transition border border-red-200 text-red-600 hover:bg-red-50"
                        >
                          Rimuovi
                        </button>
                      )}
                    </div>
                    {fotoEsito && <Esito ok={fotoEsito === 'ok'}>{fotoEsito === 'ok' ? 'Foto aggiornata ✓' : fotoEsito}</Esito>}
                  </Campo>

                  <CampiLuogo bozza={bozza} setBozza={setBozza} />
                  <div className="flex gap-2">
                    <Pulsante onClick={() => salva(l.id)} disabled={salvataggio}>
                      {salvataggio ? 'Salvo...' : 'Salva'}
                    </Pulsante>
                    <Pulsante variante="secondario" onClick={() => setModificaId(null)}>
                      Annulla
                    </Pulsante>
                  </div>
                  <Pulsante variante="pericolo" onClick={() => elimina(l)} disabled={salvataggio} className="self-start">
                    Elimina questo luogo
                  </Pulsante>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  {l.foto_url && (
                    <img src={l.foto_url} alt="" className="w-12 h-12 object-cover rounded-lg shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-slate-900">{l.nome}</p>
                    {(l.distanza || l.prezzo || l.voto) && (
                      <p className="text-xs text-slate-400">
                        {[l.distanza, l.prezzo, l.voto && `★ ${l.voto}`].filter(Boolean).join('  ·  ')}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 line-clamp-1">{l.descrizione}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => apriModifica(l)} className="text-xs font-medium text-slate-500 hover:text-slate-800">Modifica</button>
                    <input type="checkbox" checked={l.attivo} onChange={(e) => toggle(l.id, e.target.checked)} className="w-5 h-5 accent-slate-900" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </PaginaAdmin>
  )
}
