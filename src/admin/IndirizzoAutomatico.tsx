import { useEffect, useId, useRef, useState } from 'react'
import { classeCampo } from './ui'

type Suggerimento = { formatted: string; city?: string }

// Un solo campo per tutti i moduli: il testo resta sempre modificabile a mano.
export default function IndirizzoAutomatico({ valore, onChange, onSeleziona }: {
  valore: string
  onChange: (valore: string) => void
  onSeleziona?: (citta: string) => void
}) {
  const id = useId()
  const chiave = import.meta.env.VITE_GEOAPIFY_API_KEY?.trim()
  const [ricerca, setRicerca] = useState('')
  const [aperto, setAperto] = useState(false)
  const [risultati, setRisultati] = useState<Suggerimento[]>([])
  const [attivo, setAttivo] = useState(-1)
  const [messaggio, setMessaggio] = useState('')
  const richiesta = useRef<AbortController | null>(null)
  const versione = useRef(0)

  function annulla() {
    versione.current += 1
    richiesta.current?.abort()
  }

  useEffect(() => {
    if (!chiave || !aperto || ricerca.trim().length < 3 || ricerca !== valore) return
    const controllo = new AbortController()
    richiesta.current = controllo
    const corrente = versione.current
    const timer = window.setTimeout(async () => {
      setMessaggio('Cerco indirizzi…')
      try {
        const parametri = new URLSearchParams({
          text: ricerca.trim(), lang: 'it', limit: '5', format: 'json',
          bias: 'countrycode:it', apiKey: chiave,
        })
        const risposta = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${parametri}`, {
          signal: controllo.signal,
        })
        if (!risposta.ok) throw new Error('Ricerca non disponibile')
        const dati = await risposta.json()
        if (controllo.signal.aborted || corrente !== versione.current) return
        if (!Array.isArray(dati.results)) throw new Error('Risposta non valida')
        const suggerimenti: Suggerimento[] = dati.results
          .filter((r: Suggerimento) => r && typeof r.formatted === 'string')
          .slice(0, 5)
        setRisultati(suggerimenti)
        setMessaggio(suggerimenti.length ? '' : 'Nessun indirizzo trovato. Prova ad aggiungere la città o scrivi a mano.')
      } catch {
        if (!controllo.signal.aborted && corrente === versione.current) {
          setMessaggio('Suggerimenti non disponibili. Puoi scrivere l’indirizzo a mano.')
        }
      }
    }, 400)
    return () => { window.clearTimeout(timer); controllo.abort() }
  }, [ricerca, valore, aperto, chiave])

  function scegli(suggerimento: Suggerimento) {
    annulla()
    setAperto(false)
    setRisultati([])
    setMessaggio('')
    setRicerca('')
    onChange(suggerimento.formatted)
    onSeleziona?.(typeof suggerimento.city === 'string' ? suggerimento.city : '')
  }

  const visibili = aperto && ricerca === valore ? risultati : []
  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Indirizzo</label>
      <input
        id={id} className={classeCampo} value={valore} autoComplete="off"
        placeholder="Via, numero civico, città" role="combobox"
        aria-autocomplete="list" aria-expanded={visibili.length > 0}
        aria-controls={visibili.length ? `${id}-elenco` : undefined} aria-describedby={`${id}-aiuto`}
        aria-activedescendant={attivo >= 0 && visibili[attivo] ? `${id}-${attivo}` : undefined}
        onChange={(e) => {
          annulla()
          setRisultati([])
          setAttivo(-1)
          setMessaggio('')
          setRicerca(e.target.value)
          setAperto(true)
          onChange(e.target.value)
        }}
        onFocus={() => setAperto(true)}
        onBlur={() => { annulla(); setAperto(false); setAttivo(-1) }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return
          if (e.key === 'Escape') { annulla(); setAperto(false); setAttivo(-1) }
          if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && visibili.length) {
            e.preventDefault()
            setAttivo((precedente) => precedente < 0
              ? (e.key === 'ArrowDown' ? 0 : visibili.length - 1)
              : (precedente + (e.key === 'ArrowDown' ? 1 : visibili.length - 1)) % visibili.length)
          }
          if (e.key === 'Enter' && visibili[attivo]) { e.preventDefault(); scegli(visibili[attivo]) }
        }}
      />
      {visibili.length > 0 && (
        <ul id={`${id}-elenco`} role="listbox" aria-label="Indirizzi suggeriti"
          className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {visibili.map((r, indice) => (
            <li key={`${r.formatted}-${indice}`} id={`${id}-${indice}`} role="option"
              aria-selected={indice === attivo}
              className={`cursor-pointer px-3.5 py-3 text-sm text-slate-900 hover:bg-amber-50 ${indice === attivo ? 'bg-amber-50' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => scegli(r)}>{r.formatted}</li>
          ))}
        </ul>
      )}
      <p id={`${id}-aiuto`} role="status" className="text-xs text-slate-500">
        {!chiave ? 'Completamento automatico non ancora attivo. Puoi scrivere l’indirizzo a mano.'
          : (aperto && ricerca === valore && messaggio) || 'Scrivi almeno 3 caratteri e scegli un suggerimento. Controlla il numero civico.'}
      </p>
      {chiave && <p className="text-xs text-slate-400">
        Ricerca indirizzi: <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer" className="underline">Geoapify</a>
        {' · '}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">© OpenStreetMap contributors</a>
      </p>}
    </div>
  )
}
