import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

type LuogoRow = {
  id: string
  nome: string
  descrizione: string
  distanza: string
  maps: string
  telefono: string
  attivo: boolean
}

type Bozza = {
  nome: string
  descrizione: string
  distanza: string
  maps: string
  telefono: string
}

type PropostaRow = {
  id: string
  nome: string
  descrizione: string
  distanza: string
  maps: string
  telefono: string
}

export default function GestisciSezione({ sezione, etichetta }: { sezione: string; etichetta: string }) {
  const [strutturaId, setStrutturaId] = useState<string | null>(null)
  const [luoghi, setLuoghi] = useState<LuogoRow[]>([])
  const [proposte, setProposte] = useState<PropostaRow[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [modificaId, setModificaId] = useState<string | null>(null)
  const [bozza, setBozza] = useState<Bozza>({ nome: '', descrizione: '', distanza: '', maps: '', telefono: '' })
  const [salvataggio, setSalvataggio] = useState(false)
  const [cercando, setCercando] = useState(false)

  async function caricaTutto(id: string) {
    const { data: dl } = await supabase
      .from('luoghi')
      .select('id, nome, descrizione, distanza, maps, telefono, attivo')
      .eq('struttura_id', id)
      .eq('sezione', sezione)
      .order('ordine')
    setLuoghi(dl ?? [])

    const { data: dp } = await supabase
      .from('proposte')
      .select('id, nome, descrizione, distanza, maps, telefono')
      .eq('struttura_id', id)
      .eq('sezione', sezione)
      .order('creato_il')
    setProposte(dp ?? [])
  }

  useEffect(() => {
    async function carica() {
      const { data: struttura } = await supabase
        .from('strutture')
        .select('id')
        .eq('slug', 'villavirginia')
        .single()

      if (!struttura) { setCaricamento(false); return }

      setStrutturaId(struttura.id)
      await caricaTutto(struttura.id)
      setCaricamento(false)
    }
    carica()
  }, [sezione])

  async function toggle(id: string, nuovoValore: boolean) {
    setLuoghi(luoghi.map(l => l.id === id ? { ...l, attivo: nuovoValore } : l))
    await supabase.from('luoghi').update({ attivo: nuovoValore }).eq('id', id)
  }

  function apriModifica(l: LuogoRow) {
    setModificaId(l.id)
    setBozza({
      nome: l.nome,
      descrizione: l.descrizione || '',
      distanza: l.distanza || '',
      maps: l.maps || '',
      telefono: l.telefono || '',
    })
  }

  async function salva(id: string) {
    setSalvataggio(true)
    await supabase.from('luoghi').update(bozza).eq('id', id)
    setLuoghi(luoghi.map(l => l.id === id ? { ...l, ...bozza } : l))
    setSalvataggio(false)
    setModificaId(null)
  }

  async function cercaNuovi() {
    if (!strutturaId) return
    setCercando(true)
    try {
      await fetch('/api/scout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ struttura_id: strutturaId, sezione }),
      })
      await caricaTutto(strutturaId)
    } finally {
      setCercando(false)
    }
  }

  async function accetta(p: PropostaRow) {
    if (!strutturaId) return
    await supabase.from('luoghi').insert({
      struttura_id: strutturaId,
      sezione,
      nome: p.nome,
      descrizione: p.descrizione,
      distanza: p.distanza,
      maps: p.maps,
      telefono: p.telefono,
      attivo: true,
      ordine: 999,
    })
    await supabase.from('proposte').delete().eq('id', p.id)
    await caricaTutto(strutturaId)
  }

  async function rifiuta(id: string) {
    await supabase.from('proposte').delete().eq('id', id)
    setProposte(proposte.filter(p => p.id !== id))
  }

  return (
    <div className="max-w-sm mx-auto p-6">
      <Link to="/admin" className="text-sm text-blue-600">&larr; Torna al pannello</Link>
      <h1 className="text-xl font-bold mt-2 mb-4">Gestisci {etichetta}</h1>

      <button
        onClick={cercaNuovi}
        disabled={cercando}
        className="w-full bg-green-600 text-white rounded-lg py-2 text-sm mb-4 disabled:opacity-50"
      >
        {cercando ? 'Gennarino sta cercando online...' : '🔍 Cerca nuovi luoghi'}
      </button>

      {proposte.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-medium text-gray-400 mb-2">PROPOSTE DA APPROVARE ({proposte.length})</p>
          <div className="flex flex-col gap-2">
            {proposte.map((p) => (
              <div key={p.id} className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <p className="font-medium text-sm">{p.nome}</p>
                {p.distanza && <p className="text-xs text-gray-500">{p.distanza}</p>}
                <p className="text-xs mt-1">{p.descrizione}</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => accetta(p)} className="flex-1 bg-green-600 text-white rounded-lg py-1.5 text-xs">
                    ✓ Accetta
                  </button>
                  <button onClick={() => rifiuta(p.id)} className="flex-1 border rounded-lg py-1.5 text-xs">
                    ✕ Rifiuta
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {caricamento && <p>Caricamento...</p>}

      <p className="text-xs font-medium text-gray-400 mb-2">GIÀ PRESENTI</p>
      <div className="flex flex-col gap-2">
        {luoghi.map((l) => (
          <div key={l.id} className="bg-white shadow rounded-xl p-3">
            {modificaId === l.id ? (
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-500">Nome</label>
                <input className="border rounded-lg px-3 py-2 text-sm" value={bozza.nome} onChange={(e) => setBozza({ ...bozza, nome: e.target.value })} />
                <label className="text-xs text-gray-500">Descrizione</label>
                <textarea className="border rounded-lg px-3 py-2 text-sm" rows={3} value={bozza.descrizione} onChange={(e) => setBozza({ ...bozza, descrizione: e.target.value })} />
                <label className="text-xs text-gray-500">Distanza</label>
                <input className="border rounded-lg px-3 py-2 text-sm" value={bozza.distanza} onChange={(e) => setBozza({ ...bozza, distanza: e.target.value })} />
                <label className="text-xs text-gray-500">Link Google Maps</label>
                <input className="border rounded-lg px-3 py-2 text-sm" value={bozza.maps} onChange={(e) => setBozza({ ...bozza, maps: e.target.value })} />
                <label className="text-xs text-gray-500">Telefono</label>
                <input className="border rounded-lg px-3 py-2 text-sm" value={bozza.telefono} onChange={(e) => setBozza({ ...bozza, telefono: e.target.value })} />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => salva(l.id)} disabled={salvataggio} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm disabled:opacity-50">
                    {salvataggio ? 'Salvo...' : 'Salva'}
                  </button>
                  <button onClick={() => setModificaId(null)} className="flex-1 border rounded-lg py-2 text-sm">
                    Annulla
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{l.nome}</p>
                  <p className="text-xs text-gray-500 line-clamp-1">{l.descrizione}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => apriModifica(l)} className="text-xs text-blue-600">Modifica</button>
                  <input type="checkbox" checked={l.attivo} onChange={(e) => toggle(l.id, e.target.checked)} className="w-5 h-5 accent-blue-600" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}