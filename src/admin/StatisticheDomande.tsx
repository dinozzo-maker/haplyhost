import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { ContestoHost } from './RichiedeLogin'
import { PaginaAdmin, Sezione } from './ui'

type Riga = { giorno: string; lingua: string; numero: number }

const NOMI_LINGUA: Record<string, string> = {
  it: 'Italiano', en: 'Inglese', fr: 'Francese', de: 'Tedesco', es: 'Spagnolo',
}

function Tessera({ numero, etichetta }: { numero: number; etichetta: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
      <p className="text-2xl font-bold text-slate-900 tabular-nums">{numero}</p>
      <p className="text-xs text-slate-500 mt-0.5">{etichetta}</p>
    </div>
  )
}

export default function StatisticheDomande() {
  const { struttura } = useOutletContext<ContestoHost>()
  const [righe, setRighe] = useState<Riga[]>([])
  const [caricamento, setCaricamento] = useState(true)

  useEffect(() => {
    async function carica() {
      if (!struttura) {
        setRighe([])
        setCaricamento(false)
        return
      }
      setCaricamento(true)
      const { data } = await supabase
        .from('statistiche_domande_giornaliere')
        .select('giorno, lingua, numero')
        .eq('struttura_id', struttura.id)
        .order('giorno', { ascending: false })
      setRighe((data ?? []) as Riga[])
      setCaricamento(false)
    }
    carica()
  }, [struttura])

  const dati = useMemo(() => {
    const oggi = new Date()
    const trentaGiorniFa = new Date(oggi)
    trentaGiorniFa.setDate(oggi.getDate() - 29)
    const soglia = trentaGiorniFa.toISOString().slice(0, 10)
    const totale = righe.reduce((somma, r) => somma + r.numero, 0)
    const ultimoMese = righe.filter((r) => r.giorno >= soglia).reduce((somma, r) => somma + r.numero, 0)
    const perLingua = new Map<string, number>()
    for (const r of righe) perLingua.set(r.lingua, (perLingua.get(r.lingua) ?? 0) + r.numero)
    return { totale, ultimoMese, lingue: [...perLingua.entries()].sort((a, b) => b[1] - a[1]) }
  }, [righe])

  if (!struttura) return <PaginaAdmin titolo="Statistiche Gennarino"><p className="text-sm text-slate-500">Non hai ancora una struttura.</p></PaginaAdmin>

  return (
    <PaginaAdmin titolo="Statistiche Gennarino" sottotitolo="Numeri aggregati e anonimi sulle richieste degli ospiti. Non mostrano nomi, contatti o conversazioni.">
      {caricamento && <p className="text-sm text-slate-500">Caricamento...</p>}
      {!caricamento && dati.totale === 0 && <Sezione><p className="text-sm text-slate-500">Le statistiche compariranno dopo le prime domande degli ospiti.</p></Sezione>}
      {!caricamento && dati.totale > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Tessera numero={dati.totale} etichetta="domande raccolte" />
            <Tessera numero={dati.ultimoMese} etichetta="negli ultimi 30 giorni" />
          </div>
          <Sezione titolo="Lingue degli ospiti" nota="Basato sulla lingua riconosciuta nella domanda, non sull'identità della persona.">
            <div className="flex flex-col gap-2">
              {dati.lingue.map(([lingua, numero]) => {
                const percentuale = Math.round((numero / dati.totale) * 100)
                return <div key={lingua} className="flex items-center gap-3 text-sm">
                  <span className="w-20 text-slate-700">{NOMI_LINGUA[lingua] ?? lingua.toUpperCase()}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-amber-400" style={{ width: `${percentuale}%` }} /></div>
                  <span className="w-14 text-right tabular-nums text-slate-500">{numero} · {percentuale}%</span>
                </div>
              })}
            </div>
          </Sezione>
          <p className="text-xs leading-relaxed text-slate-400">Le conversazioni testuali vengono eliminate automaticamente dopo 90 giorni; questi conteggi restano disponibili in forma aggregata.</p>
        </>
      )}
    </PaginaAdmin>
  )
}
