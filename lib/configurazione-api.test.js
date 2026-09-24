import test from 'node:test'
import assert from 'node:assert/strict'

test('creazione configurata: autorizzazione, manuale senza AI e ritentativo senza duplicati', async () => {
  const chiavi = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_ADMIN_EMAIL']
  const precedenti = Object.fromEntries(chiavi.map(chiave => [chiave, process.env[chiave]]))
  const fetchOriginale = globalThis.fetch
  const id = '33333333-3333-4333-8333-333333333333'
  let autorizzato = true
  let creata = false
  let creazioni = 0
  let payload
  const json = (dati, status = 200) => new Response(JSON.stringify(dati), { status, headers: { 'content-type': 'application/json' } })
  try {
    process.env.VITE_SUPABASE_URL = 'https://database.test'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test'
    process.env.VITE_ADMIN_EMAIL = 'admin@example.test'
    globalThis.fetch = async (risorsa, opzioni = {}) => {
      const url = new URL(String(risorsa))
      assert.equal(url.hostname, 'database.test', 'La modalità manuale non deve chiamare AI o leggere annunci')
      if (url.pathname === '/auth/v1/user') return json({ id: 'host-test', email: 'host@example.test' })
      if (url.pathname.endsWith('/host_autorizzati')) return json(autorizzato ? { email: 'host@example.test' } : null)
      if (url.pathname.endsWith('/configurazioni_guida')) return json([])
      if (url.pathname.endsWith('/strutture')) return json(creata && url.searchParams.has('id') ? { id, slug: 'casa', nome: 'Casa' } : null)
      if (url.pathname.endsWith('/rpc/crea_casa_configurata')) {
        creazioni++; payload = JSON.parse(opzioni.body); creata = true
        return json(id)
      }
      throw new Error('Richiesta imprevista: ' + url.pathname)
    }
    const { default: handler } = await import('../api/importa-casa.js')
    const invia = async (dati = {}) => {
      const res = { stato: 0, corpo: null, status(n) { this.stato = n; return this }, json(dati) { this.corpo = dati; return this } }
      await handler({ method: 'POST', body: { nome: 'Casa', indirizzo: 'Via prova', modalita: 'manuale', richiesta_id: id,
        access_token: 'test', reti_wifi: [1, 2, 3].map(n => ({ nome: 'Rete ' + n, password: ' segreta ', zona: '' })), ...dati } }, res)
      return res
    }
    autorizzato = false
    assert.equal((await invia()).stato, 403)
    assert.equal(creazioni, 0)
    autorizzato = true
    assert.equal((await invia({ reti_wifi: [{ nome: '', password: 'segreta', zona: '' }] })).stato, 400)
    assert.equal((await invia()).stato, 200)
    assert.equal(payload.p_dati.reti_wifi.length, 3)
    assert.equal(payload.p_dati.reti_wifi[0].password, ' segreta ')
    assert.equal(payload.p_dati.descrizione_casa, '')
    assert.equal((await invia()).stato, 200)
    assert.equal(creazioni, 1)
  } finally {
    globalThis.fetch = fetchOriginale
    chiavi.forEach(chiave => { if (precedenti[chiave] === undefined) delete process.env[chiave]; else process.env[chiave] = precedenti[chiave] })
  }
})

test('limite di unità: blocca PRIMA di chiamare l\'AI, lascia passare chi è nel limite e il superadmin', async () => {
  const chiavi = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_ADMIN_EMAIL']
  const precedenti = Object.fromEntries(chiavi.map(chiave => [chiave, process.env[chiave]]))
  const fetchOriginale = globalThis.fetch
  const id = '44444444-4444-4444-8444-444444444444'
  const json = (dati, status = 200) => new Response(JSON.stringify(dati), { status, headers: { 'content-type': 'application/json' } })
  let emailUtente = 'host@example.test'
  let unitaIncluse = 5
  let unitaGiaUsate = [{ unita: 3 }]
  let erroreRpc = null
  let creazioni = 0
  let payload
  let creata = false
  try {
    process.env.VITE_SUPABASE_URL = 'https://database.test'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test'
    process.env.VITE_ADMIN_EMAIL = 'admin@example.test'
    globalThis.fetch = async (risorsa, opzioni = {}) => {
      const url = new URL(String(risorsa))
      // Se il limite non bloccasse prima, "guidata" con un link chiamerebbe un sito/AI esterno: qui è un errore.
      assert.equal(url.hostname, 'database.test', 'Nessuna chiamata AI o esterna prima del controllo del limite')
      if (url.pathname === '/auth/v1/user') return json({ id: 'host-test', email: emailUtente })
      if (url.pathname.endsWith('/host_autorizzati')) return json({ email: emailUtente, unita_incluse: unitaIncluse })
      if (url.pathname.endsWith('/configurazioni_guida')) return json([])
      if (url.pathname.endsWith('/strutture')) {
        if (url.searchParams.has('slug')) return json(null) // lo slug è sempre libero
        if (url.searchParams.has('id')) return json(creata ? { id, slug: 'casa', nome: 'Casa' } : null)
        return json(unitaGiaUsate)
      }
      if (url.pathname.endsWith('/rpc/crea_casa_configurata')) {
        if (erroreRpc) return json({ message: erroreRpc }, 400)
        creazioni++; payload = JSON.parse(opzioni.body); creata = true
        return json(id)
      }
      throw new Error('Richiesta imprevista: ' + url.pathname)
    }
    const { default: handler } = await import('../api/importa-casa.js')
    const invia = async (dati = {}) => {
      const res = { stato: 0, corpo: null, status(n) { this.stato = n; return this }, json(dati) { this.corpo = dati; return this } }
      await handler({ method: 'POST', body: { nome: 'Casa', indirizzo: 'Via prova', modalita: 'guidata', link: 'https://sito.test/casa',
        richiesta_id: id, access_token: 'test', reti_wifi: [], ...dati } }, res)
      return res
    }

    // 3 unità già usate su 5: ne restano 2, ne chiede 3 → bloccato, senza AI né creazione
    let r = await invia({ unita: 3 })
    assert.equal(r.stato, 403)
    assert.equal(r.corpo.codice, 'LIMITE_UNITA')
    assert.match(r.corpo.error, /te ne restano 2/)
    assert.equal(creazioni, 0)

    // tutte usate → messaggio "piano più grande"
    unitaGiaUsate = [{ unita: 5 }]
    r = await invia({ unita: 1 })
    assert.equal(r.stato, 403)
    assert.match(r.corpo.error, /piano più grande/)

    // unità non valide → 400, non 403
    unitaGiaUsate = [{ unita: 3 }]
    assert.equal((await invia({ unita: 0 })).stato, 400)
    assert.equal((await invia({ unita: 'tante' })).stato, 400)

    // nel limite (3 + 2 = 5, esatto) → creata con le unità richieste. "manuale" evita l'AI.
    r = await invia({ modalita: 'manuale', link: '', unita: 2 })
    assert.equal(r.stato, 200)
    assert.equal(payload.p_dati.unita, 2)
    assert.equal(creazioni, 1)

    // il database può comunque rifiutare (due richieste insieme): messaggio chiaro, non un 500
    creata = false
    erroreRpc = 'LIMITE_UNITA: 5/5 unità già usate, questa struttura ne richiede 1'
    r = await invia({ modalita: 'manuale', link: '', unita: 1, richiesta_id: '55555555-5555-4555-8555-555555555555' })
    assert.equal(r.stato, 403)
    assert.equal(r.corpo.codice, 'LIMITE_UNITA')
    erroreRpc = null

    // il superadmin non ha limite: nemmeno legge le unità già usate
    emailUtente = 'admin@example.test'
    unitaGiaUsate = [{ unita: 500 }]
    creata = false
    r = await invia({ modalita: 'manuale', link: '', unita: 40, richiesta_id: '66666666-6666-4666-8666-666666666666' })
    assert.equal(r.stato, 200)
    assert.equal(payload.p_dati.unita, 40)
  } finally {
    globalThis.fetch = fetchOriginale
    chiavi.forEach(chiave => { if (precedenti[chiave] === undefined) delete process.env[chiave]; else process.env[chiave] = precedenti[chiave] })
  }
})
