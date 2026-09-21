import { useState } from 'react'
import { Wifi, Plus, Trash2 } from 'lucide-react'
import { Campo, classeCampo, Pulsante } from './ui'

export type ReteWifi = { nome: string; password: string; zona: string }

export default function RetiWifi({ reti, onChange, disabilitato = false }: {
  reti: ReteWifi[]; onChange: (reti: ReteWifi[]) => void; disabilitato?: boolean
}) {
  const [mostraPassword, setMostraPassword] = useState(false)
  function modifica(indice: number, campo: keyof ReteWifi, valore: string) {
    onChange(reti.map((rete, i) => i === indice ? { ...rete, [campo]: valore } : rete))
  }
  return <fieldset disabled={disabilitato} className="flex min-w-0 flex-col gap-4">
    <legend className="mb-2 text-sm font-bold text-slate-900">Reti Wi-Fi</legend>
    <p className="text-sm text-slate-500">Aggiungi una rete per ogni zona della casa. Puoi completarle anche in seguito.</p>
    <p className="text-xs text-slate-500">Per ora le reti sono conservate nel pannello host e non vengono mostrate nella guida pubblica.</p>
    {reti.map((rete, indice) => <div key={indice} className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><Wifi className="w-4 h-4" />Rete {indice + 1}</span>
        <button type="button" aria-label={`Rimuovi rete ${indice + 1}`} onClick={() => onChange(reti.filter((_, i) => i !== indice))} className="p-2 text-slate-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
      </div>
      <Campo etichetta="Nome della rete"><input className={classeCampo} value={rete.nome} maxLength={100} autoComplete="off" onChange={e => modifica(indice, 'nome', e.target.value)} placeholder="Es. VillaVirginia" /></Campo>
      <Campo etichetta="Password" aiuto="Lascia vuoto se la rete non richiede una password."><input type={mostraPassword ? 'text' : 'password'} className={classeCampo} value={rete.password} maxLength={200} autoComplete="new-password" onChange={e => modifica(indice, 'password', e.target.value)} /></Campo>
      <Campo etichetta="Zona (facoltativa)"><input className={classeCampo} value={rete.zona} maxLength={200} onChange={e => modifica(indice, 'zona', e.target.value)} placeholder="Es. Piano terra, primo piano, giardino" /></Campo>
    </div>)}
    {reti.length > 0 && <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="accent-slate-900" checked={mostraPassword} onChange={e => setMostraPassword(e.target.checked)} />Mostra le password</label>}
    <Pulsante type="button" variante="secondario" disabled={reti.length >= 20} onClick={() => onChange([...reti, { nome: '', password: '', zona: '' }])}><Plus className="w-4 h-4 inline mr-1" />Aggiungi una rete</Pulsante>
  </fieldset>
}
