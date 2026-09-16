import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { ContestoHost } from './RichiedeLogin'
import { PaginaAdmin, Pulsante, Esito } from './ui'

export default function TraduciGuida() {
  const { struttura } = useOutletContext<ContestoHost>()
  const [traducendo, setTraducendo] = useState(false)
  const [esito, setEsito] = useState('')
  const [esitoOk, setEsitoOk] = useState(true)
  const [dettaglio, setDettaglio] = useState('')
  const [daTradurre, setDaTradurre] = useState(0)

  const conta = useCallback(async (): Promise<number> => {
    const sid = struttura?.id
    if (!sid) return 0
    try {
      const [p, l] = await Promise.all([
        supabase.from('pagine').select('id', { count: 'exact', head: true }).eq('struttura_id', sid).eq('da_tradurre', true),
        supabase.from('luoghi').select('id', { count: 'exact', head: true }).eq('struttura_id', sid).eq('da_tradurre', true),
      ])
      return (p.count ?? 0) + (l.count ?? 0)
    } catch {
      return 0
    }
  }, [struttura])

  useEffect(() => {
    let vivo = true
    conta().then((n) => { if (vivo) setDaTradurre(n) })
    return () => { vivo = false }
  }, [conta])

  async function traduci() {
    if (!struttura) return
    setEsito('')
    setDettaglio('')
    setTraducendo(true)

    const { data: sessionData } = await supabase.auth.getSession()

    try {
      const res = await fetch('/api/traduci-guida', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          struttura_id: struttura.id,
          access_token: sessionData.session?.access_token,
        }),
      })
      const dati = await res.json().catch(() => ({}))
      if (!res.ok) {
        setEsitoOk(false)
        setEsito(dati.error || 'Traduzione non riuscita, riprova.')
        return
      }

      const fatti = (dati.pagine ?? 0) + (dati.luoghi ?? 0)
      if (dati.nonRiusciti > 0) {
        setEsitoOk(false)
        setEsito(
          `Tradotti ${fatti} test${fatti === 1 ? 'o' : 'i'}, ma ${dati.nonRiusciti} ` +
          `non ${dati.nonRiusciti === 1 ? 'è riuscito' : 'sono riusciti'}. Riprova tra un minuto.`
        )
        if (dati.errore) setDettaglio(String(dati.errore))
      } else if (fatti > 0) {
        setEsitoOk(true)
        setEsito(`Fatto ✓ — ${dati.pagine} pagine e ${dati.luoghi} luoghi tradotti`)
      } else if (dati.ripulite > 0) {
        setEsitoOk(true)
        setEsito('Fatto ✓ — non c\'era testo nuovo da tradurre')
      } else {
        setEsitoOk(true)
        setEsito('Era già tutto tradotto ✓')
      }

      // Ricontiamo dal database invece di azzerare: così l'avviso resta giusto
      // anche se qualche testo non è stato tradotto.
      setDaTradurre(await conta())
    } catch {
      setEsitoOk(false)
      setEsito('Errore di connessione, riprova.')
    } finally {
      setTraducendo(false)
    }
  }

  if (!struttura) {
    return (
      <PaginaAdmin titolo="Traduzioni della guida">
        <p className="text-sm text-slate-500">Non hai ancora una struttura.</p>
      </PaginaAdmin>
    )
  }

  return (
    <PaginaAdmin
      titolo="Traduzioni della guida"
      sottotitolo={
        <>
          La guida ospiti si mostra da sola nella lingua del telefono (italiano, inglese, francese,
          tedesco, spagnolo). I nomi dei luoghi e le loro descrizioni sono già tradotti. Questo pulsante
          traduce le <strong>pagine di testo</strong> (Wi-Fi, regole, emergenze…) e i luoghi che non
          hanno ancora una traduzione.
          <br /><br />
          <span className="text-slate-400">
            Rilancialo ogni volta che modifichi un testo: le traduzioni non si aggiornano da sole.
            Traduce solo quello che è cambiato, ci vuole meno di un minuto.
          </span>
        </>
      }
    >
      {daTradurre > 0 && (
        <p className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3.5 text-sm">
          Ci sono {daTradurre} test{daTradurre === 1 ? 'o' : 'i'} modificat{daTradurre === 1 ? 'o' : 'i'}
          {' '}dopo l'ultima traduzione.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Pulsante onClick={traduci} disabled={traducendo}>
          {traducendo ? 'Sto traducendo, può volerci un minuto…' : 'Traduci la guida'}
        </Pulsante>
        {esito && <Esito ok={esitoOk}>{esito}</Esito>}
        {dettaglio && <p className="text-xs text-slate-400 text-center break-words">Dettaglio: {dettaglio}</p>}
      </div>
    </PaginaAdmin>
  )
}
