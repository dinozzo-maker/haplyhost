// Le password sono conservate esattamente come inserite, inclusi eventuali spazi.
export function validaDatiCasa(dati) {
  const testo = (chiave, massimo) => {
    if (dati[chiave] != null && typeof dati[chiave] !== 'string') throw new Error('Dati della casa non validi.')
    const valore = (dati[chiave] || '').trim()
    if (valore.length > massimo) throw new Error('Uno dei campi della casa è troppo lungo.')
    return valore
  }
  const risultato = {
    nome: testo('nome', 200), indirizzo: testo('indirizzo', 500), citta: testo('citta', 200),
    host_nome: testo('host_nome', 200), host_telefono: testo('host_telefono', 80),
    checkin: testo('checkin', 100), checkout: testo('checkout', 100), link: testo('link', 2000),
  }
  if (!risultato.nome || !risultato.indirizzo) throw new Error('Nome e indirizzo sono obbligatori.')
  if (risultato.link && !/^https?:\/\//i.test(risultato.link)) throw new Error('Inserisci un link che inizi con https:// o http://.')
  const reti = dati.reti_wifi ?? []
  if (!Array.isArray(reti) || reti.length > 20) throw new Error('Puoi inserire al massimo 20 reti Wi-Fi.')
  risultato.reti_wifi = reti.flatMap((rete) => {
    if (!rete || ['nome', 'password', 'zona'].some(campo => typeof rete[campo] !== 'string')) throw new Error('Rete Wi-Fi non valida.')
    if (!rete.nome && !rete.password && !rete.zona) return []
    if (!rete.nome.trim()) throw new Error('Inserisci il nome di ogni rete Wi-Fi.')
    if (rete.nome.length > 100 || rete.password.length > 200 || rete.zona.length > 200) throw new Error('I dati di una rete Wi-Fi sono troppo lunghi.')
    return [{ nome: rete.nome, password: rete.password, zona: rete.zona.trim() }]
  })
  return risultato
}
