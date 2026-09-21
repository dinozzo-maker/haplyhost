import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import RetiWifi from './RetiWifi'
import type { ReteWifi } from './RetiWifi'
import { Sezione, Pulsante, Esito } from './ui'

export default function GestisciWifi({ strutturaId }: { strutturaId: string }) {
  const [reti, setReti] = useState<ReteWifi[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [erroreLettura, setErroreLettura] = useState(false)
  const [salvataggio, setSalvataggio] = useState(false)
  const [esito, setEsito] = useState('')
  useEffect(() => {
    let attivo = true
    void supabase.from('strutture_segreti').select('reti_wifi').eq('struttura_id', strutturaId).maybeSingle().then(({ data, error }) => {
      if (!attivo) return
      setErroreLettura(!!error)
      setReti(data?.reti_wifi ?? [])
      setCaricamento(false)
    })
    return () => { attivo = false }
  }, [strutturaId])
  async function salva() {
    if (reti.some(rete => !rete.nome.trim() && (rete.password || rete.zona))) { setEsito('Inserisci il nome di ogni rete oppure rimuovila.'); return }
    setSalvataggio(true)
    setEsito('')
    try {
      const { error } = await supabase.from('strutture_segreti').upsert({ struttura_id: strutturaId, reti_wifi: reti.filter(rete => rete.nome.trim()) }, { onConflict: 'struttura_id' })
      setEsito(error ? 'Non riesco a salvare le reti. Riprova.' : 'ok')
    } catch { setEsito('Errore di connessione. Riprova.') }
    finally { setSalvataggio(false) }
  }
  return <Sezione titolo="Connessione Wi-Fi">
    {caricamento ? <p className="text-sm text-slate-500">Carico le reti…</p> : erroreLettura
      ? <Esito ok={false}>Le reti Wi-Fi non sono disponibili. Ricarica la pagina o verifica l’aggiornamento del database.</Esito>
      : <><RetiWifi reti={reti} disabilitato={salvataggio} onChange={valore => { setReti(valore); setEsito('') }} />
        <Pulsante type="button" disabled={salvataggio} onClick={salva}>{salvataggio ? 'Salvo…' : 'Salva le reti Wi-Fi'}</Pulsante>
        {esito && <Esito ok={esito === 'ok'}>{esito === 'ok' ? 'Reti Wi-Fi salvate.' : esito}</Esito>}
      </>}
  </Sezione>
}
