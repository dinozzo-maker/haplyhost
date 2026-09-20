function paroleNome(nome) {
  return String(nome || '').normalize('NFKC').toLocaleLowerCase('it')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean)
}

// Solo tipologie comuni, mai città o nomi propri. Serve a segnalare un dubbio,
// non a rinominare o unire automaticamente due attività.
const TIPI = new Set(['pizzeria', 'ristorante', 'trattoria', 'osteria', 'ristopub'])

function differenzaUnaLettera(a, b) {
  if (Math.min(a.length, b.length) < 6 || Math.abs(a.length - b.length) > 1) return false
  let i = 0, j = 0, differenze = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++differenze > 1) return false
    if (a.length >= b.length) i++
    if (b.length >= a.length) j++
  }
  return differenze + (a.length - i) + (b.length - j) <= 1
}

export function possibileDuplicato(nome, nomiEsistenti) {
  const parole = paroleNome(nome)
  if (!parole.length) return null
  const significative = parole.filter(parola => !TIPI.has(parola))
  return nomiEsistenti.find(esistente => {
    const altre = paroleNome(esistente)
    if (parole.join(' ') === altre.join(' ')) return true
    const altreSignificative = altre.filter(parola => !TIPI.has(parola))
    if (!significative.length || !altreSignificative.length) return false
    const [corte, lunghe] = significative.length <= altreSignificative.length
      ? [significative, altreSignificative] : [altreSignificative, significative]
    if (corte.length === 1 && lunghe.length > 1 && corte[0].length < 6) return false
    if (corte[0] !== lunghe[0] && !differenzaUnaLettera(corte[0], lunghe[0])) return false
    const disponibili = [...lunghe]
    let refusi = 0
    return corte.every(parola => {
      let indice = disponibili.indexOf(parola)
      if (indice < 0 && refusi === 0) {
        indice = disponibili.findIndex(altra => differenzaUnaLettera(parola, altra))
        if (indice >= 0) refusi++
      }
      if (indice < 0) return false
      disponibili.splice(indice, 1)
      return true
    })
  }) || null
}
