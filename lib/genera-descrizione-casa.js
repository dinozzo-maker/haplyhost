// Codice condiviso tra api/importa-casa.js (creazione struttura) e
// api/aggiorna-casa.js (rigenerazione descrizione di una struttura esistente).
// Sta fuori da api/ così Vercel non lo tratta come una funzione serverless a sé.

export function pulisciHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000)
}

// Legge il link (se c'è), chiede a Claude una descrizione accogliente + il nome
// della città, e restituisce { descrizione, citta }. Non lancia mai: in caso di
// errore restituisce stringhe vuote, così l'onboarding non si blocca.
export async function generaDescrizioneCasa({ nome, indirizzo, link }) {
  let testoPagina = ''
  if (link) {
    try {
      const pagina = await fetch(link, { headers: { 'user-agent': 'Mozilla/5.0' } })
      const html = await pagina.text()
      testoPagina = pulisciHtml(html)
    } catch (err) {
      console.error('Errore lettura link:', err)
    }
  }

  const istruzioni = testoPagina
    ? `Scrivi una descrizione accogliente in italiano (massimo 500 caratteri) per una casa vacanze chiamata "${nome}", a ${indirizzo}. Usa queste informazioni trovate online, se utili:\n\n${testoPagina}\n\nSe le informazioni non bastano, scrivi una descrizione generica ma onesta basata solo sul nome e l'indirizzo.`
    : `Scrivi una breve descrizione accogliente in italiano (massimo 500 caratteri) per una casa vacanze chiamata "${nome}", a ${indirizzo}.`

  const prompt = `${istruzioni}

Ricava anche il nome della città (solo il comune, per esempio "Sorrento") dall'indirizzo o dalle informazioni qui sopra. Se non ne sei sicuro, lascia la città come stringa vuota.

Rispondi SOLO con un JSON valido, senza testo prima o dopo, in questo formato esatto:
{"descrizione": "...", "citta": "..."}`

  let descrizione = ''
  let citta = ''

  try {
    const risposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const dati = await risposta.json()
    const testo = (dati?.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()

    const pulito = testo.replace(/```json|```/g, '').trim()
    try {
      const parsed = JSON.parse(pulito)
      descrizione = (parsed.descrizione || '').trim()
      citta = (parsed.citta || '').trim()
    } catch {
      // Se Claude non ha risposto con JSON valido, usiamo comunque il testo come
      // descrizione e lasciamo la città vuota.
      console.error('JSON non valido da Claude (descrizione casa):', testo)
      descrizione = pulito
    }
  } catch (err) {
    console.error('Errore Claude:', err)
  }

  return { descrizione, citta }
}
