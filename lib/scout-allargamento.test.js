import test from 'node:test'
import assert from 'node:assert/strict'

// Endpoint completo di Scout, ricerca Geoapify (nessuna AI: sono simulati database, Geoapify ed Exa).
// Si verifica il tetto di 10 luoghi, gli allargamenti per le case isolate e le protezioni sui costi.
const NOMI = ['Alba', 'Borgo', 'Cascina', 'Dolomia', 'Eremo', 'Fienile', 'Gelso', 'Ginestra', 'Ilex', 'Ligustro', 'Mirto', 'Noce']
const URL_FONTE = 'https://guida.example/menu'

test('Scout: tetto di 10 luoghi, allargamenti controllati dal database, valori strani rifiutati', async () => {
  const chiavi = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_GEOAPIFY_API_KEY',
    'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'EXA_API_KEY']
  const precedenti = Object.fromEntries(chiavi.map(chiave => [chiave, process.env[chiave]]))
  const fetchOriginale = globalThis.fetch
  const json = (dati, stato = 200) => new Response(JSON.stringify(dati), { status: stato, headers: { 'content-type': 'application/json' } })
  const struttura = { id: 'struttura-test', owner_user_id: 'host-test', lat: 40, lng: 14 }
  let salvate = []
  let chiamateRpc = []
  let ricercheGeoapify = 0
  let richiesteExa = []
  let aggiornamentiStato = 0
  let allargamentoConsentito = true
  try {
    chiavi.forEach(chiave => { delete process.env[chiave] })
    process.env.VITE_SUPABASE_URL = 'https://database.test'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'chiave-test'
    process.env.VITE_GEOAPIFY_API_KEY = 'chiave-test'
    process.env.EXA_API_KEY = 'chiave-test'
    globalThis.fetch = async (risorsa, opzioni = {}) => {
      const url = new URL(String(risorsa))
      if (url.hostname === 'database.test') {
        if (url.pathname === '/auth/v1/user') return json({ id: 'host-test' })
        if (url.pathname.includes('/rpc/')) {
          const nome = url.pathname.split('/rpc/')[1]
          chiamateRpc.push(nome)
          return json(nome === 'prenota_allargamento_configurazione' ? allargamentoConsentito : true)
        }
        if (url.pathname.endsWith('/ricerche_configurazione')) { aggiornamentiStato++; return json([]) }
        if (url.pathname.endsWith('/strutture')) return json(struttura)
        if (url.pathname.endsWith('/luoghi')) return json([])
        if (url.pathname.endsWith('/proposte')) {
          if (opzioni.method === 'POST') salvate.push(...JSON.parse(opzioni.body))
          return json([])
        }
        if (url.pathname.endsWith('/consumi_ai')) return json([])
      }
      if (url.hostname === 'api.geoapify.com' && url.pathname === '/v2/places') {
        ricercheGeoapify++
        // 12 locali a distanze crescenti (circa 0,4 km l'uno dall'altro), tutti entro 5 km
        return json({ features: NOMI.map((nome, i) => ({ properties: { name: nome, lat: 40 + 0.004 * (i + 1), lon: 14, city: 'Paestum',
          formatted: `Via ${nome} 1, Paestum`, place_id: `id-${nome}`, categories: ['catering.restaurant'] } })) })
      }
      if (url.hostname === 'api.geoapify.com' && url.pathname === '/v2/place-details') return json({}, 404)
      if (url.hostname === 'api.exa.ai' && url.pathname === '/answer') {
        const corpo = JSON.parse(opzioni.body)
        richiesteExa.push(corpo)
        const quanti = corpo.outputSchema.properties.descrizioni.maxItems
        return json({
          answer: { descrizioni: Array.from({ length: quanti }, (_, indice) => ({ indice, fonti: [URL_FONTE],
            descrizione: 'Locale della zona con cucina del territorio, ambiente semplice e curato: la fonte ufficiale ne conferma nome, sede e proposta.' })) },
          citations: [{ url: URL_FONTE, title: NOMI.join(' | '), text: NOMI.join(' ') }],
        })
      }
      throw new Error(`Richiesta di test non prevista: ${url.hostname}${url.pathname}`)
    }
    const { default: handler } = await import('../api/scout.js')
    const esegui = async (body) => {
      salvate = []; chiamateRpc = []; ricercheGeoapify = 0; richiesteExa = []; aggiornamentiStato = 0
      const risposta = { stato: null, corpo: null, status(s) { this.stato = s; return this }, json(c) { this.corpo = c; return this } }
      await handler({ method: 'POST', headers: { authorization: 'Bearer sessione-test' },
        body: { struttura_id: struttura.id, sezione: 'mangiare', raggio_km: 5, ...body } }, risposta)
      return risposta
    }

    // ricerca manuale (senza limite): come prima, al massimo 5
    let r = await esegui({})
    assert.equal(r.stato, 200)
    assert.equal(r.corpo.trovati, 5)
    assert.equal(salvate.length, 5)

    // primo giro del wizard con limite 10: fino a 10, e la richiesta a Exa ne chiede 10 (non più 5)
    r = await esegui({ configurazione: true, limite: 10 })
    assert.equal(r.stato, 200)
    assert.equal(r.corpo.trovati, 10)
    assert.equal(salvate.length, 10)
    assert.equal(richiesteExa[0].outputSchema.properties.descrizioni.maxItems, 10, 'Exa deve poter descrivere tutti i 10')
    assert.deepEqual(chiamateRpc, ['prenota_ricerca_configurazione'])
    assert.equal(aggiornamentiStato, 1, 'la sezione viene segnata completata')
    assert.equal(r.corpo.raggio_km, 5)

    // il limite non può superare 10 né essere strano: si ripiega su 5
    for (const limite of [11, 99, 0, -1, 'molti']) {
      r = await esegui({ limite })
      assert.equal(r.corpo.trovati, 5, `limite ${limite}`)
    }

    // allargamento: prenota SOLO l'allargamento (non una nuova ricerca iniziale), rispetta il limite chiesto,
    // e non cambia lo stato della sezione
    r = await esegui({ configurazione: true, allargamento: true, raggio_km: 15, limite: 3 })
    assert.equal(r.stato, 200)
    assert.equal(r.corpo.trovati, 3)
    assert.equal(r.corpo.raggio_km, 15)
    assert.deepEqual(chiamateRpc, ['prenota_allargamento_configurazione'])
    assert.equal(aggiornamentiStato, 0, 'un allargamento non riscrive lo stato della ricerca iniziale')

    // il database dice no (già 2 allargamenti): nessuna ricerca, nessun costo
    allargamentoConsentito = false
    r = await esegui({ configurazione: true, allargamento: true, raggio_km: 30, limite: 5 })
    assert.equal(r.stato, 200)
    assert.equal(r.corpo.limite_allargamenti, true)
    assert.equal(r.corpo.trovati, 0)
    assert.equal(ricercheGeoapify, 0, 'oltre il tetto non deve partire nessuna ricerca')
    assert.equal(richiesteExa.length, 0)
    assert.equal(salvate.length, 0)
    allargamentoConsentito = true

    // richieste di allargamento non valide: rifiutate PRIMA di spendere
    for (const body of [
      { configurazione: true, allargamento: true, raggio_km: 150 }, // mai 150 km
      { configurazione: true, allargamento: true, raggio_km: 5 }, // non è un allargamento
      { configurazione: true, allargamento: true, raggio_km: 20 }, // raggio a piacere
      { allargamento: true, raggio_km: 15 }, // fuori dal wizard
    ]) {
      r = await esegui(body)
      assert.equal(r.stato, 400, JSON.stringify(body))
      assert.equal(ricercheGeoapify, 0)
      assert.deepEqual(chiamateRpc, [])
    }
  } finally {
    globalThis.fetch = fetchOriginale
    chiavi.forEach(chiave => { if (precedenti[chiave] === undefined) delete process.env[chiave]; else process.env[chiave] = precedenti[chiave] })
  }
})
