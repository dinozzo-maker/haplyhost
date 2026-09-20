import { Link, useLocation } from 'react-router-dom'
import { useSezioni } from './useSezioni'
import { etichettaSezione, filtraVisibili } from './sezioni'
import { useLingua } from './lingua'
import type { StrutturaRow } from './Struttura'
import { Icona } from './Icona'

// Bottone tondo galleggiante che porta alla chat di Gennarino.
// Nascosto nella home (che ha già la casella per fare una domanda), quando la
// sezione chat non è visibile o quando si è già sulla pagina di Gennarino.
export default function GennarinoFab({ slug, struttura }: { slug: string; struttura: StrutturaRow }) {
  const { tutte } = useSezioni()
  const { lingua } = useLingua()
  const { pathname } = useLocation()
  const visibili = filtraVisibili(tutte, struttura.sezioni_attive)
  const chat = visibili.find((s) => s.tipo === 'chat')

  if (!chat || pathname.replace(/\/$/, '') === `/${slug}` || pathname.endsWith(`/${chat.chiave}`)) return null

  return (
    <Link to={`/${slug}/${chat.chiave}`} className="g-fab" aria-label={etichettaSezione(chat, lingua)}>
      <Icona nome={chat.icona} />
    </Link>
  )
}
