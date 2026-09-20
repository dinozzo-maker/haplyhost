import test from 'node:test'
import assert from 'node:assert/strict'

// Esegue l'endpoint completo, comprese esclusioni, fallback e salvataggio.
// Tutti i fornitori e il database sono simulati: nessuna richiesta esterna.
test('Geoapify non reinserisce Vaillum e non salva schede senza conferma web', async () => {
  const chiavi = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_GEOAPIFY_API_KEY',
    'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'EXA_API_KEY']
  const precedenti = Object.fromEntries(chiavi.map(chiave => [chiave, process.env[chiave]]))
  const fetchOriginale = globalThis.fetch
  const salvate = []
  const richiesteExa = []
  const struttura = { id: 'struttura-test', owner_user_id: 'host-test', lat: 40, lng: 14 }
  const proprieta = nome => ({ name: nome, lat: 40.004, lon: 14, city: 'Paestum',
    formatted: 'Via Esempio 1, Paestum', categories: ['catering.restaurant.pizza'] })
  const json = (dati, stato = 200) => new Response(JSON.stringify(dati), {
    status: stato, headers: { 'content-type': 'application/json' },
  })
  try {
    chiavi.forEach(chiave => { delete process.env[chiave] })
    process.env.VITE_SUPABASE_URL = 'https://database.test'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'chiave-test'
    process.env.VITE_GEOAPIFY_API_KEY = 'chiave-test'
    globalThis.fetch = async (risorsa, opzioni = {}) => {
      const url = new URL(String(risorsa))
      if (url.hostname === 'database.test') {
        if (url.pathname === '/auth/v1/user') return json({ id: 'host-test' })
        if (url.pathname.endsWith('/strutture')) return json(struttura)
        if (url.pathname.endsWith('/luoghi')) return json([{ nome: 'Vatillum Pizzeria Paestum' }])
        if (url.pathname.endsWith('/proposte')) {
          if (opzioni.method === 'POST') salvate.push(...JSON.parse(opzioni.body))
          return json([])
        }
        if (url.pathname.endsWith('/consumi_ai')) return json([])
      }
      if (url.hostname === 'api.geoapify.com' && url.pathname === '/v2/places') {
        return json({ features: ['Vaillum', 'Las Vegas'].map(nome => ({ properties: proprieta(nome) })) })
      }
      if (url.hostname === 'api.exa.ai' && url.pathname === '/answer') {
        richiesteExa.push(JSON.parse(opzioni.body))
        return json({ answer: { descrizioni: [{ indice: 0,
          descrizione: 'Pizzeria a Paestum con pizze classiche e proposte stagionali: il menu ufficiale presenta anche una selezione di fritti.',
          fonti: ['https://lasvegas.example/menu'],
        }] }, citations: [{ url: 'https://lasvegas.example/menu', title: 'Las Vegas | Menu ufficiale' }] })
      }
      throw new Error(`Richiesta di test non prevista: ${url.hostname}${url.pathname}`)
    }
    const { default: handler } = await import('../api/scout.js')
    const esegui = async () => {
      const risposta = { stato: null, corpo: null,
        status(stato) { this.stato = stato; return this },
        json(corpo) { this.corpo = corpo; return this },
      }
      await handler({ method: 'POST', headers: { authorization: 'Bearer sessione-test' },
        body: { struttura_id: struttura.id, sezione: 'mangiare', raggio_km: 1 } }, risposta)
      assert.equal(risposta.stato, 200)
      return risposta.corpo
    }
    assert.equal((await esegui()).trovati, 0)
    assert.equal(salvate.length, 0)
    process.env.EXA_API_KEY = 'chiave-test'
    assert.equal((await esegui()).trovati, 1)
    assert.deepEqual(salvate.map(proposta => proposta.nome), ['Las Vegas'])
    assert.equal(richiesteExa.length, 1)
    assert.ok(!richiesteExa[0].query.includes('Vaillum'))
  } finally {
    globalThis.fetch = fetchOriginale
    chiavi.forEach(chiave => {
      if (precedenti[chiave] === undefined) delete process.env[chiave]
      else process.env[chiave] = precedenti[chiave]
    })
  }
})
