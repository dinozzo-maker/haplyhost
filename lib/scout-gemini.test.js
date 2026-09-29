import test from 'node:test'
import assert from 'node:assert/strict'

// Endpoint completo con Gemini, database e Geoapify simulati. La forma della risposta Gemini è
// quella VERA (verificata il 29/09/2026 con una chiamata reale, dopo lo sblocco della quota): la
// nuova API "interactions" NON restituisce più le annotazioni url_citation/place_citation che
// prima confermavano i link scritti dal modello — i link restano solo dentro il testo JSON.
// Il test verifica: (1) un solo tool inviato a Google (mai google_maps + google_search insieme,
// causa di un 400 scoperto lo stesso giorno), (2) un link in formato Google Maps/grounding-redirect
// viene accettato, (3) un link fuori da quel formato viene scartato, (4) i duplicati restano bloccati.
test('Gemini senza annotazioni: si fida solo dei link nel formato Google, un solo tool per richiesta', async () => {
  const chiavi = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_GEOAPIFY_API_KEY',
    'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'EXA_API_KEY']
  const precedenti = Object.fromEntries(chiavi.map(chiave => [chiave, process.env[chiave]]))
  const fetchOriginale = globalThis.fetch
  const salvate = []
  const richiesteGemini = []
  const struttura = { id: 'struttura-test', owner_user_id: 'host-test', lat: 40.4057, lng: 14.996 }
  const json = (dati, stato = 200) => new Response(JSON.stringify(dati), { status: stato, headers: { 'content-type': 'application/json' } })

  // Struttura reale di una risposta "interactions": niente annotazioni, i link stanno nel testo.
  const rispostaGemini = (candidati) => ({
    steps: [
      { type: 'google_maps_call' },
      { type: 'google_maps_result' },
      { type: 'thought' },
      { type: 'model_output', content: [{ type: 'text', text: JSON.stringify(candidati) }] },
    ],
    usage: {},
  })
  const geocode = (lat, lon) => ({ features: [{ properties: { lat, lon, country_code: 'it', result_type: 'building' } }] })

  try {
    chiavi.forEach(chiave => { delete process.env[chiave] })
    process.env.VITE_SUPABASE_URL = 'https://database.test'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'chiave-test'
    process.env.VITE_GEOAPIFY_API_KEY = 'chiave-test'
    process.env.GEMINI_API_KEY = 'chiave-test'

    let candidatiDaRestituire = []
    globalThis.fetch = async (risorsa, opzioni = {}) => {
      const url = new URL(String(risorsa))
      if (url.hostname === 'database.test') {
        if (url.pathname === '/auth/v1/user') return json({ id: 'host-test' })
        if (url.pathname.endsWith('/strutture')) return json(struttura)
        if (url.pathname.endsWith('/luoghi')) return json([])
        if (url.pathname.endsWith('/proposte')) {
          if (opzioni.method === 'POST') salvate.push(...JSON.parse(opzioni.body))
          return json([])
        }
        if (url.pathname.endsWith('/consumi_ai')) return json([])
      }
      if (url.hostname === 'generativelanguage.googleapis.com' && url.pathname === '/v1beta/interactions') {
        const corpo = JSON.parse(opzioni.body)
        richiesteGemini.push(corpo)
        return json(rispostaGemini(candidatiDaRestituire))
      }
      if (url.hostname === 'api.geoapify.com' && url.pathname === '/v1/geocode/search') {
        return json(geocode(40.42, 15.0))
      }
      throw new Error(`Richiesta di test non prevista: ${url.hostname}${url.pathname}`)
    }
    const { default: handler } = await import('../api/scout.js')
    const esegui = async () => {
      const risposta = { stato: null, corpo: null, status(s) { this.stato = s; return this }, json(c) { this.corpo = c; return this } }
      await handler({ method: 'POST', headers: { authorization: 'Bearer sessione-test' },
        body: { struttura_id: struttura.id, sezione: 'mangiare', raggio_km: 5 } }, risposta)
      return risposta
    }
    const candidato = (nome, urlFonte) => ({
      nome, indirizzo: 'Via Esempio 1, Paestum', descrizione: 'Ristorante di quartiere con cucina del territorio e ambiente informale.',
      distanza_km: 2, distanza: 'Circa 2 km', prezzo: '', voto: '', maps: '', telefono: '',
      fonti: [{ url: urlFonte, titolo: `${nome} - Google Maps`, conferma: 'Nome e indirizzo confermati', campi: ['nome', 'descrizione', 'distanza_km', 'distanza'] }],
      non_verificato: [], contraddizioni: [], domanda_host: '',
    })

    // 1) link in formato Google Maps reale: accettato e salvato
    candidatiDaRestituire = [candidato('Ristorante Meda', 'https://maps.google.com/maps?cid=15611490554332105308')]
    let r = await esegui()
    assert.equal(r.stato, 200)
    assert.equal(r.corpo.trovati, 1, JSON.stringify(r.corpo))
    assert.equal(salvate[0].nome, 'Ristorante Meda')

    // 2) link nel formato del reindirizzamento di ricerca Google: accettato
    salvate.length = 0
    candidatiDaRestituire = [candidato('Ristorante Vela', 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQabc123')]
    r = await esegui()
    assert.equal(r.corpo.trovati, 1)
    assert.equal(salvate[0].nome, 'Ristorante Vela')

    // 3) link fuori da quel formato (anche se "sembra" plausibile): SCARTATO
    salvate.length = 0
    candidatiDaRestituire = [candidato('Ristorante Inventato', 'https://blog-di-cucina.example/recensione-ristorante-inventato')]
    r = await esegui()
    assert.equal(r.corpo.trovati, 0, 'un link fuori formato non deve mai passare')
    assert.equal(salvate.length, 0)

    // 4) un dominio Google "travestito" (sotto-dominio o percorso diverso) non basta
    salvate.length = 0
    for (const urlFalso of [
      'https://vertexaisearch.cloud.google.com.evil.example/grounding-api-redirect/x',
      'https://maps.google.com.evil.example/maps?cid=1',
      'https://www.google.com/search?q=ristorante', // google.com sì, ma non è /maps
      'https://not-vertexaisearch.cloud.google.com/grounding-api-redirect/x',
    ]) {
      candidatiDaRestituire = [candidato('Ristorante Falso', urlFalso)]
      r = await esegui()
      assert.equal(r.corpo.trovati, 0, urlFalso)
    }

    // 5) un solo tool per richiesta: MAI google_maps e google_search insieme
    for (const corpo of richiesteGemini) {
      assert.equal(corpo.tools.length, 1, JSON.stringify(corpo.tools))
      assert.equal(corpo.tools[0].type, 'google_maps') // la struttura di test ha lat/lng
    }
  } finally {
    globalThis.fetch = fetchOriginale
    chiavi.forEach(chiave => { if (precedenti[chiave] === undefined) delete process.env[chiave]; else process.env[chiave] = precedenti[chiave] })
  }
})
