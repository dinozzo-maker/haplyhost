import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { oggiInItalia, aggiungiGiorni } from '../../lib/soggiorni.js'
import { calcolaAdozione } from '../../lib/adozione.js'

type Dati = { adozione: ReturnType<typeof calcolaAdozione>; domande: number | null }

// Cruscotto «Adozione della guida»: gli ospiti la aprono davvero? Si basa sul conteggio delle
// aperture per soggiorno (migration 0024) e sulle statistiche anonime di Gennarino. Numeri veri e
// prudenti (vedi lib/adozione.js): servono all'host per capire se la guida funziona, e per poterlo
// raccontare a chi non la usa ancora. Se la migration manca non compare nulla (nessun errore).
export default function AdozioneGuida({ strutturaId }: { strutturaId: string }) {
  const [dati, setDati] = useState<Dati | null>(null)

  useEffect(() => {
    let vivo = true
    const oggi = oggiInItalia()
    const da = aggiungiGiorni(oggi, -30)
    ;(async () => {
      const soggiorni = await supabase
        .from('soggiorni')
        .select('checkin, checkout, aperture')
        .eq('struttura_id', strutturaId)
        .gte('checkin', da)
        .lte('checkin', oggi)
      if (!vivo || soggiorni.error) return // colonna `aperture` assente: il cruscotto non si mostra

      const statistiche = await supabase
        .from('statistiche_domande_giornaliere')
        .select('numero')
        .eq('struttura_id', strutturaId)
        .gte('giorno', da)
      if (!vivo) return
      const domande = statistiche.error
        ? null
        : (statistiche.data ?? []).reduce((somma, riga) => somma + (riga.numero || 0), 0)

      setDati({ adozione: calcolaAdozione(soggiorni.data ?? [], oggi), domande })
    })()
    return () => {
      vivo = false
    }
  }, [strutturaId])

  if (!dati) return null
  const { adozione: a, domande } = dati

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">Adozione della guida</h2>
        <span className="text-xs text-slate-400">ultimi 30 giorni</span>
      </div>

      {a.soggiorni === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Nessun soggiorno negli ultimi 30 giorni. Crea un soggiorno in{' '}
          <Link to="/admin/soggiorni" className="underline">Soggiorni e Wi-Fi</Link> e manda il link
          all&apos;ospite: da lì vedrai qui quanti la usano davvero.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <p className="text-2xl font-bold tabular-nums text-slate-900">
                {a.aperti} <span className="text-base font-semibold text-slate-400">su {a.soggiorni}</span>
              </p>
              <p className="text-xs leading-snug text-slate-500">
                ospiti hanno aperto la guida{a.percentuale !== null ? ` (${a.percentuale}%)` : ''}
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-slate-900">
                {a.apertureMedie !== null ? String(a.apertureMedie).replace('.', ',') : '—'}
              </p>
              <p className="text-xs leading-snug text-slate-500">aperture in media, per chi l&apos;ha aperta</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-slate-900">{domande !== null ? domande : '—'}</p>
              <p className="text-xs leading-snug text-slate-500">domande a Gennarino</p>
            </div>
          </div>

          {a.inCasaSenzaGuida > 0 && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              {a.inCasaSenzaGuida === 1
                ? 'Un ospite in casa non ha ancora aperto la guida.'
                : `${a.inCasaSenzaGuida} ospiti in casa non hanno ancora aperto la guida.`}{' '}
              <Link to="/admin/soggiorni" className="underline">Vedi i soggiorni</Link>
            </p>
          )}
          {a.pochiDati && (
            <p className="mt-3 text-xs text-slate-400">Pochi soggiorni: il dato è solo indicativo.</p>
          )}
        </>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        Conta una visita ogni 30 minuti. Le aperture che fai tu per provare il link contano.
      </p>
    </div>
  )
}
