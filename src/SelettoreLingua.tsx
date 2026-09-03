import { useState } from 'react'
import { LINGUE, LINGUE_LABEL, T, useLingua } from './lingua'

// Chip in alto a destra nella guida: mostra la lingua corrente, al tap apre le 5.
export default function SelettoreLingua() {
  const { lingua, setLingua } = useLingua()
  const [aperto, setAperto] = useState(false)

  return (
    <div className="g-lang">
      <button
        type="button"
        className="g-lang-chip"
        aria-haspopup="listbox"
        aria-expanded={aperto}
        aria-label={T[lingua].lingua}
        onClick={() => setAperto((v) => !v)}
      >
        🌐 {lingua.toUpperCase()}
      </button>
      {aperto && (
        <>
          <div className="g-lang-scrim" onClick={() => setAperto(false)} />
          <ul className="g-lang-menu" role="listbox" aria-label={T[lingua].lingua}>
            {LINGUE.map((l) => (
              <li key={l}>
                <button
                  type="button"
                  role="option"
                  aria-selected={l === lingua}
                  className={l === lingua ? 'attivo' : undefined}
                  onClick={() => {
                    setLingua(l)
                    setAperto(false)
                  }}
                >
                  {LINGUE_LABEL[l]}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
