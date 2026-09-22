import type { Lingua } from './lingua'

type TestiPrivacy = { titolo: string; avviso: string; breve: string; sezioni: { titolo: string; testo: string }[] }

// Bozza descrittiva del comportamento verificato nel codice. Prima della
// pubblicazione completare titolare, contatti, basi giuridiche e trasferimenti.
export const PRIVACY: Record<Lingua, TestiPrivacy> = {
  it: {
    titolo: 'Privacy e Gennarino',
    avviso: 'Bozza da completare: questa pagina descrive il funzionamento del servizio. L’informativa completa richiede ancora i dati del titolare, i contatti privacy, le basi giuridiche e le informazioni sui trasferimenti.',
    breve: 'I messaggi sono inviati a Google Gemini e possono essere consultati dall’host dopo un filtro automatico dei recapiti. Non inserire dati personali o sensibili.',
    sezioni: [
      { titolo: 'La chat è facoltativa', testo: 'Puoi consultare la guida senza usare Gennarino e senza creare un account ospite. La chat serve a rispondere alle domande sulla struttura e sui luoghi consigliati.' },
      { titolo: 'Come viene generata la risposta', testo: 'La domanda e una parte della conversazione precedente vengono inviate a Google Gemini insieme alle informazioni della struttura. Questo invio avviene prima del filtro usato per il registro dell’host. Evita nomi, recapiti, documenti, codici di prenotazione, dati sanitari e altre informazioni riservate.' },
      { titolo: 'Cosa può leggere l’host', testo: 'Per migliorare la guida, HaplyHost conserva domanda, risposta, lingua, data e struttura. Un filtro tenta di rimuovere email, telefoni, link e alcuni codici di prenotazione prima del salvataggio. Non riconosce ogni dato personale: i testi non sono garantiti anonimi. Il registro è consultabile dall’host della struttura; personale autorizzato della piattaforma può accedervi per la gestione del servizio.' },
      { titolo: 'Tempi e statistiche', testo: 'È prevista una pulizia giornaliera dei testi più vecchi di 90 giorni; l’effettiva cancellazione dipende dalla corretta esecuzione del processo. L’host può eliminarli prima. Restano conteggi per giorno, lingua e struttura, senza testi né identificativi dell’ospite e senza una scadenza automatica attualmente configurata.' },
      { titolo: 'Sul tuo dispositivo', testo: 'La lingua scelta resta nella memoria locale del browser. La chat resta nella memoria della sessione della scheda: alcuni browser possono recuperarla ripristinando la sessione. Su dispositivi condivisi cancella i dati del sito quando termini. La versione installabile conserva una pagina di avviso offline; la chat richiede Internet.' },
      { titolo: 'Servizi esterni', testo: 'Vercel ospita l’app, Supabase conserva i dati e Google Gemini genera le risposte. Il browser contatta anche Google Fonts, Open-Meteo per il meteo della struttura e i siti che forniscono le immagini. Questi servizi ricevono i dati tecnici necessari alla connessione, come l’indirizzo IP. Aprendo Maps o WhatsApp passi ai rispettivi servizi, con le loro condizioni privacy.' },
    ],
  },
  en: {
    titolo: 'Privacy and Gennarino',
    avviso: 'Draft: this page describes how the service works. Controller details, privacy contacts, legal bases and international transfer information still need to be completed.',
    breve: 'Messages are sent to Google Gemini and may be read by your host after automatic contact-detail filtering. Do not enter personal or sensitive information.',
    sezioni: [
      { titolo: 'Chat is optional', testo: 'You can browse the guide without using Gennarino or creating a guest account. The chat answers questions about the property and recommended places.' },
      { titolo: 'Generating replies', testo: 'Your question and part of the previous conversation are sent to Google Gemini with property information, before the filtering used for the host’s records. Avoid names, contact details, documents, booking codes, health data and other private information.' },
      { titolo: 'What your host can read', testo: 'To improve the guide, HaplyHost stores the question, reply, language, date and property. A filter attempts to remove emails, phone numbers, links and some booking codes before storage. It cannot detect all personal data: texts are not guaranteed anonymous. The property host can read these records; authorised platform staff may access them to operate the service.' },
      { titolo: 'Retention and statistics', testo: 'A daily process is scheduled to delete texts older than 90 days; deletion depends on that process running successfully. The host can delete them earlier. Counts by day, language and property remain without message text or guest identifiers. These counts currently have no automatic expiry.' },
      { titolo: 'On your device', testo: 'Your language preference is saved in browser storage. Chat history is kept in the tab’s session storage; some browsers may recover it when restoring a session. Clear site data after using a shared device. The installable app caches an offline notice; chatting requires Internet access.' },
      { titolo: 'External services', testo: 'Vercel hosts the app, Supabase stores data and Google Gemini generates replies. Your browser also contacts Google Fonts, Open-Meteo for property weather and image providers. These services receive connection data such as your IP address. Maps and WhatsApp links open separate services governed by their privacy terms.' },
    ],
  },
  fr: {
    titolo: 'Confidentialité et Gennarino',
    avviso: 'Brouillon : les coordonnées du responsable, le contact confidentialité, les bases juridiques et les informations sur les transferts restent à compléter.',
    breve: 'Les messages sont envoyés à Google Gemini et peuvent être lus par votre hôte après filtrage automatique des coordonnées. Ne saisissez pas de données personnelles ou sensibles.',
    sezioni: [
      { titolo: 'Chat facultatif', testo: 'Vous pouvez consulter le guide sans chat et sans compte. Gennarino répond aux questions sur le logement et les lieux recommandés.' },
      { titolo: 'Réponses et enregistrement', testo: 'Votre question et une partie de la conversation sont envoyées à Google Gemini avec les informations du logement avant le filtrage. Pour améliorer le guide, la question, la réponse, la langue, la date et le logement sont enregistrés. Un filtre tente de retirer emails, téléphones, liens et certains codes de réservation. Les textes ne sont pas garantis anonymes. L’hôte et le personnel autorisé de la plateforme peuvent y accéder pour gérer le service. Évitez noms, documents et informations confidentielles ou médicales.' },
      { titolo: 'Durée et statistiques', testo: 'Une suppression quotidienne des textes de plus de 90 jours est prévue et dépend de la bonne exécution du traitement. L’hôte peut les supprimer avant. Les compteurs par jour, langue et logement, sans texte ni identifiant de voyageur, restent sans expiration automatique actuellement configurée.' },
      { titolo: 'Appareil et prestataires', testo: 'La langue reste dans le navigateur et la conversation dans la session de l’onglet, parfois restaurable par le navigateur. Sur un appareil partagé, effacez les données du site après usage. L’app installée conserve un avis hors ligne ; le chat nécessite Internet. Vercel héberge l’app, Supabase conserve les données, Google Gemini répond. Google Fonts, Open-Meteo et les fournisseurs d’images reçoivent les données de connexion nécessaires, dont l’adresse IP. Les liens Maps et WhatsApp ouvrent leurs propres services.' },
    ],
  },
  de: {
    titolo: 'Datenschutz und Gennarino',
    avviso: 'Entwurf: Angaben zum Verantwortlichen, Datenschutzkontakt, Rechtsgrundlagen und internationalen Übermittlungen müssen noch ergänzt werden.',
    breve: 'Nachrichten werden an Google Gemini gesendet und können nach automatischer Filterung von Kontaktdaten vom Gastgeber gelesen werden. Bitte keine persönlichen oder sensiblen Daten eingeben.',
    sezioni: [
      { titolo: 'Freiwilliger Chat', testo: 'Sie können den Guide ohne Chat und ohne Gastkonto nutzen. Gennarino beantwortet Fragen zur Unterkunft und zu empfohlenen Orten.' },
      { titolo: 'Antworten und Speicherung', testo: 'Ihre Frage und ein Teil des Chatverlaufs werden mit Unterkunftsinformationen vor der Filterung an Google Gemini gesendet. Zur Verbesserung des Guides werden Frage, Antwort, Sprache, Datum und Unterkunft gespeichert. Ein Filter versucht, E-Mails, Telefonnummern, Links und einige Buchungscodes zu entfernen. Die Texte sind nicht garantiert anonym. Der Gastgeber und befugte Plattformmitarbeiter können für den Betrieb darauf zugreifen. Bitte keine Namen, Dokumente, Gesundheitsdaten oder vertraulichen Informationen eingeben.' },
      { titolo: 'Aufbewahrung und Statistik', testo: 'Ein täglicher Prozess soll Texte löschen, die älter als 90 Tage sind; die Löschung hängt von der erfolgreichen Ausführung ab. Der Gastgeber kann sie früher löschen. Zähler nach Tag, Sprache und Unterkunft bleiben ohne Nachrichtentexte oder Gastkennungen bestehen; derzeit ist keine automatische Löschfrist für diese Zähler eingerichtet.' },
      { titolo: 'Gerät und Dienstleister', testo: 'Die Sprache wird im Browser gespeichert, der Chat in der Sitzung des Tabs. Einige Browser können Sitzungen wiederherstellen. Löschen Sie nach Nutzung eines gemeinsam verwendeten Geräts die Website-Daten. Die installierte App speichert einen Offline-Hinweis; der Chat benötigt Internet. Vercel hostet die App, Supabase speichert Daten und Google Gemini antwortet. Google Fonts, Open-Meteo und Bildanbieter erhalten erforderliche Verbindungsdaten wie die IP-Adresse. Maps- und WhatsApp-Links öffnen eigenständige Dienste.' },
    ],
  },
  es: {
    titolo: 'Privacidad y Gennarino',
    avviso: 'Borrador: faltan los datos del responsable, el contacto de privacidad, las bases jurídicas y la información sobre transferencias internacionales.',
    breve: 'Los mensajes se envían a Google Gemini y el anfitrión puede leerlos tras un filtro automático de datos de contacto. No introduzcas datos personales ni sensibles.',
    sezioni: [
      { titolo: 'Chat opcional', testo: 'Puedes consultar la guía sin usar el chat ni crear una cuenta. Gennarino responde preguntas sobre el alojamiento y los lugares recomendados.' },
      { titolo: 'Respuestas y registro', testo: 'Tu pregunta y parte de la conversación se envían a Google Gemini con información del alojamiento antes del filtrado. Para mejorar la guía se guardan pregunta, respuesta, idioma, fecha y alojamiento. Un filtro intenta retirar correos, teléfonos, enlaces y algunos códigos de reserva. No se garantiza que los textos sean anónimos. El anfitrión y el personal autorizado de la plataforma pueden acceder a ellos para gestionar el servicio. Evita nombres, documentos, datos médicos y otra información privada.' },
      { titolo: 'Plazos y estadísticas', testo: 'Está programada una limpieza diaria de textos de más de 90 días; su eliminación depende de que el proceso se ejecute correctamente. El anfitrión puede borrarlos antes. Los recuentos por día, idioma y alojamiento permanecen sin textos ni identificadores de huéspedes y sin caducidad automática configurada actualmente.' },
      { titolo: 'Dispositivo y proveedores', testo: 'El idioma se guarda en el navegador y la conversación en la sesión de la pestaña. Algunos navegadores pueden restaurarla. Borra los datos del sitio al terminar en un dispositivo compartido. La app instalada guarda un aviso sin conexión; el chat necesita Internet. Vercel aloja la app, Supabase guarda los datos y Google Gemini responde. Google Fonts, Open-Meteo y los proveedores de imágenes reciben datos de conexión necesarios, como la dirección IP. Los enlaces a Maps y WhatsApp abren sus propios servicios.' },
    ],
  },
}
