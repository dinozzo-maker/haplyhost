import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Home, MessageCircle, Languages, Wifi, UserRound, MapPin, Smartphone, ExternalLink, Mail,
} from 'lucide-react'
import { EMAIL_CONTATTO, WHATSAPP_CONTATTO, SLUG_DEMO } from './contatti'

const TITOLO = 'Haplyhost — la guida digitale per la tua casa vacanze'
const DESCRIZIONE =
  'Wi-Fi, regole della casa, consigli del posto e un assistente che risponde agli ospiti nella loro lingua. Un solo link, senza app da installare.'

const OGGETTO_EMAIL = 'Vorrei vedere la guida per la mia casa'
const TESTO_EMAIL = 'Buongiorno,\nvorrei vedere come sarebbe la guida digitale per la mia struttura.\n\nNome:\nStruttura e città:\nNumero di camere o alloggi:\n'

const PASSI = [
  {
    titolo: 'Prepari la guida',
    testo: 'Inserisci nome e indirizzo: cerchiamo noi ristoranti, spiagge e luoghi da visitare nei dintorni. Tu controlli e scegli cosa tenere.',
  },
  {
    titolo: 'Mandi il link all’ospite',
    testo: 'Ogni soggiorno ha il suo link personale, da inviare su WhatsApp o per email. Non serve installare niente.',
  },
  {
    titolo: 'L’ospite trova tutto',
    testo: 'Wi-Fi, regole, consigli e risposte in pochi tocchi, dal telefono e nella sua lingua.',
  },
]

const FUNZIONI: { icona: ReactNode; titolo: string; testo: string }[] = [
  {
    icona: <MessageCircle className="w-5 h-5" />,
    titolo: 'Gennarino, l’assistente della casa',
    testo: 'Risponde alle domande degli ospiti usando le informazioni che hai inserito tu: orari, regole, dove mangiare. Nella lingua di chi scrive.',
  },
  {
    icona: <Languages className="w-5 h-5" />,
    titolo: 'Cinque lingue',
    testo: 'La guida si apre nella lingua del telefono dell’ospite: italiano, inglese, francese, tedesco e spagnolo.',
  },
  {
    icona: <Wifi className="w-5 h-5" />,
    titolo: 'Wi-Fi al momento giusto',
    testo: 'La password compare solo dal giorno del check-in a quello del check-out, con il tasto Copia. Niente più messaggi per ricordarla.',
  },
  {
    icona: <UserRound className="w-5 h-5" />,
    titolo: 'Un benvenuto personale',
    testo: 'Ogni ospite vede il proprio nome e le date del suo check-in e check-out.',
  },
  {
    icona: <MapPin className="w-5 h-5" />,
    titolo: 'I consigli del posto',
    testo: 'Ristoranti, spiagge e cose da vedere, con distanza, voto e foto. Li scegli tu: niente va online senza la tua approvazione.',
  },
  {
    icona: <Smartphone className="w-5 h-5" />,
    titolo: 'Nessuna app, nessuna registrazione',
    testo: 'Si apre da un link. Chi vuole può aggiungerla alla schermata Home come un’app.',
  },
]

const classePrimario =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 transition'
const classeSecondario =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 transition'

// Pagina di presentazione di Haplyhost (rotta "/"): per i proprietari di case vacanze, non per gli
// ospiti. Mostra la guida di una struttura vera come demo dal vivo. Niente prezzi né promesse
// commerciali finché i piani non sono decisi.
export default function Presentazione() {
  // Titolo e descrizione della scheda: solo mentre la pagina è aperta.
  useEffect(() => {
    const titoloPrecedente = document.title
    document.title = TITOLO
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const creato = !meta
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    const descrizionePrecedente = meta.content
    meta.content = DESCRIZIONE
    return () => {
      document.title = titoloPrecedente
      if (creato) meta?.remove()
      else if (meta) meta.content = descrizionePrecedente
    }
  }, [])

  const mailto = EMAIL_CONTATTO
    ? `mailto:${EMAIL_CONTATTO}?subject=${encodeURIComponent(OGGETTO_EMAIL)}&body=${encodeURIComponent(TESTO_EMAIL)}`
    : ''
  const whatsapp = WHATSAPP_CONTATTO
    ? `https://wa.me/${WHATSAPP_CONTATTO}?text=${encodeURIComponent(OGGETTO_EMAIL)}`
    : ''

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <a href="/" className="inline-flex items-center gap-2 text-base font-extrabold tracking-tight">
            <Home className="w-5 h-5 text-amber-500" aria-hidden="true" /> Haplyhost
          </a>
          <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
            <a href="#demo" className="hidden sm:inline hover:text-slate-900">La demo</a>
            <a href="#funzioni" className="hidden sm:inline hover:text-slate-900">Funzioni</a>
            <a href="#contatti" className="rounded-lg bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-800">Contattaci</a>
          </nav>
        </div>
      </header>

      <main>
        {/* Apertura */}
        <section className="mx-auto max-w-6xl px-5 pt-14 pb-10 sm:pt-20">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-wider text-amber-600">Per B&B, ville, appartamenti e gestori di più case</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-balance sm:text-5xl">
              La guida digitale per la tua casa vacanze
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">
              Wi-Fi, regole della casa, consigli su dove mangiare e cosa vedere, e un assistente che risponde
              agli ospiti nella loro lingua. Un solo link, senza app da installare.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#demo" className={classePrimario}>Guarda una guida vera <ArrowRight className="w-4 h-4" aria-hidden="true" /></a>
              <a href="#contatti" className={classeSecondario}>Richiedi una demo per la tua casa</a>
            </div>
          </div>
        </section>

        {/* Demo dal vivo */}
        <section id="demo" className="scroll-mt-16 bg-slate-50 border-y border-slate-200">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-balance">Provala: è una guida vera</h2>
              <p className="mt-4 leading-relaxed text-slate-600">
                Questa è la guida di Villa Virginia, a Paestum: quella che riceve davvero i suoi ospiti.
                Scorri le sezioni, cambia lingua, fai una domanda a Gennarino.
              </p>
              <a href={`/${SLUG_DEMO}`} target="_blank" rel="noreferrer" className={`${classeSecondario} mt-6`}>
                Aprila a schermo intero <ExternalLink className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>
            <div className="flex justify-center">
              <div className="rounded-[2.5rem] border-[10px] border-slate-900 bg-slate-900 shadow-2xl shadow-slate-900/20">
                <iframe
                  title="Guida di esempio: Villa Virginia"
                  src={`/${SLUG_DEMO}`}
                  loading="lazy"
                  className="block h-[600px] w-[290px] rounded-[1.7rem] bg-white sm:w-[330px]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Come funziona */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-3xl font-extrabold tracking-tight text-balance">Come funziona</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {PASSI.map((p, i) => (
              <li key={p.titolo} className="rounded-2xl border border-slate-200 p-6">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-sm font-extrabold text-amber-800">{i + 1}</span>
                <h3 className="mt-4 text-lg font-bold">{p.titolo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.testo}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Funzioni */}
        <section id="funzioni" className="scroll-mt-16 bg-slate-50 border-y border-slate-200">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-3xl font-extrabold tracking-tight text-balance">Cosa trovano i tuoi ospiti</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FUNZIONI.map((f) => (
                <div key={f.titolo} className="rounded-2xl border border-slate-200 bg-white p-6">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">{f.icona}</span>
                  <h3 className="mt-4 text-base font-bold">{f.titolo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.testo}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Per chi */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-extrabold tracking-tight text-balance">Una casa, un B&B o tante case</h2>
            <p className="mt-4 leading-relaxed text-slate-600">
              Un B&B con più camere ha una sola guida, e ogni ospite riceve il suo link personale.
              Gestisci più case? Ognuna ha la propria guida, tutte dallo stesso pannello.
            </p>
          </div>
        </section>

        {/* Contatti */}
        <section id="contatti" className="scroll-mt-16 bg-slate-900 text-white">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-extrabold tracking-tight text-balance">Vuoi vederla sulla tua casa?</h2>
              <p className="mt-4 leading-relaxed text-slate-300">
                Scrivici: ti mostriamo come sarebbe la guida della tua struttura, con i tuoi luoghi e le tue informazioni.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {mailto && (
                  <a href={mailto} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-900 hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition">
                    <Mail className="w-4 h-4" aria-hidden="true" /> Scrivici via email
                  </a>
                )}
                {whatsapp && (
                  <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition">
                    <MessageCircle className="w-4 h-4" aria-hidden="true" /> Scrivici su WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2 font-semibold text-slate-700">
            <Home className="w-4 h-4 text-amber-500" aria-hidden="true" /> Haplyhost
          </span>
          <Link to="/login" className="underline hover:text-slate-800">Area riservata ai proprietari</Link>
        </div>
      </footer>
    </div>
  )
}
