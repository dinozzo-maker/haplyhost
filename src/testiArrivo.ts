import type { Lingua } from './lingua'

// Etichette fisse del blocco «Come entrare» (BloccoArrivo.tsx). Il TESTO delle istruzioni lo scrive
// l'host e si mostra com'è: non viene tradotto (contiene codici e non va mandato a servizi esterni).
type TestiArrivo = {
  titolo: string
  presto: (data: string) => string
  nonValido: string
  errore: string
}

export const TESTI_ARRIVO: Record<Lingua, TestiArrivo> = {
  it: {
    titolo: 'Come entrare',
    presto: (data) => `Le istruzioni per entrare compariranno qui dal giorno del check-in (${data}).`,
    nonValido: 'Questo link non è valido. Chiedi all’host di rimandartelo.',
    errore: 'Non riesco a caricare le istruzioni. Riprova tra poco.',
  },
  en: {
    titolo: 'How to get in',
    presto: (data) => `The arrival instructions will appear here from your check-in day (${data}).`,
    nonValido: 'This link is not valid. Please ask your host to send it again.',
    errore: 'I can’t load the instructions. Please try again shortly.',
  },
  fr: {
    titolo: 'Comment entrer',
    presto: (data) => `Les instructions d’arrivée apparaîtront ici à partir du jour d’arrivée (${data}).`,
    nonValido: 'Ce lien n’est pas valide. Demandez à votre hôte de vous le renvoyer.',
    errore: 'Impossible de charger les instructions. Réessayez dans un instant.',
  },
  de: {
    titolo: 'So kommst du rein',
    presto: (data) => `Die Anreiseinformationen erscheinen hier ab dem Anreisetag (${data}).`,
    nonValido: 'Dieser Link ist ungültig. Bitte bitte deinen Gastgeber, ihn erneut zu senden.',
    errore: 'Die Informationen können gerade nicht geladen werden. Bitte versuche es gleich noch einmal.',
  },
  es: {
    titolo: 'Cómo entrar',
    presto: (data) => `Las instrucciones de llegada aparecerán aquí desde el día de llegada (${data}).`,
    nonValido: 'Este enlace no es válido. Pide a tu anfitrión que te lo envíe de nuevo.',
    errore: 'No puedo cargar las instrucciones. Inténtalo de nuevo en un momento.',
  },
}
