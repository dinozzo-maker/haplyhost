import { Routes, Route } from 'react-router-dom'
import Struttura from './Struttura'

function App() {
  return (
    <Routes>
      <Route path="/:slug" element={<Struttura />} />
    </Routes>
  )
}

export default App