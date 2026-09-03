import { LINGUE, useLingua } from './lingua'
import type { Lingua } from './lingua'

const BANDIERA: Record<Lingua, string> = {
  it: '🇮🇹',
  en: '🇬🇧',
  fr: '🇫🇷',
  de: '🇩🇪',
  es: '🇪🇸',
}

// Riga di 5 pastiglie (bandiera + sigla), sotto la copertina nella home.
export default function SelettoreLingua() {
  const { lingua, setLingua } = useLingua()

  return (
    <div className="g-langrow" role="group" aria-label="Lingua / Language">
      {LINGUE.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={l === lingua}
          className={l === lingua ? 'attivo' : undefined}
          onClick={() => setLingua(l)}
        >
          <span aria-hidden="true">{BANDIERA[l]}</span>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
