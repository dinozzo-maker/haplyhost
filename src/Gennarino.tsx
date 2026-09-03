import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { StrutturaRow } from './Struttura'
import { conNome, T, useLingua } from './lingua'

type Messaggio = { role: 'user' | 'assistant'; content: string }

export default function Gennarino() {
  const struttura = useOutletContext<StrutturaRow>()
  const { lingua } = useLingua()
  const [messaggi, setMessaggi] = useState<Messaggio[]>([])
  const [testo, setTesto] = useState('')
  const [caricamento, setCaricamento] = useState(false)

  async function invia() {
    const domanda = testo.trim()
    if (!domanda || caricamento) return

    const nuovaCronologia: Messaggio[] = [...messaggi, { role: 'user', content: domanda }]
    setMessaggi(nuovaCronologia)
    setTesto('')
    setCaricamento(true)

    try {
      const res = await fetch('/api/gennarino', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ struttura_id: struttura.id, domanda, storico: messaggi, lang: lingua }),
      })
      const dati = await res.json()
      setMessaggi([...nuovaCronologia, { role: 'assistant', content: dati.risposta || T[lingua].gennarinoErrore }])
    } catch {
      setMessaggi([...nuovaCronologia, { role: 'assistant', content: T[lingua].gennarinoErrore }])
    } finally {
      setCaricamento(false)
    }
  }

  return (
    <div className="g-chat">
      <div className="g-peek">
        <span className="p-emo">🤵</span>
        <div>
          <div className="p-title">Gennarino</div>
          <div className="p-sub">{conNome(T[lingua].gennarinoSottotitolo, struttura.nome)}</div>
        </div>
      </div>

      {messaggi.length === 0 && (
        <p className="g-hint">{conNome(T[lingua].gennarinoHint, struttura.nome)}</p>
      )}
      {messaggi.map((m, i) => (
        <div key={i} className={m.role === 'user' ? 'g-bubble mine' : 'g-bubble'}>
          {m.content}
        </div>
      ))}
      {caricamento && <p className="g-hint">{T[lingua].gennarinoScrivendo}</p>}

      <div className="g-composer">
        <input
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && invia()}
          placeholder={T[lingua].gennarinoPlaceholder}
        />
        <button onClick={invia} disabled={caricamento}>
          {T[lingua].gennarinoInvia}
        </button>
      </div>
    </div>
  )
}
