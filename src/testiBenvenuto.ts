import type { Lingua } from './lingua'

// Testi del benvenuto in cima alla home (Benvenuto.tsx). `data` arriva già scritta nella
// lingua dell'ospite (es. "mercoledì 25 settembre").
type TestiBenvenuto = {
  checkin: string
  checkout: string
  presto: (data: string) => string
  inCorso: (data: string) => string
  graziePerIlSoggiorno: (nome: string) => string
  graziePerIlSoggiornoSub: string
}

export const TESTI_BENVENUTO: Record<Lingua, TestiBenvenuto> = {
  it: {
    checkin: 'Check-in',
    checkout: 'Check-out',
    presto: (data) => `Ti aspettiamo ${data}.`,
    inCorso: (data) => `Buon soggiorno! Il check-out è ${data}.`,
    graziePerIlSoggiorno: (nome) => `Grazie, ${nome}!`,
    graziePerIlSoggiornoSub: 'Speriamo che il soggiorno sia stato bello. Tornate a trovarci!',
  },
  en: {
    checkin: 'Check-in',
    checkout: 'Check-out',
    presto: (data) => `We look forward to seeing you on ${data}.`,
    inCorso: (data) => `Enjoy your stay! Check-out is on ${data}.`,
    graziePerIlSoggiorno: (nome) => `Thank you, ${nome}!`,
    graziePerIlSoggiornoSub: 'We hope you enjoyed your stay. Come back soon!',
  },
  fr: {
    checkin: 'Arrivée',
    checkout: 'Départ',
    presto: (data) => `Nous vous attendons le ${data}.`,
    inCorso: (data) => `Bon séjour ! Le départ est le ${data}.`,
    graziePerIlSoggiorno: (nome) => `Merci, ${nome} !`,
    graziePerIlSoggiornoSub: 'Nous espérons que votre séjour s’est bien passé. À bientôt !',
  },
  de: {
    checkin: 'Check-in',
    checkout: 'Check-out',
    presto: (data) => `Wir erwarten dich am ${data}.`,
    inCorso: (data) => `Schönen Aufenthalt! Check-out ist am ${data}.`,
    graziePerIlSoggiorno: (nome) => `Danke, ${nome}!`,
    graziePerIlSoggiornoSub: 'Wir hoffen, dein Aufenthalt hat dir gefallen. Bis bald!',
  },
  es: {
    checkin: 'Llegada',
    checkout: 'Salida',
    presto: (data) => `Te esperamos el ${data}.`,
    inCorso: (data) => `¡Buena estancia! La salida es el ${data}.`,
    graziePerIlSoggiorno: (nome) => `¡Gracias, ${nome}!`,
    graziePerIlSoggiornoSub: 'Esperamos que hayas disfrutado de tu estancia. ¡Hasta pronto!',
  },
}
