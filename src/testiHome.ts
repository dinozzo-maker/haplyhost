import type { Lingua } from './lingua'

type TestiHome = { casa: string; whatsapp: string; titolo: string; sottotitolo: string; scopri: string; esplora: string; suggerimenti: string[] }
export const TESTI_HOME: Record<Lingua, TestiHome> = {
  it: { casa: 'Info casa', whatsapp: 'WhatsApp host', titolo: 'Che ti va di fare oggi?', sottotitolo: 'Ti aiuto a scegliere e a trovare le informazioni della casa.', scopri: 'Scopri il luogo', esplora: 'Esplora', suggerimenti: ['Dove mangiamo qui vicino?', 'Cosa facciamo con i bambini?', 'Come funziona il Wi-Fi?'] },
  en: { casa: 'House info', whatsapp: 'WhatsApp host', titolo: 'What would you like to do today?', sottotitolo: 'Let me help you choose and find useful house information.', scopri: 'Explore this place', esplora: 'Explore', suggerimenti: ['Where can we eat nearby?', 'What can we do with the kids?', 'How does the Wi-Fi work?'] },
  fr: { casa: 'Infos logement', whatsapp: 'WhatsApp hôte', titolo: 'Que voulez-vous faire aujourd’hui ?', sottotitolo: 'Je vous aide à choisir et à trouver les informations du logement.', scopri: 'Découvrir ce lieu', esplora: 'Explorer', suggerimenti: ['Où manger à proximité ?', 'Que faire avec les enfants ?', 'Comment fonctionne le Wi-Fi ?'] },
  de: { casa: 'Hausinfos', whatsapp: 'WhatsApp Gastgeber', titolo: 'Was möchtest du heute machen?', sottotitolo: 'Ich helfe dir bei der Auswahl und bei Fragen zur Unterkunft.', scopri: 'Ort entdecken', esplora: 'Entdecken', suggerimenti: ['Wo können wir in der Nähe essen?', 'Was können wir mit Kindern machen?', 'Wie funktioniert das WLAN?'] },
  es: { casa: 'Info de la casa', whatsapp: 'WhatsApp anfitrión', titolo: '¿Qué te apetece hacer hoy?', sottotitolo: 'Te ayudo a elegir y a encontrar información de la casa.', scopri: 'Descubre el lugar', esplora: 'Explorar', suggerimenti: ['¿Dónde comemos cerca?', '¿Qué hacemos con los niños?', '¿Cómo funciona el Wi-Fi?'] },
}
