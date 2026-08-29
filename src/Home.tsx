import { Link, useOutletContext, useParams } from 'react-router-dom'
import type { StrutturaRow } from './Struttura'
import { SEZIONI } from './sezioni'

export default function Home() {
  const struttura = useOutletContext<StrutturaRow>()
  const { slug } = useParams()

  return (
    <div className="max-w-sm mx-auto p-6">
      <h1 className="text-2xl font-bold text-center mb-1">{struttura.nome}</h1>
      <p className="text-center text-gray-500 mb-6">{struttura.citta}</p>

      <div className="grid grid-cols-3 gap-3">
        {SEZIONI.map((s) => (
          <Link
            key={s.chiave}
            to={`/${slug}/${s.chiave}`}
            className="aspect-square bg-white rounded-2xl shadow p-3 flex flex-col items-center justify-center gap-1 hover:shadow-md transition"
          >
            <span className="text-2xl">{s.icona}</span>
            <span className="font-medium text-center text-xs">{s.etichetta}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}