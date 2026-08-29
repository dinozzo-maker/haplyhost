import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import type { StrutturaRow } from './Struttura'

type Messaggio = { role: 'user' | 'assistant'; content: string }

export default function Gennarino() {
  const struttura = useOutletContext<StrutturaRow>()
  const { slug } = useParams()
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
    <div className="max-w-sm mx-auto p-6 flex flex-col h-screen">
      <Link to={`/${slug}`} className="text-sm text-blue-600">&larr; Torna alla home</Link>
      <h1 className="text-xl font-bold mt-2 mb-4">🤵 Chiedi a Gennarino</h1>

      <div className="flex-1 overflow-y-auto flex flex-col gap-3 mb-4">
        {messaggi.length === 0 && (
          <p className="text-sm text-gray-500">Chiedimi pure qualcosa su {struttura.nome}: spiagge, ristoranti, regole della casa...</p>
        )}
        {messaggi.map((m, i) => (
          <div key={i} className={`p-3 rounded-2xl text-sm max-w-[85%] ${m.role === 'user' ? 'bg-blue-600 text-white self-end' : 'bg-white shadow self-start'}`}>
            {m.content}
          </div>
        ))}
        {caricamento && <div className="text-sm text-gray-400 self-start">Gennarino sta scrivendo...</div>}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 border rounded-full px-4 py-2 text-sm"
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && invia()}
          placeholder="Scrivi qui..."
        />
        <button onClick={invia} disabled={caricamento} className="bg-blue-600 text-white rounded-full px-4 py-2 text-sm disabled:opacity-50">
          Invia
        </button>
      </div>
    </div>
  )
}