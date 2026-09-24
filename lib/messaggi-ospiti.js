// Messaggi pronti da copiare (WhatsApp, email) che l'host manda all'ospite nei vari momenti
// del soggiorno, col link personale già dentro. Nato perché oggi si manda UN solo messaggio, il
// giorno prima dell'arrivo, e gli ospiti usano poco la guida. Pagina: src/admin/Soggiorni.tsx.

export const MOMENTI = ['prima', 'arrivo', 'meta', 'partenza', 'dopo']
export const LINGUE_MESSAGGI = [
  { codice: 'it', etichetta: 'Italiano' },
  { codice: 'en', etichetta: 'English' },
  { codice: 'fr', etichetta: 'Français' },
  { codice: 'de', etichetta: 'Deutsch' },
  { codice: 'es', etichetta: 'Español' },
]

// Aggiunge (o toglie) giorni a una data "YYYY-MM-DD" senza passare dai fusi orari.
function giornoDopo(data, giorni) {
  const [a, m, g] = data.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1, g + giorni))
  return d.toISOString().slice(0, 10)
}

// Quale messaggio conviene mandare oggi. `oggi` = "YYYY-MM-DD" (di solito oggiInItalia()).
export function momentoConsigliato(checkin, checkout, oggi) {
  if (oggi > checkout) return 'dopo'
  if (oggi === checkin) return 'arrivo'
  if (oggi < checkin) return 'prima'
  // durante il soggiorno: negli ultimi due giorni ricorda la partenza, altrimenti a metà
  if (oggi >= giornoDopo(checkout, -1)) return 'partenza'
  return 'meta'
}

// "venerdì 25 settembre", "Friday, September 25"... nella lingua del messaggio.
function giornoLeggibile(data, lingua) {
  return new Date(`${data}T12:00:00`).toLocaleDateString(lingua, { weekday: 'long', day: 'numeric', month: 'long' })
}

// Gli orari sono testo libero scritto dall'host ("15:00", "dalle 15", "entro le 10"). In italiano
// si riporta com'è. Nelle altre lingue si ricava solo l'ora (parole italiane lì non servono):
// nessuna cifra → nessun orario nel messaggio.
function estraiOra(testo) {
  const trovato = String(testo || '').match(/(\d{1,2})(?:[:.](\d{2}))?/)
  if (!trovato) return ''
  const ore = Number(trovato[1])
  if (ore > 24) return ''
  return `${ore}:${trovato[2] || '00'}`
}

const ORARI = {
  it: { arrivo: (o) => `Check-in: ${o}.`, partenza: (o) => `Check-out: ${o}.` },
  en: { arrivo: (o) => `Check-in from ${o}.`, partenza: (o) => `Check-out by ${o}.` },
  fr: { arrivo: (o) => `Arrivée à partir de ${o}.`, partenza: (o) => `Départ avant ${o}.` },
  de: { arrivo: (o) => `Check-in ab ${o} Uhr.`, partenza: (o) => `Check-out bis ${o} Uhr.` },
  es: { arrivo: (o) => `Llegada a partir de las ${o}.`, partenza: (o) => `Salida antes de las ${o}.` },
}

const TESTI = {
  it: {
    prima: (d) => `Salve ${d.nome}, vi aspettiamo a ${d.casa} ${d.giornoArrivo}.${d.oraIn}\n\nQuesta è la guida digitale della casa: regole, consigli su dove mangiare e cosa vedere, e Gennarino, l'assistente che risponde alle vostre domande. Da lì, dal giorno dell'arrivo, potete vedere anche la password del Wi-Fi:\n${d.link}\n\nA presto!`,
    arrivo: (d) => `Buongiorno ${d.nome}, oggi vi aspettiamo!${d.oraIn}\n\nNella guida trovate le informazioni sulla casa e la password del Wi-Fi:\n${d.link}\n\nPer qualsiasi cosa scriveteci qui.`,
    meta: (d) => `Salve ${d.nome}, come procede il soggiorno? Se cercate un posto dove mangiare o qualcosa da fare nei dintorni, nella guida trovate i nostri consigli, e potete chiedere anche a Gennarino:\n${d.link}\n\nPer qualsiasi cosa siamo qui.`,
    partenza: (d) => `Salve ${d.nome}, si avvicina il giorno della partenza.${d.oraOut}\n\nNella guida trovate le informazioni utili per la partenza:\n${d.link}\n\nGrazie di aver scelto ${d.casa}, speriamo vi siate trovati bene!`,
    dopo: (d) => `Salve ${d.nome}, grazie di aver soggiornato a ${d.casa}! Speriamo sia stato un bel soggiorno. Se vi va, una breve recensione ci aiuterebbe molto. Vi aspettiamo di nuovo!`,
  },
  en: {
    prima: (d) => `Hello ${d.nome}, we look forward to welcoming you to ${d.casa} on ${d.giornoArrivo}.${d.oraIn}\n\nHere is the digital guide for the house: rules, tips on where to eat and what to see, and Gennarino, the assistant who answers your questions. From your arrival day you will also find the Wi-Fi password there:\n${d.link}\n\nSee you soon!`,
    arrivo: (d) => `Good morning ${d.nome}, we are expecting you today!${d.oraIn}\n\nIn the guide you will find the house information and the Wi-Fi password:\n${d.link}\n\nIf you need anything, just write to us here.`,
    meta: (d) => `Hello ${d.nome}, how is your stay going so far? If you are looking for a place to eat or something to do nearby, you will find our tips in the guide, and you can also ask Gennarino:\n${d.link}\n\nWe are here if you need anything.`,
    partenza: (d) => `Hello ${d.nome}, your departure is coming up.${d.oraOut}\n\nYou will find the useful information for leaving in the guide:\n${d.link}\n\nThank you for choosing ${d.casa}, we hope you had a lovely stay!`,
    dopo: (d) => `Hello ${d.nome}, thank you for staying at ${d.casa}! We hope you had a great time. If you like, a short review would help us a lot. We would love to welcome you again!`,
  },
  fr: {
    prima: (d) => `Bonjour ${d.nome}, nous vous attendons à ${d.casa} le ${d.giornoArrivo}.${d.oraIn}\n\nVoici le guide numérique de la maison : règles, conseils pour manger et visiter, et Gennarino, l'assistant qui répond à vos questions. Vous y trouverez aussi le mot de passe du Wi-Fi à partir du jour de votre arrivée :\n${d.link}\n\nÀ très bientôt !`,
    arrivo: (d) => `Bonjour ${d.nome}, nous vous attendons aujourd'hui !${d.oraIn}\n\nDans le guide, vous trouverez les informations sur la maison et le mot de passe du Wi-Fi :\n${d.link}\n\nSi vous avez besoin de quoi que ce soit, écrivez-nous ici.`,
    meta: (d) => `Bonjour ${d.nome}, comment se passe votre séjour ? Si vous cherchez où manger ou quelque chose à faire près d'ici, vous trouverez nos conseils dans le guide, et vous pouvez aussi demander à Gennarino :\n${d.link}\n\nNous sommes là si besoin.`,
    partenza: (d) => `Bonjour ${d.nome}, votre départ approche.${d.oraOut}\n\nVous trouverez les informations utiles pour partir dans le guide :\n${d.link}\n\nMerci d'avoir choisi ${d.casa}, nous espérons que votre séjour s'est bien passé !`,
    dopo: (d) => `Bonjour ${d.nome}, merci d'avoir séjourné à ${d.casa} ! Nous espérons que vous avez passé un excellent séjour. Si vous le souhaitez, un petit avis nous aiderait beaucoup. Au plaisir de vous accueillir de nouveau !`,
  },
  de: {
    prima: (d) => `Hallo ${d.nome}, wir erwarten Sie am ${d.giornoArrivo} in ${d.casa}.${d.oraIn}\n\nHier ist der digitale Leitfaden für das Haus: Regeln, Tipps zum Essen und für Ausflüge sowie Gennarino, der Assistent, der Ihre Fragen beantwortet. Dort finden Sie ab dem Anreisetag auch das WLAN-Passwort:\n${d.link}\n\nBis bald!`,
    arrivo: (d) => `Guten Morgen ${d.nome}, wir erwarten Sie heute!${d.oraIn}\n\nIm Leitfaden finden Sie die Informationen zum Haus und das WLAN-Passwort:\n${d.link}\n\nWenn Sie etwas brauchen, schreiben Sie uns einfach hier.`,
    meta: (d) => `Hallo ${d.nome}, wie gefällt Ihnen der Aufenthalt bisher? Wenn Sie ein Restaurant oder etwas zum Unternehmen in der Nähe suchen, finden Sie unsere Tipps im Leitfaden, und Sie können auch Gennarino fragen:\n${d.link}\n\nWir sind für Sie da.`,
    partenza: (d) => `Hallo ${d.nome}, die Abreise steht bevor.${d.oraOut}\n\nDie wichtigsten Informationen für die Abreise finden Sie im Leitfaden:\n${d.link}\n\nVielen Dank, dass Sie sich für ${d.casa} entschieden haben. Wir hoffen, es hat Ihnen gefallen!`,
    dopo: (d) => `Hallo ${d.nome}, vielen Dank für Ihren Aufenthalt in ${d.casa}! Wir hoffen, es hat Ihnen gut gefallen. Wenn Sie möchten, würde uns eine kurze Bewertung sehr helfen. Wir freuen uns, Sie wieder zu begrüßen!`,
  },
  es: {
    prima: (d) => `Hola ${d.nome}, les esperamos en ${d.casa} el ${d.giornoArrivo}.${d.oraIn}\n\nAquí tienen la guía digital de la casa: normas, consejos para comer y visitar, y Gennarino, el asistente que responde a sus preguntas. Allí también encontrarán la contraseña del Wi-Fi desde el día de la llegada:\n${d.link}\n\n¡Hasta pronto!`,
    arrivo: (d) => `Buenos días ${d.nome}, ¡les esperamos hoy!${d.oraIn}\n\nEn la guía encontrarán la información de la casa y la contraseña del Wi-Fi:\n${d.link}\n\nSi necesitan algo, escríbannos aquí.`,
    meta: (d) => `Hola ${d.nome}, ¿qué tal va la estancia? Si buscan dónde comer o algo que hacer por la zona, en la guía encontrarán nuestros consejos, y también pueden preguntar a Gennarino:\n${d.link}\n\nEstamos aquí para lo que necesiten.`,
    partenza: (d) => `Hola ${d.nome}, se acerca el día de la salida.${d.oraOut}\n\nEn la guía encontrarán la información útil para la salida:\n${d.link}\n\nGracias por elegir ${d.casa}, ¡esperamos que hayan disfrutado de su estancia!`,
    dopo: (d) => `Hola ${d.nome}, ¡gracias por alojarse en ${d.casa}! Esperamos que hayan pasado una estancia estupenda. Si lo desean, una breve reseña nos ayudaría mucho. ¡Será un placer recibirles de nuevo!`,
  },
}

// Costruisce il testo di un messaggio. `dati`: { nome, casa, link, checkin, checkout,
// orarioCheckin, orarioCheckout, host }. Ritorna una stringa già pronta da incollare.
export function costruisciMessaggio(momento, lingua, dati) {
  const testi = TESTI[lingua] || TESTI.it
  const modello = testi[momento]
  if (!modello) throw new Error(`Momento sconosciuto: ${momento}`)
  const lingueOrari = ORARI[lingua] || ORARI.it

  // Un orario vuoto non lascia nessuna frase: ` Check-in: 15:00.` oppure niente.
  const frase = (chiave, testoOrario) => {
    const ora = lingua === 'it' ? String(testoOrario || '').trim() : estraiOra(testoOrario)
    return ora ? ` ${lingueOrari[chiave](ora)}` : ''
  }

  const testo = modello({
    nome: String(dati.nome || '').trim(),
    casa: String(dati.casa || '').trim(),
    link: dati.link,
    giornoArrivo: giornoLeggibile(dati.checkin, lingua),
    oraIn: frase('arrivo', dati.orarioCheckin),
    oraOut: frase('partenza', dati.orarioCheckout),
  })
  const firma = String(dati.host || '').trim()
  return firma ? `${testo}\n\n${firma}` : testo
}
