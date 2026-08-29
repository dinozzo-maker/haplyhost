import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [inviata, setInviata] = useState(false)
  const [errore, setErrore] = useState('')

  async function invia() {
    setErrore('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/admin` },
    })
    if (error) {
      setErrore('Errore: ' + error.message)
    } else {
      setInviata(true)
    }
  }

  if (inviata) {
    return (
      <div className="max-w-sm mx-auto p-6 text-center">
        <p>Ti abbiamo mandato un link di accesso a <strong>{email}</strong>. Apri l'email e clicca sul link per entrare.</p>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">Accesso Host</h1>
      <input
        className="w-full border rounded-lg px-4 py-2 mb-3"
        type="email"
        placeholder="La tua email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button onClick={invia} className="w-full bg-blue-600 text-white rounded-lg py-2">
        Invia link di accesso
      </button>
      {errore && <p className="text-red-600 text-sm mt-3">{errore}</p>}
    </div>
  )
}