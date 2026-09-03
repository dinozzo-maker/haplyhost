import { NavLink } from 'react-router-dom'
import { useSezioni } from './useSezioni'
import { filtraVisibili } from './sezioni'
import type { StrutturaRow } from './Struttura'

// Barra fissa in basso nella guida ospiti: Home + le prime 2 sezioni "elenco"
// visibili + Gennarino (se la sezione chat è visibile).
export default function TabBar({ slug, struttura }: { slug: string; struttura: StrutturaRow }) {
  const { tutte } = useSezioni()
  const visibili = filtraVisibili(tutte, struttura.sezioni_attive)
  const elenchi = visibili.filter((s) => s.tipo === 'elenco').slice(0, 2)
  const chat = visibili.find((s) => s.tipo === 'chat')

  return (
    <nav className="g-tabbar" aria-label="Navigazione">
      <NavLink to={`/${slug}`} end>
        <span className="t-emo">🏠</span>
        Home
      </NavLink>
      {elenchi.map((s) => (
        <NavLink key={s.chiave} to={`/${slug}/${s.chiave}`}>
          <span className="t-emo">{s.icona}</span>
          {s.etichetta}
        </NavLink>
      ))}
      {chat && (
        <NavLink to={`/${slug}/${chat.chiave}`}>
          <span className="t-emo">{chat.icona}</span>
          Gennarino
        </NavLink>
      )}
    </nav>
  )
}
