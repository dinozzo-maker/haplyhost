import { useId } from 'react'

// Prova (14/09/2026): un volto semplice per Gennarino al posto della sola icona
// fumetto, per dargli più presenza senza una vera illustrazione. Sfondo con lo
// stesso gradiente scelto dall'host (--g-grad-a/b, come la card "Chiedi a
// Gennarino"): niente colori fissi, resta coerente con l'accento della guida.
export default function GennarinoAvatar({ className }: { className?: string }) {
  const gradId = useId()
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--g-grad-a)" />
          <stop offset="100%" stopColor="var(--g-grad-b)" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill={`url(#${gradId})`} />
      <circle cx="14.5" cy="17.5" r="1.7" fill="#fff" />
      <circle cx="25.5" cy="17.5" r="1.7" fill="#fff" />
      <path
        d="M8.5 24c3-3.2 6.2-1.6 8.3-0.2M31.5 24c-3-3.2-6.2-1.6-8.3-0.2"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M15 27c2.2 2.4 7.8 2.4 10 0" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  )
}
