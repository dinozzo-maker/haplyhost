import { useEffect, useState } from 'react'
import IndirizzoAutomatico from './IndirizzoAutomatico'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { ridimensionaImmagine } from '../immagine'
import type { ContestoHost } from './RichiedeLogin'
import { PaginaAdmin, Sezione, Campo, classeCampo, Pulsante, Esito } from './ui'

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
  accento: string
  copertina_url: string
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
  accento: '',
  copertina_url: '',
}

// Colore d'accento della guida ospiti: 5 preset. '' = default (Mare).
const COLORI = [
  { nome: 'Mare', hex: '#12A69B' },
  { nome: 'Corallo', hex: '#EA6D57' },
  { nome: 'Bosco', hex: '#4E9B5B' },
  { nome: 'Lavanda', hex: '#7C6BD1' },
  { nome: 'Ambra', hex: '#E0A32E' },
]

export default function ModificaCasa() {
  const { struttura } = useOutletContext<ContestoHost>()

  const [dati, setDati] = useState<DatiCasa>(VUOTO)
  const [caricamento, setCaricamento] = useState(true)
  const [salvataggio, setSalvataggio] = useState(false)
  const [salvato, setSalvato] = useState(false)
  const [errore, setErrore] = useState('')

  // Foto di copertina: caricamento file su Supabase Storage
  const [caricamentoFoto, setCaricamentoFoto] = useState(false)
  const [fotoEsito, setFotoEsito] = useState('') // '' | 'ok' | messaggio d'errore

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
        .select('nome, indirizzo, citta, descrizione_casa, host_nome, host_telefono, checkin, checkout, max_ospiti, accento, copertina_url')
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
        accento: data.accento ?? '',
        copertina_url: data.copertina_url ?? '',
      })
      setCaricamento(false)
    }
    carica()
  }, [struttura])

  function aggiorna(campo: keyof DatiCasa, valore: string) {
    setDati((d) => ({ ...d, [campo]: valore }))
    setSalvato(false)
  }

  // Carica un'immagine su Storage e salva SUBITO il link (non aspetta il pulsante "Salva":
  // è un'azione a sé, con il suo bottone).
  async function caricaFoto(file: File) {
    if (!struttura) return
    setFotoEsito('')
    if (!file.type.startsWith('image/')) {
      setFotoEsito('Serve un file immagine (jpg, png…).')
      return
    }
    if (file.size > 30 * 1024 * 1024) {
      setFotoEsito('Immagine troppo pesante (massimo 30 MB).')
      return
    }
    setCaricamentoFoto(true)

    let daCaricare: File = file
    try {
      daCaricare = await ridimensionaImmagine(file)
    } catch {
      // ridimensionamento non riuscito: si prova comunque col file originale
    }

    if (daCaricare.size > 8 * 1024 * 1024) {
      setCaricamentoFoto(false)
      setFotoEsito('Immagine ancora troppo pesante dopo la compressione, provane un\'altra.')
      return
    }

    const { data: s } = await supabase.auth.getSession()
    const uid = s.session?.user.id ?? 'anon'
    const ext = (daCaricare.name.match(/\.([a-z0-9]+)$/i)?.[1] || 'jpg').toLowerCase()
    const percorso = `${uid}/${struttura.id}-${Date.now()}.${ext}`

    const caricamento = await supabase.storage
      .from('copertine')
      .upload(percorso, daCaricare, { upsert: true, cacheControl: '3600' })
    if (caricamento.error) {
      setCaricamentoFoto(false)
      setFotoEsito('Caricamento non riuscito: ' + caricamento.error.message)
      return
    }

    const { data: pub } = supabase.storage.from('copertine').getPublicUrl(percorso)
    const { error } = await supabase
      .from('strutture')
      .update({ copertina_url: pub.publicUrl })
      .eq('id', struttura.id)

    setCaricamentoFoto(false)
    if (error) {
      setFotoEsito('Foto caricata ma non salvata: ' + error.message)
      return
    }
    setDati((d) => ({ ...d, copertina_url: pub.publicUrl }))
    setFotoEsito('ok')
  }

  async function rimuoviFoto() {
    if (!struttura) return
    setFotoEsito('')
    const { error } = await supabase
      .from('strutture')
      .update({ copertina_url: null })
      .eq('id', struttura.id)
    if (error) {
      setFotoEsito('Non sono riuscito a togliere la foto: ' + error.message)
      return
    }
    setDati((d) => ({ ...d, copertina_url: '' }))
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
        accento: dati.accento || null,
        copertina_url: dati.copertina_url.trim() || null,
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
      <PaginaAdmin titolo="Modifica dati della casa">
        <p className="text-sm text-slate-500">Non hai ancora una struttura da modificare.</p>
      </PaginaAdmin>
    )
  }

  if (caricamento) return <p className="p-6 text-center text-sm text-slate-500">Caricamento...</p>

  return (
    <PaginaAdmin titolo="Modifica dati della casa">
      <Sezione>
        <Campo etichetta="Nome della struttura">
          <input className={classeCampo} value={dati.nome} onChange={(e) => aggiorna('nome', e.target.value)} />
        </Campo>

        <IndirizzoAutomatico key={struttura.id} valore={dati.indirizzo}
          onChange={(valore) => aggiorna('indirizzo', valore)}
          onSeleziona={(citta) => aggiorna('citta', citta)} />

        <Campo etichetta="Città">
          <input
            className={classeCampo}
            value={dati.citta}
            onChange={(e) => aggiorna('citta', e.target.value)}
            placeholder="Es. Sorrento"
          />
        </Campo>

        <Campo etichetta="Descrizione della casa" aiuto="Gennarino usa questo testo per rispondere alle domande degli ospiti sulla casa.">
          <textarea
            className={classeCampo}
            rows={6}
            value={dati.descrizione_casa}
            onChange={(e) => aggiorna('descrizione_casa', e.target.value)}
          />
        </Campo>

        <Campo etichetta="Nome host">
          <input className={classeCampo} value={dati.host_nome} onChange={(e) => aggiorna('host_nome', e.target.value)} />
        </Campo>

        <Campo etichetta="Telefono host" aiuto='Con il prefisso internazionale (+39…): la guida lo usa per i link "WhatsApp" e "Chiama".'>
          <input
            className={classeCampo}
            value={dati.host_telefono}
            onChange={(e) => aggiorna('host_telefono', e.target.value)}
            placeholder="+39 333 1234567"
          />
        </Campo>

        <div className="flex gap-3">
          <div className="flex-1">
            <Campo etichetta="Check-in">
              <input className={classeCampo} value={dati.checkin} onChange={(e) => aggiorna('checkin', e.target.value)} placeholder="15:00" />
            </Campo>
          </div>
          <div className="flex-1">
            <Campo etichetta="Check-out">
              <input className={classeCampo} value={dati.checkout} onChange={(e) => aggiorna('checkout', e.target.value)} placeholder="10:00" />
            </Campo>
          </div>
        </div>

        <Campo etichetta="Ospiti massimi">
          <input
            type="number"
            min="1"
            className={classeCampo}
            value={dati.max_ospiti}
            onChange={(e) => aggiorna('max_ospiti', e.target.value)}
          />
        </Campo>
      </Sezione>

      <Sezione titolo="Aspetto della guida ospiti" nota="Due leve per dare identità alla guida senza toccare il resto.">
        <Campo etichetta="Colore della guida" aiuto='Tinta di accento: bottoni, intestazione, pastiglie. Il default è "Mare".'>
          <div className="flex gap-3 mt-1">
            {COLORI.map((c) => {
              const attivo = (dati.accento || '#12A69B') === c.hex
              return (
                <button
                  key={c.hex}
                  type="button"
                  title={c.nome}
                  aria-label={c.nome}
                  aria-pressed={attivo}
                  onClick={() => aggiorna('accento', c.hex)}
                  className={`h-8 w-8 rounded-full transition ${attivo ? 'ring-2 ring-offset-2 ring-slate-800' : 'hover:scale-110'}`}
                  style={{ background: c.hex }}
                />
              )
            })}
          </div>
        </Campo>

        <Campo etichetta="Foto di copertina">
          {dati.copertina_url && (
            <img src={dati.copertina_url} alt="Anteprima copertina" className="w-full h-32 object-cover rounded-xl border border-slate-200 mb-1" />
          )}
          <div className="flex gap-2">
            <label
              className={`flex-1 text-center rounded-xl py-2.5 text-sm font-semibold cursor-pointer transition ${
                caricamentoFoto ? 'opacity-50 border border-slate-300 text-slate-400' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {caricamentoFoto ? 'Carico...' : dati.copertina_url ? 'Cambia foto' : 'Carica foto'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={caricamentoFoto}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) caricaFoto(f)
                }}
              />
            </label>
            {dati.copertina_url && (
              <Pulsante type="button" variante="secondario" className="w-auto px-4 text-red-600 border-red-200 hover:bg-red-50" onClick={rimuoviFoto}>
                Rimuovi
              </Pulsante>
            )}
          </div>
          {fotoEsito === 'ok' ? (
            <span className="text-xs text-green-600">Foto di copertina aggiornata ✓</span>
          ) : (
            fotoEsito && <span className="text-xs text-red-600">{fotoEsito}</span>
          )}
        </Campo>

        <details>
          <summary className="text-xs text-slate-400 cursor-pointer">oppure incolla un link a un'immagine</summary>
          <input
            className={`${classeCampo} mt-2`}
            value={dati.copertina_url}
            onChange={(e) => aggiorna('copertina_url', e.target.value)}
            placeholder="https://..."
          />
          <p className="text-xs text-slate-400 mt-1">
            Con il link, ricordati di premere "Salva" in fondo. Lascia vuoto per una tinta con il colore scelto sopra.
          </p>
        </details>
      </Sezione>

      <div className="flex flex-col gap-2">
        <Pulsante onClick={salva} disabled={salvataggio}>
          {salvataggio ? 'Salvo...' : 'Salva'}
        </Pulsante>
        {salvato && <Esito ok>Salvato ✓</Esito>}
        {errore && <Esito ok={false}>{errore}</Esito>}
      </div>

      <Sezione
        titolo="Rigenera la descrizione da un link"
        nota="Incolla il link dell'annuncio o del sito della casa: l'assistente lo rilegge e riscrive descrizione e città. Il testo attuale verrà sostituito (potrai comunque correggerlo qui sopra prima di salvare)."
      >
        <input className={classeCampo} value={link} onChange={(e) => { setLink(e.target.value); setRigenerato(false) }} placeholder="https://..." />
        <Pulsante variante="secondario" onClick={rigenera} disabled={rigenerando}>
          {rigenerando ? 'Sto rileggendo il link e riscrivendo...' : 'Rigenera descrizione'}
        </Pulsante>
        {rigenerato && <Esito ok>Descrizione aggiornata ✓ Controllala qui sopra, poi premi Salva se vuoi ritoccarla.</Esito>}
        {erroreRigenera && <Esito ok={false}>{erroreRigenera}</Esito>}
      </Sezione>
    </PaginaAdmin>
  )
}
