import { Link, useLocation } from 'react-router-dom'
import { useSezioni } from './useSezioni'
import { etichettaSezione, filtraVisibili } from './sezioni'
import { useLingua } from './lingua'
import type { StrutturaRow } from './Struttura'

// Bottone tondo galleggiante che porta alla chat di Gennarino.
// Nascosto quando la sezione chat non è visibile o quando si è già sulla sua pagina.
export default function GennarinoFab({ slug, struttura }: { slug: string; struttura: StrutturaRow }) {
  const { tutte } = useSezioni()
  const { lingua } = useLingua()
  const { pathname } = useLocation()
  const visibili = filtraVisibili(tutte, struttura.sezioni_attive)
  const chat = visibili.find((s) => s.tipo === 'chat')

  if (!chat || pathname.endsWith(`/${chat.chiave}`)) return null

  return (
    <Link to={`/${slug}/${chat.chiave}`} className="g-fab" aria-label={etichettaSezione(chat, lingua)}>
      {chat.icona}
    </Link>
  )
}
