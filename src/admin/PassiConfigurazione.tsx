export default function PassiConfigurazione({ passo }: { passo: number }) {
  return <nav aria-label="Avanzamento configurazione">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Passaggio {passo} di 3</p>
    <ol className="grid grid-cols-3 gap-2">
      {['La casa', 'Le sezioni', 'La guida'].map((titolo, indice) => <li key={titolo} aria-current={passo === indice + 1 ? 'step' : undefined} className={`border-t-4 pt-2 text-xs font-semibold ${passo >= indice + 1 ? 'border-amber-400 text-slate-900' : 'border-slate-200 text-slate-400'}`}>{indice + 1}. {titolo}</li>)}
    </ol>
  </nav>
}
