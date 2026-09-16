import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

// Impianto grafico comune del pannello host — "vestito" del punto 4 del redesign
// (14/09/2026): tipografia, colori e componenti condivisi, sopra Tailwind grezzo.
// Non è un design system separato come "g-*" (quello è della guida ospiti): qui sono
// solo classi/componenti riusati da ogni pagina /admin/*, per coerenza visiva.

// Pagina intera: back-link, titolo, spazio coerente. Un po' più larga su desktop,
// dove siede accanto alla barra laterale di AdminShell (stesso limite di Admin.tsx).
export function PaginaAdmin({
  titolo,
  sottotitolo,
  indietro = true,
  children,
}: {
  titolo: string
  sottotitolo?: ReactNode
  // false solo per la primissima struttura di un host: non c'è ancora un pannello
  // a cui tornare (Admin.tsx la mostra al posto della dashboard, non come rotta a sé)
  indietro?: boolean
  children: ReactNode
}) {
  return (
    <div className="max-w-sm mx-auto px-5 py-6 lg:max-w-xl lg:mx-0 lg:px-0 lg:py-10">
      {indietro && (
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition mb-5"
        >
          <ArrowLeft className="w-4 h-4" /> Torna al pannello
        </Link>
      )}
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight text-balance">{titolo}</h1>
      {sottotitolo && <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{sottotitolo}</p>}
      <div className="flex flex-col gap-6 mt-7">{children}</div>
    </div>
  )
}

// Un blocco tematico dentro la pagina (es. "Aspetto della guida"): card bianca,
// titolo, eventuale nota. Le sezioni normali (senza titolo proprio) non ne hanno
// bisogno: i <Campo> possono stare direttamente nella pagina.
export function Sezione({
  titolo,
  nota,
  children,
}: {
  titolo?: string
  nota?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      {titolo && <h2 className="text-sm font-bold text-slate-900">{titolo}</h2>}
      {nota && <p className="text-xs text-slate-500 -mt-2 leading-relaxed">{nota}</p>}
      {children}
    </div>
  )
}

// Etichetta + campo, con eventuale nota sotto. `children` è l'input/textarea/select.
export function Campo({
  etichetta,
  aiuto,
  children,
}: {
  etichetta: string
  aiuto?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{etichetta}</span>
      {children}
      {aiuto && <span className="text-xs text-slate-400 leading-relaxed">{aiuto}</span>}
    </label>
  )
}

// Classe condivisa per input/textarea/select — un solo posto dove cambiare bordo,
// arrotondamento, colore del focus.
export const classeCampo =
  'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition'

type PulsanteProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'secondario' | 'pericolo'
}

const VARIANTI: Record<NonNullable<PulsanteProps['variante']>, string> = {
  primario: 'bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50',
  secondario: 'border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50',
  pericolo: 'text-red-600 hover:text-red-700 disabled:opacity-50',
}

export function Pulsante({ variante = 'primario', className = '', ...props }: PulsanteProps) {
  const base =
    variante === 'pericolo'
      ? 'text-sm font-medium'
      : 'w-full rounded-xl py-2.5 text-sm font-semibold transition'
  return <button className={`${base} ${VARIANTI[variante]} ${className}`} {...props} />
}

// Riga di esito sotto un'azione: verde se `ok`, altrimenti testo d'errore.
export function Esito({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <p className={`text-sm text-center ${ok ? 'text-green-600' : 'text-red-600'}`}>{children}</p>
  )
}
