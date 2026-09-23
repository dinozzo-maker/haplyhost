import { useLingua } from './lingua'
import type { Lingua } from './lingua'

const ETICHETTA: Record<Lingua, string> = { it: 'Foto', en: 'Photo', fr: 'Photo', de: 'Foto', es: 'Foto' }

// Credito dell'autore per le foto prese da Wikimedia Commons (licenze CC BY / CC BY-SA:
// chiedono di indicare l'autore). Senza `credito` — foto caricata a mano dall'host —
// non rende nulla. `senzaLink` serve dentro un altro link (la card "Oggi ti consiglio"
// è già un <Link>: un <a> dentro un <a> non è HTML valido).
export default function CreditoFoto({
  credito,
  url,
  senzaLink,
  className,
}: {
  credito: string | null
  url: string | null
  senzaLink?: boolean
  className: string
}) {
  const { lingua } = useLingua()
  if (!credito) return null
  return (
    <span className={className}>
      {ETICHETTA[lingua]}:{' '}
      {url && !senzaLink ? (
        <a href={url} target="_blank" rel="noreferrer">{credito}</a>
      ) : (
        credito
      )}
    </span>
  )
}
