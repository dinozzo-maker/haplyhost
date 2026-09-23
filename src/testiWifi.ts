import type { Lingua } from './lingua'

// Testi del blocco Wi-Fi nella pagina "Casa & Wi-Fi" della guida ospiti.
type TestiWifi = {
  titolo: string
  rete: string
  password: string
  copia: string
  copiato: string
  senzaPassword: string
  senzaLink: string
  presto: (data: string) => string
  scaduto: string
  nonValido: string
  errore: string
}

export const TESTI_WIFI: Record<Lingua, TestiWifi> = {
  it: {
    titolo: 'Wi-Fi',
    rete: 'Rete',
    password: 'Password',
    copia: 'Copia',
    copiato: 'Copiato ✓',
    senzaPassword: 'Rete aperta, nessuna password',
    senzaLink: 'La password del Wi-Fi si vede con il link personale che ti ha mandato l’host per il tuo soggiorno.',
    presto: (data) => `La password del Wi-Fi comparirà qui dal giorno del check-in (${data}).`,
    scaduto: 'Il tuo soggiorno è terminato: la password del Wi-Fi non è più mostrata.',
    nonValido: 'Questo link non è valido. Chiedi all’host di rimandartelo.',
    errore: 'Non riesco a caricare il Wi-Fi. Riprova tra poco.',
  },
  en: {
    titolo: 'Wi-Fi',
    rete: 'Network',
    password: 'Password',
    copia: 'Copy',
    copiato: 'Copied ✓',
    senzaPassword: 'Open network, no password',
    senzaLink: 'The Wi-Fi password is shown with the personal link your host sent you for your stay.',
    presto: (data) => `The Wi-Fi password will appear here from your check-in day (${data}).`,
    scaduto: 'Your stay has ended: the Wi-Fi password is no longer shown.',
    nonValido: 'This link is not valid. Please ask your host to send it again.',
    errore: 'I can’t load the Wi-Fi details. Please try again shortly.',
  },
  fr: {
    titolo: 'Wi-Fi',
    rete: 'Réseau',
    password: 'Mot de passe',
    copia: 'Copier',
    copiato: 'Copié ✓',
    senzaPassword: 'Réseau ouvert, sans mot de passe',
    senzaLink: 'Le mot de passe du Wi-Fi s’affiche avec le lien personnel que votre hôte vous a envoyé pour votre séjour.',
    presto: (data) => `Le mot de passe du Wi-Fi apparaîtra ici à partir du jour d’arrivée (${data}).`,
    scaduto: 'Votre séjour est terminé : le mot de passe du Wi-Fi n’est plus affiché.',
    nonValido: 'Ce lien n’est pas valide. Demandez à votre hôte de vous le renvoyer.',
    errore: 'Impossible de charger le Wi-Fi. Réessayez dans un instant.',
  },
  de: {
    titolo: 'WLAN',
    rete: 'Netzwerk',
    password: 'Passwort',
    copia: 'Kopieren',
    copiato: 'Kopiert ✓',
    senzaPassword: 'Offenes Netz, kein Passwort',
    senzaLink: 'Das WLAN-Passwort wird mit dem persönlichen Link angezeigt, den dein Gastgeber dir für deinen Aufenthalt geschickt hat.',
    presto: (data) => `Das WLAN-Passwort erscheint hier ab dem Anreisetag (${data}).`,
    scaduto: 'Dein Aufenthalt ist beendet: Das WLAN-Passwort wird nicht mehr angezeigt.',
    nonValido: 'Dieser Link ist ungültig. Bitte bitte deinen Gastgeber, ihn erneut zu senden.',
    errore: 'Das WLAN kann gerade nicht geladen werden. Bitte versuche es gleich noch einmal.',
  },
  es: {
    titolo: 'Wi-Fi',
    rete: 'Red',
    password: 'Contraseña',
    copia: 'Copiar',
    copiato: 'Copiado ✓',
    senzaPassword: 'Red abierta, sin contraseña',
    senzaLink: 'La contraseña del Wi-Fi se muestra con el enlace personal que tu anfitrión te envió para tu estancia.',
    presto: (data) => `La contraseña del Wi-Fi aparecerá aquí desde el día de llegada (${data}).`,
    scaduto: 'Tu estancia ha terminado: la contraseña del Wi-Fi ya no se muestra.',
    nonValido: 'Este enlace no es válido. Pide a tu anfitrión que te lo envíe de nuevo.',
    errore: 'No puedo cargar el Wi-Fi. Inténtalo de nuevo en un momento.',
  },
}
