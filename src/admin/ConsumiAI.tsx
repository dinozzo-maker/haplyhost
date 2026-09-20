import { useEffect, useState } from 'react'
import { Navigate, useOutletContext } from 'react-router-dom'
import type { ContestoHost } from './RichiedeLogin'
import { PaginaAdmin, Sezione } from './ui'

const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase()
type Totali = { chiamate: number; errori: number; token_input: number; token_output: number; token_strumenti: number; token_totali: number }
type Dati = {
  periodi: { oggi: Totali; sette_giorni: Totali; trenta_giorni: Totali }
  servizi: Array<Totali & { servizio: string; fornitore: string; modello: string }>
  errori_recenti: Array<{ servizio: string; fornitore: string; modello: string; tipo: string; creato_il: string }>
  nota_disponibilita: string
}

const numero = new Intl.NumberFormat('it-IT')
const nomi: Record<string, string> = { gennarino: 'Gennarino', scout: 'Ricerca luoghi', traduzioni: 'Traduzioni', descrizioni: 'Descrizioni case' }

function Riepilogo({ titolo, dati }: { titolo: string; dati: Totali }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titolo}</p>
    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{numero.format(dati.token_totali)}</p>
    <p className="text-xs text-slate-500">token · {numero.format(dati.chiamate)} chiamate · {numero.format(dati.errori)} errori</p>
  </div>
}

export default function ConsumiAI() {
  const { session } = useOutletContext<ContestoHost>()
  const autorizzato = !!ADMIN_EMAIL && session.user.email?.toLowerCase() === ADMIN_EMAIL
  const [dati, setDati] = useState<Dati | null>(null)
  const [errore, setErrore] = useState('')
  useEffect(() => {
    if (!autorizzato) return
    ;(async () => {
      try {
        const risposta = await fetch('/api/consumi-ai', { headers: { Authorization: `Bearer ${session.access_token}` } })
        const corpo = await risposta.json()
        if (!risposta.ok) throw new Error(corpo.error || 'Non riesco a caricare i consumi.')
        setDati(corpo)
      } catch (e) { setErrore(e instanceof Error ? e.message : 'Non riesco a caricare i consumi.') }
    })()
  }, [autorizzato, session.access_token])
  if (!autorizzato) return <Navigate to="/admin" replace />
  return <PaginaAdmin titolo="Consumi AI" sottotitolo="Conteggi tecnici della piattaforma. Non vengono salvati testi delle domande, risposte o dati degli ospiti.">
    {!dati && !errore && <p className="text-sm text-slate-500">Caricamento…</p>}
    {errore && <Sezione><p className="text-sm text-red-700">{errore}</p></Sezione>}
    {dati && <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Riepilogo titolo="Oggi" dati={dati.periodi.oggi} />
        <Riepilogo titolo="Ultimi 7 giorni" dati={dati.periodi.sette_giorni} />
        <Riepilogo titolo="Ultimi 30 giorni" dati={dati.periodi.trenta_giorni} />
      </div>
      <Sezione titolo="Consumi per servizio" nota="Il conteggio parte dall’attivazione di questa pagina; i consumi precedenti non sono ricostruibili.">
        {dati.servizi.length === 0 ? <p className="text-sm text-slate-500">Nessuna chiamata registrata. I dati compariranno con le prossime richieste AI.</p> :
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500"><tr><th className="pb-2">Servizio</th><th className="pb-2">Fornitore</th><th className="pb-2 text-right">Chiamate</th><th className="pb-2 text-right">Token</th><th className="pb-2 text-right">Errori</th></tr></thead>
            <tbody>{dati.servizi.map(r => <tr key={`${r.servizio}-${r.fornitore}-${r.modello}`} className="border-t border-slate-100">
              <td className="py-2.5"><span className="font-medium text-slate-800">{nomi[r.servizio] || r.servizio}</span><span className="block text-xs text-slate-400">{r.modello}</span></td>
              <td className="py-2.5 capitalize text-slate-600">{r.fornitore}</td><td className="py-2.5 text-right tabular-nums">{numero.format(r.chiamate)}</td><td className="py-2.5 text-right tabular-nums">{numero.format(r.token_totali)}</td><td className="py-2.5 text-right tabular-nums">{numero.format(r.errori)}</td>
            </tr>)}</tbody>
          </table></div>}
      </Sezione>
      <Sezione titolo="Disponibilità residua"><p className="text-sm leading-relaxed text-slate-600">{dati.nota_disponibilita}</p></Sezione>
      <Sezione titolo="Errori recenti" nota="Mostra soltanto tipo, servizio e momento dell’errore.">
        {dati.errori_recenti.length === 0 ? <p className="text-sm text-slate-500">Nessun errore registrato.</p> : <div className="flex flex-col gap-2">{dati.errori_recenti.map((e, i) => <div key={`${e.creato_il}-${i}`} className="flex justify-between gap-3 text-sm"><span><strong>{nomi[e.servizio] || e.servizio}</strong> · {e.tipo}</span><time className="shrink-0 text-xs text-slate-400">{new Date(e.creato_il).toLocaleString('it-IT')}</time></div>)}</div>}
      </Sezione>
    </>}
  </PaginaAdmin>
}

