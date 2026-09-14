// Stima in minuti da un testo libero di distanza (es. "🚶 7 min a piedi", "20 minuti in
// auto", "auto + traghetto, circa 1h30"). Confronta i numeri così come sono scritti, senza
// normalizzare piedi/auto/traghetto: stessa convenzione già usata nel prompt di Gennarino
// ("7 minuti è più vicino di 10"). Testo senza numeri riconoscibili → in fondo alla lista.
export function minutiDistanza(testo: string | null | undefined): number {
  if (!testo) return Infinity
  const ore = testo.match(/(\d+)\s*h\s*(\d+)?/i)
  if (ore) return Number(ore[1]) * 60 + Number(ore[2] || 0)
  const min = testo.match(/(\d+)/)
  return min ? Number(min[1]) : Infinity
}

// Nuovo array, ordinato dal più vicino al più lontano secondo `campo`.
export function ordinaPerDistanza<T>(righe: T[], campo: (r: T) => string | null | undefined): T[] {
  return righe.slice().sort((a, b) => minutiDistanza(campo(a)) - minutiDistanza(campo(b)))
}
