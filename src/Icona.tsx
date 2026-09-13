import { Circle } from 'lucide-react'
import { ICONE } from './icone'

// Renderizza l'icona di una sezione (di sistema o custom). `nome` mancante o non
// riconosciuto (vecchia emoji, valore vuoto) → icona generica, mai testo grezzo.
export function Icona({ nome, className, size }: { nome?: string | null; className?: string; size?: number }) {
  const Componente = (nome && ICONE[nome]) || Circle
  return <Componente className={className} size={size} aria-hidden="true" />
}
