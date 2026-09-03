import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { StrutturaRow } from './Struttura'

type Messaggio = { role: 'user' | 'assistant'; content: string }

export default function Gennarino() {
  const struttura = useOutletContext<StrutturaRow>()
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
        body: JSON.stringify({ struttura_id: struttura.id, domanda, storico: messaggi }),
      })
      const dati = await res.json()
      setMessaggi([...nuovaCronologia, { role: 'assistant', content: dati.risposta || 'Errore nella risposta.' }])
    } catch {
      setMessaggi([...nuovaCronologia, { role: 'assistant', content: 'Non sono riuscito a rispondere, riprova tra poco.' }])
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
          <div className="p-sub">Il concierge di {struttura.nome}</div>
        </div>
      </div>

      {messaggi.length === 0 && (
        <p className="g-hint">
          Chiedimi pure qualcosa su {struttura.nome}: spiagge, ristoranti, regole della casa...
        </p>
      )}
      {messaggi.map((m, i) => (
        <div key={i} className={m.role === 'user' ? 'g-bubble mine' : 'g-bubble'}>
          {m.content}
        </div>
      ))}
      {caricamento && <p className="g-hint">Gennarino sta scrivendo...</p>}

      <div className="g-composer">
        <input
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && invia()}
          placeholder="Scrivi qui..."
        />
        <button onClick={invia} disabled={caricamento}>
          Invia
        </button>
      </div>
    </div>
  )
}
