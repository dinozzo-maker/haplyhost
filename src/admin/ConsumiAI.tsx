import { useEffect, useState } from 'react'
import { Navigate, useOutletContext } from 'react-router-dom'
import { Activity, AlertTriangle, CalendarDays, Info } from 'lucide-react'
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

const coloriRiepilogo = {
  ambra: 'border-amber-200 bg-amber-50 text-amber-950',
  azzurro: 'border-sky-200 bg-sky-50 text-sky-950',
  viola: 'border-violet-200 bg-violet-50 text-violet-950',
}

function Riepilogo({ titolo, dati, colore }: { titolo: string; dati: Totali; colore: keyof typeof coloriRiepilogo }) {
  return <div className={`rounded-2xl border p-5 shadow-sm ${coloriRiepilogo[colore]}`}>
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide opacity-70">
      <CalendarDays size={15} aria-hidden />
      <span>{titolo}</span>
    </div>
    <p className="mt-3 text-3xl font-bold tabular-nums">{numero.format(dati.token_totali)} <span className="text-base font-semibold">token</span></p>
    <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
      <span className="rounded-full bg-white/70 px-2.5 py-1">{numero.format(dati.chiamate)} {dati.chiamate === 1 ? 'chiamata' : 'chiamate'}</span>
      <span className={`rounded-full px-2.5 py-1 ${dati.errori ? 'bg-red-100 text-red-700' : 'bg-white/70'}`}>{numero.format(dati.errori)} {dati.errori === 1 ? 'errore' : 'errori'}</span>
    </div>
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
        <Riepilogo titolo="Oggi" dati={dati.periodi.oggi} colore="ambra" />
        <Riepilogo titolo="Ultimi 7 giorni" dati={dati.periodi.sette_giorni} colore="azzurro" />
        <Riepilogo titolo="Ultimi 30 giorni" dati={dati.periodi.trenta_giorni} colore="viola" />
      </div>
      <Sezione titolo="Consumi per servizio" nota="Il conteggio parte dall’attivazione di questa pagina; i consumi precedenti non sono ricostruibili.">
        {dati.servizi.length === 0 ? <p className="text-sm text-slate-500">Nessuna chiamata registrata. I dati compariranno con le prossime richieste AI.</p> :
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="pb-3">Servizio</th><th className="pb-3">Fornitore</th><th className="pb-3 text-right">Chiamate</th><th className="pb-3 text-right">Token usati</th><th className="pb-3 text-right">Errori</th></tr></thead>
            <tbody>{dati.servizi.map(r => <tr key={`${r.servizio}-${r.fornitore}-${r.modello}`} className="border-t border-slate-100">
              <td className="py-3"><span className="font-semibold text-slate-800">{nomi[r.servizio] || r.servizio}</span><span className="block text-xs text-slate-400">{r.modello}</span></td>
              <td className="py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">{r.fornitore}</span></td>
              <td className="py-3 text-right tabular-nums text-slate-700">{numero.format(r.chiamate)}</td>
              <td className="py-3 text-right font-semibold tabular-nums text-sky-700">{numero.format(r.token_totali)}</td>
              <td className="py-3 text-right"><span className={`inline-flex min-w-7 justify-center rounded-full px-2 py-1 text-xs font-semibold ${r.errori ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{numero.format(r.errori)}</span></td>
            </tr>)}</tbody>
          </table></div>}
      </Sezione>
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sky-950 shadow-sm">
        <div className="flex items-center gap-2 font-semibold"><Info size={18} aria-hidden /><h2>Disponibilità residua</h2></div>
        <p className="mt-2 text-sm leading-relaxed text-sky-900/80">{dati.nota_disponibilita}</p>
      </div>
      <Sezione titolo="Errori recenti" nota="Mostra soltanto tipo, servizio e momento dell’errore.">
        {dati.errori_recenti.length === 0 ? <p className="flex items-center gap-2 text-sm text-emerald-700"><Activity size={17} aria-hidden /> Nessun errore registrato.</p> : <div className="flex flex-col gap-2">{dati.errori_recenti.map((e, i) => <div key={`${e.creato_il}-${i}`} className="flex items-start justify-between gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-900"><span className="flex items-center gap-2"><AlertTriangle className="shrink-0" size={16} aria-hidden /><span><strong>{nomi[e.servizio] || e.servizio}</strong> · {e.tipo}</span></span><time className="shrink-0 text-xs text-red-500">{new Date(e.creato_il).toLocaleString('it-IT')}</time></div>)}</div>}
      </Sezione>
    </>}
  </PaginaAdmin>
}
