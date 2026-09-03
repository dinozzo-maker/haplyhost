import { Routes, Route, Navigate } from 'react-router-dom'
import Struttura from './Struttura'
import Home from './Home'
import SezionePage from './SezionePage'
import PaginaStatica from './PaginaStatica'
import Gennarino from './Gennarino'
import Login from './admin/Login'
import RichiedeLogin from './admin/RichiedeLogin'
import Admin from './admin/Admin'
import ModificaCasa from './admin/ModificaCasa'
import NoteGennarino from './admin/NoteGennarino'
import DomandeOspiti from './admin/DomandeOspiti'
import TraduciGuida from './admin/TraduciGuida'
import SezioniGuida from './admin/SezioniGuida'
import SezioniExtra from './admin/SezioniExtra'
import InvitaHost from './admin/InvitaHost'
import GestisciSezione from './admin/GestisciSezione'
import GestisciPagina from './admin/GestisciPagina'
import { useSezioni } from './useSezioni'

function App() {
  const { tutte: SEZIONI, caricamento } = useSezioni()

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<RichiedeLogin />}>
        <Route index element={<Admin />} />
        <Route path="modifica-casa" element={<ModificaCasa />} />
        <Route path="note" element={<NoteGennarino />} />
        <Route path="domande" element={<DomandeOspiti />} />
        <Route path="traduzioni" element={<TraduciGuida />} />
        <Route path="sezioni-guida" element={<SezioniGuida />} />
        <Route path="sezioni-extra" element={<SezioniExtra />} />
        <Route path="invita-host" element={<InvitaHost />} />
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
      <Route path="/:slug" element={<Struttura />}>
        <Route index element={<Home />} />
        {SEZIONI.filter((s) => s.tipo === 'testo').map((s) => (
          <Route key={s.chiave} path={s.chiave} element={<PaginaStatica chiave={s.chiave} />} />
        ))}
        {SEZIONI.filter((s) => s.tipo === 'chat').map((s) => (
          <Route key={s.chiave} path={s.chiave} element={<Gennarino />} />
        ))}
        <Route path=":sezione" element={<SezionePage />} />
      </Route>
    </Routes>
  )
}

export default App
