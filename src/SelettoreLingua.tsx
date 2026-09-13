import { LINGUE, useLingua } from './lingua'

// Riga di 5 pastiglie (sigla lingua), sotto la copertina nella home.
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
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
