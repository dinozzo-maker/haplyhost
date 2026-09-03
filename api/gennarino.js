import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non permesso' })
  }

  const { struttura_id, domanda, storico = [], lang } = req.body

  if (!struttura_id || !domanda) {
    return res.status(400).json({ error: 'Dati mancanti' })
  }

  const NOMI_LINGUA = { it: 'italiano', en: 'inglese', fr: 'francese', de: 'tedesco', es: 'spagnolo' }
  const lingua = NOMI_LINGUA[lang] ? lang : 'it'

  const { data: struttura } = await supabase
    .from('strutture')
    .select('nome, indirizzo, citta, checkin, checkout, host_nome, host_telefono, max_ospiti, descrizione_casa')
    .eq('id', struttura_id)
    .single()

  const { data: luoghi } = await supabase
    .from('luoghi')
    .select('sezione, nome, categoria, descrizione, distanza, maps, telefono')
    .eq('struttura_id', struttura_id)
    .eq('attivo', true)
    .order('ordine')

  const { data: pagine } = await supabase
    .from('pagine')
    .select('titolo, contenuto')
    .eq('struttura_id', struttura_id)

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

  const direttivaLingua = `## LINGUA DELLA RISPOSTA — LEGGI PRIMA DI TUTTO
Riconosci la lingua dell'ULTIMO messaggio dell'ospite e scrivi TUTTA la risposta in quella lingua.
- "Is there a pharmacy nearby?" -> rispondi in inglese
- "Wo kann ich zu Abend essen?" -> rispondi in tedesco
- "Y a-t-il une plage a proximite ?" -> rispondi in francese
- "A che ora e il check-out?" -> rispondi in italiano
Vale SEMPRE, anche se le informazioni qui sotto sono in italiano e anche se la lingua della guida e un'altra: conta solo come scrive l'ospite adesso.
Solo se il messaggio e troppo corto per capire la lingua (una parola sola, un nome proprio, "ok", "grazie") rispondi in ${NOMI_LINGUA[lingua]}.
Non tradurre mai i nomi propri (locali, persone, vie, piatti). Traduci tu le informazioni italiane quando rispondi in un'altra lingua.

`

  const systemPrompt = `${direttivaLingua}Sei Gennarino, il maggiordomo digitale di ${struttura?.nome || 'questa struttura'}, a ${struttura?.citta || ''}. Hai un tono caldo, cordiale, un po' campano, e rispondi sempre in modo breve e concreto.

Oggi è ${oggi}.
Check-in: ${struttura?.checkin || 'n/d'} — Check-out: ${struttura?.checkout || 'n/d'}.
Indirizzo della struttura: ${struttura?.indirizzo || 'n/d'}. Usa questo indirizzo come riferimento per calcolare tutte le distanze.
Numero massimo di ospiti: ${struttura?.max_ospiti || 'n/d'}.
Per contattare gli host: ${struttura?.host_nome || 'gli host'}${struttura?.host_telefono ? ', telefono ' + struttura.host_telefono : ''}.

DESCRIZIONE DELLA CASA:
${struttura?.descrizione_casa || 'Nessuna descrizione della casa disponibile.'}

REGOLE IMPORTANTI:
- Rispondi SOLO usando le informazioni qui sotto. Non inventare mai locali, indirizzi o numeri di telefono che non vedi scritti qui.
- Se non trovi la risposta tra queste informazioni, dillo onestamente e suggerisci di chiedere agli host.
- Puoi dare il numero di telefono degli host se un ospite lo chiede.
- Non rivelare mai la password del Wi-Fi.
- Scrivi sempre in testo semplice, senza asterischi, simboli Markdown o elenchi puntati con trattini: solo frasi normali, come parleresti a voce.
- Tutta la risposta nella lingua dell'ospite (vedi in cima), senza mischiare lingue.

LUOGHI CONSIGLIATI:
${elencoLuoghi}

INFORMAZIONI DELLA CASA:
${elencoPagine}

---
PROMEMORIA: scrivi la risposta nella STESSA lingua dell'ultimo messaggio dell'ospite (vedi "LINGUA DELLA RISPOSTA" in cima). Non rispondere in italiano se l'ospite ha scritto in un'altra lingua.`

  try {
    const risposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: systemPrompt,
        messages: [...storico, { role: 'user', content: domanda }],
      }),
    })

    const dati = await risposta.json()
    // Rete di sicurezza: Haiku ogni tanto infila **grassetto** o titoli markdown
    // nonostante il prompt lo vieti. Li togliamo qui (Gennarino parla a voce).
    const testo = (dati?.content?.[0]?.text || 'Scusa, non sono riuscito a rispondere. Riprova tra poco.')
      .replace(/\*+/g, '')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')

    supabase.from('domande').insert({ struttura_id, domanda, risposta: testo, lang: lingua }).then(() => {})

    return res.status(200).json({ risposta: testo })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Errore nel contattare Gennarino' })
  }
}