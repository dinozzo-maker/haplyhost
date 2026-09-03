import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const NOMI_LINGUA = { it: 'italiano', en: 'inglese', fr: 'francese', de: 'tedesco', es: 'spagnolo' }

async function chiamaClaude({ system, messages, max_tokens }) {
  const risposta = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens, system, messages }),
  })
  const dati = await risposta.json()
  return dati?.content?.[0]?.text || ''
}

// Chiamata piccola e dedicata: riconosce in che lingua scrive l'ospite.
// In isolamento (senza il contesto tutto-italiano di Gennarino) Haiku la azzecca.
// Guarda le ultime righe della chat, così anche un "ok" dopo domande in francese
// resta francese. `fallback` = lingua della guida, per casi davvero ambigui.
async function rilevaLinguaDomanda(messaggi, fallback) {
  const ultime = messaggi
    .slice(-5)
    .map(m => `${m.role === 'user' ? 'Ospite' : 'Gennarino'}: ${String(m.content).slice(0, 300)}`)
    .join('\n')
  try {
    const parola = (
      await chiamaClaude({
        system:
          'Ti mando le ultime righe di una chat tra un ospite e un concierge. In che lingua sta scrivendo l\'Ospite? Guarda soprattutto l\'ULTIMA riga dell\'Ospite; se è corta usala comunque se riconoscibile ("merci"/"bonjour" = francese, "grazie"/"ciao" = italiano, "thanks"/"hi" = inglese, "danke"/"hallo" = tedesco, "gracias"/"hola" = spagnolo), altrimenti guarda le righe prima. Rispondi con UNA sola parola tra: italiano, inglese, francese, tedesco, spagnolo, incerto. Niente altro.',
        messages: [{ role: 'user', content: ultime }],
        max_tokens: 8,
      })
    )
      .toLowerCase()
      .trim()
    const mappa = { italiano: 'it', inglese: 'en', francese: 'fr', tedesco: 'de', spagnolo: 'es' }
    return mappa[parola] || fallback
  } catch {
    return fallback
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' })
  }

  const { struttura_id, domanda, storico = [], lang } = req.body

  if (!struttura_id || !domanda) {
    return res.status(400).json({ error: 'Dati mancanti' })
  }

  const linguaGuida = NOMI_LINGUA[lang] ? lang : 'it'

  const [{ data: struttura }, { data: luoghi }, { data: pagine }, linguaRisposta] = await Promise.all([
    supabase
      .from('strutture')
      .select('nome, indirizzo, citta, checkin, checkout, host_nome, host_telefono, max_ospiti, descrizione_casa, note_gennarino')
      .eq('id', struttura_id)
      .single(),
    supabase
      .from('luoghi')
      .select('sezione, nome, categoria, descrizione, distanza, maps, telefono')
      .eq('struttura_id', struttura_id)
      .eq('attivo', true)
      .order('ordine'),
    supabase.from('pagine').select('titolo, contenuto').eq('struttura_id', struttura_id),
    rilevaLinguaDomanda([...storico, { role: 'user', content: domanda }], linguaGuida),
  ])

  const oggi = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date())

  const elencoLuoghi = (luoghi || [])
    .map(l => `- [${l.sezione}] ${l.nome}${l.categoria ? ' (' + l.categoria + ')' : ''}: ${(l.descrizione || '').slice(0, 140)} — distanza: ${l.distanza || 'n/d'}`)
    .join('\n')

  const elencoPagine = (pagine || [])
    .map(p => `--- ${p.titolo} ---\n${p.contenuto}`)
    .join('\n\n')

  const NOME = NOMI_LINGUA[linguaRisposta]
  const direttivaLingua =
    linguaRisposta === 'it'
      ? ''
      : `LINGUA: scrivi la risposta in ${NOME}. Le informazioni qui sotto sono in italiano: traducile tu. Non tradurre i nomi propri (locali, persone, vie, piatti). Puoi al massimo aprire con un saluto italiano ("Ciao!", "Buongiorno!"); tutto il resto della risposta in ${NOME}.

`

  const systemPrompt = `${direttivaLingua}Sei Gennarino, il concierge di ${struttura?.nome || 'questa struttura'}, a ${struttura?.citta || ''}. Sei napoletano e si sente: parli come un amico del posto che si prende cura dell'ospite. Sei caloroso, spontaneo, un filo teatrale, e sei orgoglioso della tua terra — il mare, il cibo, la gente.

COME PARLI (in italiano):
- Apri caldo e diretto: "Ueh, ciao!", "Guarda…", "Senti a me…", "Allora…".
- Dai il TUO parere, non solo i fatti: "il mio consiglio è…", "se fossi in te andrei…", "fidati", "quello è il posto giusto".
- Un pizzico di enfasi affettuosa e di battuta leggera: "si mangia da paura", "a due passi", "roba seria", "mica scherzi", "statte tranquillo/a", "nun te preoccupà", "lo so, fa male al cuore pure a me".
- MAI dialetto stretto o incomprensibile: deve capirti chiunque.
- Nelle altre lingue: stessa personalità (caloroso, diretto, dai il tuo consiglio, un po' di ironia), ma nella lingua dell'ospite.

Esempi di tono:
Ospite: "A che ora è il check-out?"
Tu: "Alle ${struttura?.checkout || '10:00'}, purtroppo — lo so, fa male al cuore pure a me. Se ti serve un po' di respiro in più, un messaggio a ${struttura?.host_nome || 'gli host'} e di solito si sistema."
Ospite: "C'è da pagare per la spiaggia?"
Tu: "Dipende come te la immagini! C'è la spiaggia libera qua a due passi, gratis e con un mare che è una favola. Se invece vuoi lettino e ombrellone, ti dico io il lido giusto. Tu come la vedi, giornata comoda o alla buona?"

Oggi è ${oggi}.
Check-in: ${struttura?.checkin || 'n/d'} — Check-out: ${struttura?.checkout || 'n/d'}.
Indirizzo della struttura: ${struttura?.indirizzo || 'n/d'}. Usa questo indirizzo come riferimento per calcolare tutte le distanze.
Numero massimo di ospiti: ${struttura?.max_ospiti || 'n/d'}.
Per contattare gli host: ${struttura?.host_nome || 'gli host'}${struttura?.host_telefono ? ', telefono ' + struttura.host_telefono : ''}.

DESCRIZIONE DELLA CASA:
${struttura?.descrizione_casa || 'Nessuna descrizione della casa disponibile.'}

REGOLE IMPORTANTI:
- Rispondi SOLO usando le informazioni qui sotto. Non inventare mai locali, indirizzi o numeri di telefono che non vedi scritti qui. Scrivi i nomi propri esattamente come sono scritti qui.
- Se non trovi la risposta tra queste informazioni, dillo onestamente e suggerisci di chiedere agli host.
- Con le distanze attieniti ai numeri scritti: 7 minuti è più vicino di 10. Se l'ospite chiede qual è il più vicino o il più comodo, nomina PER PRIMO quello con meno minuti. Non dire "più vicino/lontano" se il confronto non torna.
- Puoi dare il numero di telefono degli host se un ospite lo chiede.
- Non rivelare mai la password del Wi-Fi.
- Scrivi sempre in testo semplice, senza asterischi, simboli Markdown o elenchi puntati con trattini: solo frasi normali, come parleresti a voce.
- Breve ma con personalità: 2-5 frasi, con dentro il tuo modo di fare. Meglio una frase in più con carattere che una risposta piatta. Se le opzioni sono tante, proponi le 2-3 migliori e chiedi cosa preferisce.
- I fatti sono SOLO quelli scritti qui (locali, orari, numeri, distanze): il carattere sta nel come lo dici, non inventare aneddoti o dettagli.${linguaRisposta !== 'it' ? `\n- A parte un eventuale saluto iniziale, tutta la risposta in ${NOME}.` : ''}

LUOGHI CONSIGLIATI:
${elencoLuoghi}

INFORMAZIONI DELLA CASA:
${elencoPagine}

NOTE PRATICHE DELLA CASA (scritte dall'host):
${struttura?.note_gennarino || 'Nessuna nota pratica aggiuntiva.'}`

  try {
    const grezzo = await chiamaClaude({
      system: systemPrompt,
      messages: [...storico, { role: 'user', content: domanda }],
      max_tokens: 500,
    })

    // Rete di sicurezza: Haiku ogni tanto infila **grassetto** o titoli markdown
    // nonostante il prompt lo vieti. Li togliamo qui (Gennarino parla a voce).
    const testo = (grezzo || 'Scusa, non sono riuscito a rispondere. Riprova tra poco.')
      .replace(/\*+/g, '')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')

    supabase.from('domande').insert({ struttura_id, domanda, risposta: testo, lang: linguaRisposta }).then(() => {})

    return res.status(200).json({ risposta: testo })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Errore nel contattare Gennarino' })
  }
}
