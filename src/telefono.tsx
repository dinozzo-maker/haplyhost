import { Fragment } from 'react'
import type { ReactNode } from 'react'

// Numeri di telefono nel testo → chip "chiama" (.g-tel). I codici brevi di emergenza
// (112, 118…) solo quando richiesti esplicitamente; i numeri lunghi sempre.
// Condivisa da PaginaStatica.tsx (pagine di testo) e Gennarino.tsx (risposte in chat).
export function reTelefono(includeEmergenza: boolean): RegExp {
  const parti = ['\\+?\\d{2,4}[ .\\-]?\\d{5,9}']
  if (includeEmergenza) parti.unshift('\\b(?:11[2-8]|1(?:515|518|530))\\b')
  return new RegExp(`(${parti.join('|')})`, 'g')
}

export function conTelefoni(testo: string, re: RegExp): ReactNode {
  if (!testo) return testo
  return testo.split(re).map((p, i) => {
    if (i % 2 === 0) return <Fragment key={i}>{p}</Fragment>
    return (
      <a key={i} className="g-tel" href={`tel:${p.replace(/[^\d+]/g, '')}`}>
        {p.trim()}
      </a>
    )
  })
}

// true se `testo` contiene proprio il numero `telefono` (confronto sulle sole cifre).
// Usata in Gennarino.tsx per capire se mostrare i tasti WhatsApp/Chiama sotto UNA
// risposta specifica. `host_telefono` è salvato con prefisso internazionale
// ("+39 335 173 3758") ma Gennarino di solito lo scrive senza ("335 173 3758"): un
// confronto sull'intero numero non troverebbe mai corrispondenza (il testo, più corto,
// non può contenere il numero salvato, più lungo). Si confrontano invece le ultime 9
// cifre — il prefisso internazionale è sempre davanti, quindi non cambia la coda — così
// il confronto funziona con o senza prefisso, da entrambi i lati.
export function contieneTelefono(testo: string, telefono: string): boolean {
  const cifre = telefono.replace(/\D/g, '')
  if (cifre.length < 6) return false
  const nucleo = cifre.slice(-9)
  return testo.replace(/\D/g, '').includes(nucleo)
}
