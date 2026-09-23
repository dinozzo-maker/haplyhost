// Il link personale dell'ospite (?s=<token>) arriva una volta sola, aprendo la guida.
// Lo si ricorda nel browser (per struttura) così il Wi-Fi resta visibile navigando
// tra le pagine e riaprendo la guida nei giorni successivi. Non serve un account:
// il token è la chiave, e api/ospite.js (azione wifi) smette di rispondere dopo il check-out.
const chiave = (slug: string) => `haply-soggiorno-${slug}`

export function salvaTokenSoggiorno(slug: string, token: string) {
  try {
    localStorage.setItem(chiave(slug), token)
  } catch {
    // storage bloccato (navigazione privata): il link funziona finché la pagina resta aperta
  }
}

export function leggiTokenSoggiorno(slug: string): string | null {
  try {
    return localStorage.getItem(chiave(slug))
  } catch {
    return null
  }
}
