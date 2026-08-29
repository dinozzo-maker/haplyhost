import { Routes, Route } from 'react-router-dom'
import Struttura from './Struttura'
import Home from './Home'
import SezionePage from './SezionePage'
import PaginaStatica from './PaginaStatica'
import Gennarino from './Gennarino'
import { SEZIONI } from './sezioni'

function App() {
  return (
    <Routes>
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