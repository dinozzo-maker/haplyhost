import { Routes, Route } from 'react-router-dom'
import Struttura from './Struttura'
import Home from './Home'
import SezionePage from './SezionePage'

function App() {
  return (
    <Routes>
      <Route path="/:slug" element={<Struttura />}>
        <Route index element={<Home />} />
        <Route path=":sezione" element={<SezionePage />} />
      </Route>
    </Routes>
  )
}

export default App