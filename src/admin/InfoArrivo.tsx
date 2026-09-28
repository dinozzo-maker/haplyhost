import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { ContestoHost } from './RichiedeLogin'
import { PaginaAdmin, Sezione, Campo, classeCampo, Pulsante, Esito } from './ui'

const MAX = 4000

// «Come entrare»: istruzioni di arrivo RISERVATE (codice della porta o della cassetta chiavi,
// parcheggio, prime cose da sapere). Vivono in `strutture_segreti.info_arrivo` (migration 0025),
// non in una pagina della guida: l'ospite le vede solo dal giorno del check-in al giorno del
// check-out, solo col suo link personale (api/ospite.js, azione `arrivo`). Non le legge Gennarino.
export default function InfoArrivo() {
  const { struttura } = useOutletContext<ContestoHost>()
  const [testo, setTesto] = useState('')
  const [caricamento, setCaricamento] = useState(true)
  const [erroreLettura, setErroreLettura] = useState(false)
  const [salvataggio, setSalvataggio] = useState(false)
  const [esito, setEsito] = useState('')

  useEffect(() => {
    if (!struttura) return
    let attivo = true
    void supabase
      .from('strutture_segreti')
      .select('info_arrivo')
      .eq('struttura_id', struttura.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!attivo) return
        setErroreLettura(!!error)
        setTesto(data?.info_arrivo ?? '')
        setCaricamento(false)
      })
    return () => {
      attivo = false
    }
  }, [struttura])

  if (!struttura) {
    return (
      <PaginaAdmin titolo="Come entrare">
        <p className="text-sm text-slate-500">Non hai ancora una struttura.</p>
      </PaginaAdmin>
    )
  }
  const strutturaId = struttura.id

  async function salva() {
    setSalvataggio(true)
    setEsito('')
    try {
      const { error } = await supabase
        .from('strutture_segreti')
        .upsert({ struttura_id: strutturaId, info_arrivo: testo.trim() || null }, { onConflict: 'struttura_id' })
      setEsito(error ? 'Non riesco a salvare. Riprova.' : 'ok')
    } catch {
      setEsito('Errore di connessione. Riprova.')
    } finally {
      setSalvataggio(false)
    }
  }

  return (
    <PaginaAdmin
      titolo="Come entrare"
      sottotitolo={
        <>
          Scrivi qui le istruzioni per entrare in casa: il codice della porta o della cassetta delle chiavi,
          dove parcheggiare, le prime cose da sapere. L&apos;ospite le vede{' '}
          <strong>solo dal giorno del check-in al giorno del check-out</strong> e solo con il suo link personale.
          Non compaiono nella guida pubblica e Gennarino non le legge mai.
        </>
      }
    >
      <Sezione>
        {caricamento ? (
          <p className="text-sm text-slate-500">Caricamento...</p>
        ) : (
          <>
            {erroreLettura && (
              <Esito ok={false}>Non riesco a leggere le istruzioni salvate (la migration 0025 è stata lanciata?).</Esito>
            )}
            <Campo
              etichetta="Istruzioni di arrivo"
              aiuto="Una frase per riga, come le diresti a voce. Il testo si mostra così com'è e non viene tradotto: se ospiti persone straniere, scrivilo anche in inglese."
            >
              <textarea
                className={classeCampo}
                rows={10}
                maxLength={MAX}
                value={testo}
                onChange={(e) => {
                  setTesto(e.target.value)
                  setEsito('')
                }}
                placeholder={
                  'La cassetta delle chiavi è a sinistra del cancello. Codice: 4827.\n' +
                  'Il parcheggio è nel cortile, il posto a destra è il nostro.\n' +
                  'La porta d\'ingresso si apre con la chiave lunga, girala due volte.\n' +
                  'Se hai problemi, scrivimi su WhatsApp.'
                }
              />
            </Campo>
            <p className="-mt-2 text-right text-xs tabular-nums text-slate-400">{testo.length} / {MAX}</p>
            <div className="flex flex-col gap-2">
              <Pulsante onClick={salva} disabled={salvataggio || erroreLettura}>
                {salvataggio ? 'Salvo...' : 'Salva'}
              </Pulsante>
              {esito === 'ok' && <Esito ok>Salvato ✓</Esito>}
              {esito && esito !== 'ok' && <Esito ok={false}>{esito}</Esito>}
            </div>
          </>
        )}
      </Sezione>

      <Sezione titolo="Consigli di sicurezza">
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
          <li>Se c&apos;è un codice, considera di cambiarlo dopo ogni soggiorno: l&apos;ospite potrebbe averlo salvato.</li>
          <li>Chi ha il link personale vede il testo nei giorni del suo soggiorno: non mandare il link a persone diverse dall&apos;ospite.</li>
          <li>Per vedere come appare all&apos;ospite, crea un soggiorno di prova in «Soggiorni e Wi-Fi» e apri il suo link.</li>
        </ul>
      </Sezione>
    </PaginaAdmin>
  )
}
