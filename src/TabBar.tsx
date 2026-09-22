import { Link, useLocation } from 'react-router-dom'
import { useSezioni } from './useSezioni'
import { filtraVisibili } from './sezioni'
import { Compass } from 'lucide-react'
import { TESTI_HOME } from './testiHome'
import { T, useLingua } from './lingua'
import type { StrutturaRow } from './Struttura'
import { Icona } from './Icona'

// Barra fissa in basso nella guida ospiti: Home + le prime 2 sezioni "elenco"
// visibili + Gennarino (se la sezione chat è visibile).
export default function TabBar({ slug, struttura }: { slug: string; struttura: StrutturaRow }) {
  const { tutte } = useSezioni()
  const { lingua } = useLingua()
  const visibili = filtraVisibili(tutte, struttura.sezioni_attive)
  const { pathname, hash } = useLocation()
  const home = pathname.replace(/\/$/, '') === `/${slug}`
  const chat = visibili.find((s) => s.tipo === 'chat')

  return (
    <nav className="g-tabbar" aria-label={T[lingua].navigazione}>
      <Link to={`/${slug}`} aria-current={home && !hash ? 'page' : undefined} onClick={() => { if (home) window.scrollTo({ top: 0 }) }}>
        <span className="t-emo"><Icona nome="home" /></span>
        {T[lingua].tabHome}
      </Link>
      <Link to={`/${slug}#esplora`} aria-current={home && hash === '#esplora' ? 'location' : undefined} onClick={() => { if (home) document.getElementById('esplora')?.scrollIntoView({ block: 'start' }) }}>
        <span className="t-emo"><Compass /></span>{TESTI_HOME[lingua].esplora}
      </Link>
      {chat && (
        <Link to={`/${slug}/${chat.chiave}`} aria-current={pathname.endsWith(`/${chat.chiave}`) ? 'page' : undefined}>
          <span className="t-emo"><Icona nome={chat.icona} /></span>
          Gennarino
        </Link>
      )}
    </nav>
  )
}
