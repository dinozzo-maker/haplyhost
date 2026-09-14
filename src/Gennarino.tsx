import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import type { StrutturaRow } from './Struttura'
import { conNome, T, useLingua } from './lingua'
import { conTelefoni, contieneTelefono, reTelefono } from './telefono'
import { MessageCircle, Phone } from 'lucide-react'

type Messaggio = { role: 'user' | 'assistant'; content: string }

export default function Gennarino() {
  const struttura = useOutletContext<StrutturaRow>()
  const location = useLocation()
  const navigate = useNavigate()
  const { lingua } = useLingua()
  const [messaggi, setMessaggi] = useState<Messaggio[]>([])
  const [testo, setTesto] = useState('')
  const [caricamento, setCaricamento] = useState(false)
  const inviataIniziale = useRef(false)

  async function invia(domandaDiretta?: string) {
    const domanda = (domandaDiretta ?? testo).trim()
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
      const dati = await res.json().catch(() => ({}))
      // 429 = troppe domande in poco tempo: mostra il messaggio del server, non l'errore generico.
      const risposta = dati.risposta || (res.status === 429 && dati.error) || T[lingua].gennarinoErrore
      setMessaggi([...nuovaCronologia, { role: 'assistant', content: risposta }])
    } catch {
      setMessaggi([...nuovaCronologia, { role: 'assistant', content: T[lingua].gennarinoErrore }])
    } finally {
      setCaricamento(false)
    }
  }

  // Arrivando dalla casella "Chiedi a Gennarino" in Home.tsx, la domanda viaggia nello
  // stato di navigazione e parte da sola all'apertura — l'ospite non deve riscriverla.
  // La guardia (ref) evita un doppio invio nel caso React rimonti il componente due
  // volte (StrictMode in sviluppo); si toglie subito lo stato dalla history così
  // "indietro" più avanti non la rimanda in automatico un'altra volta.
  useEffect(() => {
    const domandaIniziale = (location.state as { domandaIniziale?: string } | null)?.domandaIniziale
    if (!domandaIniziale || inviataIniziale.current) return
    inviataIniziale.current = true
    navigate(location.pathname, { replace: true, state: null })
    invia(domandaIniziale)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  // Tasti WhatsApp/Chiama sotto una risposta che nomina proprio il telefono degli host
  // (non un numero qualsiasi citato per un luogo): Gennarino lo scrive solo quando è lui
  // a consigliare di contattarli, quindi la sua presenza nel testo è il segnale giusto.
  const tel = (struttura.host_telefono ?? '').trim()
  const waNumero = tel.replace(/\D/g, '')
  const telHref = tel.replace(/[^\d+]/g, '')

  return (
    <div className="g-chat">
      <div className="g-peek">
        <span className="p-emo"><MessageCircle /></span>
        <div>
          <div className="p-title">Gennarino</div>
          <div className="p-sub">{conNome(T[lingua].gennarinoSottotitolo, struttura.nome)}</div>
        </div>
      </div>

      {messaggi.length === 0 && (
        <p className="g-hint">{conNome(T[lingua].gennarinoHint, struttura.nome)}</p>
      )}
      {messaggi.map((m, i) => {
        const mostraContatti = m.role === 'assistant' && !!tel && contieneTelefono(m.content, tel)
        return (
          <div key={i} className={m.role === 'user' ? 'g-msg mine' : 'g-msg'}>
            <div className={m.role === 'user' ? 'g-bubble mine' : 'g-bubble'}>
              {m.role === 'assistant' ? conTelefoni(m.content, reTelefono(true)) : m.content}
            </div>
            {mostraContatti && (
              <div className="g-contatti">
                {waNumero && (
                  <a className="g-btn-wa" href={`https://wa.me/${waNumero}`} target="_blank" rel="noreferrer">
                    <MessageCircle size={18} /> WhatsApp
                  </a>
                )}
                <a className="g-btn-tel" href={`tel:${telHref}`}>
                  <Phone size={18} /> {T[lingua].azChiama}
                </a>
              </div>
            )}
          </div>
        )
      })}
      {caricamento && <p className="g-hint">{T[lingua].gennarinoScrivendo}</p>}

      <div className="g-composer">
        <input
          value={testo}
          maxLength={1500}
          onChange={(e) => setTesto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && invia()}
          placeholder={T[lingua].gennarinoPlaceholder}
        />
        <button onClick={() => invia()} disabled={caricamento}>
          {T[lingua].gennarinoInvia}
        </button>
      </div>
    </div>
  )
}
