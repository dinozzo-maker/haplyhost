import type { Sezione } from '../sezioni'
import { Icona } from '../Icona'

export default function SceltaSezioni({ tutte, attive, onChange }: {
  tutte: Sezione[]; attive: string[]; onChange: (attive: string[]) => void
}) {
  return <div className="flex flex-col gap-5">
    {([{ tipo: 'testo', titolo: 'Informazioni sulla casa' }, { tipo: 'elenco', titolo: 'Luoghi da scoprire' }, { tipo: 'chat', titolo: 'Il tuo concierge' }] as const).map(gruppo =>
      <fieldset key={gruppo.tipo} className="min-w-0">
        <legend className="mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{gruppo.titolo}</legend>
        <div className="grid gap-2 lg:grid-cols-2">
          {tutte.filter(sezione => sezione.tipo === gruppo.tipo).map(sezione => <label key={sezione.chiave} className={`flex items-start justify-between gap-3 cursor-pointer rounded-xl border p-4 ${attive.includes(sezione.chiave) ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'}`}>
            <span className="min-w-0"><span className="flex items-center gap-2 text-sm font-medium text-slate-900"><Icona nome={sezione.icona} className="w-4 h-4 shrink-0" />{sezione.etichetta}</span>{sezione.descrizione && <span className="block mt-1 text-xs text-slate-500">{sezione.descrizione}</span>}</span>
            <input type="checkbox" className="w-5 h-5 accent-slate-900 shrink-0" checked={attive.includes(sezione.chiave)} onChange={() => onChange(attive.includes(sezione.chiave) ? attive.filter(chiave => chiave !== sezione.chiave) : [...attive, sezione.chiave])} />
          </label>)}
        </div>
      </fieldset>)}
  </div>
}
