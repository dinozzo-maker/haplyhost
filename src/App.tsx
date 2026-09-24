import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Struttura from './Struttura'
import Home from './Home'
import { useSezioni } from './useSezioni'

// Le schermate che non servono alla prima apertura della guida vengono caricate
// solo quando l'utente ci entra: la Home ospiti non deve portarsi dietro tutto
// il pannello host e la chat AI.
const SezionePage = lazy(() => import('./SezionePage'))
const PaginaStatica = lazy(() => import('./PaginaStatica'))
const Gennarino = lazy(() => import('./Gennarino'))
const Privacy = lazy(() => import('./PaginaPrivacy'))
const Presentazione = lazy(() => import('./Presentazione'))
const Login = lazy(() => import('./admin/Login'))
const RichiedeLogin = lazy(() => import('./admin/RichiedeLogin'))
const AdminShell = lazy(() => import('./admin/AdminShell'))
const PiattaformaShell = lazy(() => import('./admin/PiattaformaShell'))
const PiattaformaHome = lazy(() => import('./admin/PiattaformaHome'))
const Admin = lazy(() => import('./admin/Admin'))
const CreaStruttura = lazy(() => import('./admin/CreaStruttura'))
const ConfiguraGuida = lazy(() => import('./admin/ConfiguraGuida'))
const ModificaCasa = lazy(() => import('./admin/ModificaCasa'))
const Soggiorni = lazy(() => import('./admin/Soggiorni'))
const NoteGennarino = lazy(() => import('./admin/NoteGennarino'))
const DomandeOspiti = lazy(() => import('./admin/DomandeOspiti'))
const StatisticheDomande = lazy(() => import('./admin/StatisticheDomande'))
const TraduciGuida = lazy(() => import('./admin/TraduciGuida'))
const SezioniGuida = lazy(() => import('./admin/SezioniGuida'))
const SezioniExtra = lazy(() => import('./admin/SezioniExtra'))
const InvitaHost = lazy(() => import('./admin/InvitaHost'))
const ConsumiAI = lazy(() => import('./admin/ConsumiAI'))
const GestisciSezione = lazy(() => import('./admin/GestisciSezione'))
const GestisciPagina = lazy(() => import('./admin/GestisciPagina'))

function App() {
  const { tutte: SEZIONI, caricamento } = useSezioni()

  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-slate-500">Caricamento...</p>}>
      <Routes>
      {/* Pagina di presentazione di Haplyhost per i proprietari (non è una guida ospiti) */}
      <Route path="/" element={<Presentazione />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<RichiedeLogin />}>
        <Route element={<AdminShell />}>
          <Route index element={<Admin />} />
          <Route path="nuova-struttura" element={<CreaStruttura aggiuntiva />} />
          <Route path="configurazione" element={<ConfiguraGuida />} />
          <Route path="modifica-casa" element={<ModificaCasa />} />
          <Route path="soggiorni" element={<Soggiorni />} />
          <Route path="note" element={<NoteGennarino />} />
          <Route path="domande" element={<DomandeOspiti />} />
          <Route path="statistiche" element={<StatisticheDomande />} />
          <Route path="traduzioni" element={<TraduciGuida />} />
          <Route path="sezioni-guida" element={<SezioniGuida />} />
          {SEZIONI.filter((s) => s.tipo === 'elenco').map((s) => (
            <Route key={s.chiave} path={s.chiave} element={<GestisciSezione sezione={s.chiave} etichetta={s.etichetta} />} />
          ))}
          {SEZIONI.filter((s) => s.tipo === 'testo').map((s) => (
            <Route key={s.chiave} path={s.chiave} element={<GestisciPagina chiave={s.chiave} etichetta={s.etichetta} />} />
          ))}
          {/* URL /admin sconosciuto: resta nel pannello. Se le sezioni custom stanno
              ancora caricando, aspetta; poi o la rotta compare, o si torna al pannello. */}
          <Route
            path="*"
            element={caricamento ? <p className="p-8 text-center">Caricamento...</p> : <Navigate to="/admin" replace />}
          />
        </Route>
        {/* Area piattaforma (22/09/2026): shell e navigazione proprie (PiattaformaShell.tsx),
            separate da quelle di una singola struttura — vedi CLAUDE.md. */}
        <Route path="piattaforma" element={<PiattaformaShell />}>
          <Route index element={<PiattaformaHome />} />
          <Route path="invita-host" element={<InvitaHost />} />
          <Route path="sezioni-extra" element={<SezioniExtra />} />
          <Route path="consumi-ai" element={<ConsumiAI />} />
        </Route>
      </Route>
      <Route path="/:slug" element={<Struttura />}>
        <Route index element={<Home />} />
        <Route path="privacy" element={<Privacy />} />
        {SEZIONI.filter((s) => s.tipo === 'testo').map((s) => (
          <Route key={s.chiave} path={s.chiave} element={<PaginaStatica chiave={s.chiave} />} />
        ))}
        {SEZIONI.filter((s) => s.tipo === 'chat').map((s) => (
          <Route key={s.chiave} path={s.chiave} element={<Gennarino />} />
        ))}
        <Route path=":sezione" element={<SezionePage />} />
      </Route>
      </Routes>
    </Suspense>
  )
}

export default App
