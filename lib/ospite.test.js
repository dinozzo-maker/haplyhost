import test from 'node:test'
import assert from 'node:assert/strict'

// api/ospite.js con un database finto: il conteggio delle aperture (migration 0024) parte solo
// con un link valido e non deve mai far fallire la risposta all'ospite.
test('aperture del soggiorno: registrate col link valido, mai con uno falso, mai bloccanti', async () => {
  const chiavi = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  const precedenti = Object.fromEntries(chiavi.map(chiave => [chiave, process.env[chiave]]))
  const fetchOriginale = globalThis.fetch
  const json = (dati, status = 200) => new Response(JSON.stringify(dati), { status, headers: { 'content-type': 'application/json' } })
  const TOKEN = 'ab'.repeat(32)
  const ID_SOGGIORNO = '11111111-1111-4111-8111-111111111111'
  const oggi = new Date().toISOString().slice(0, 10)
  let guidaAttiva = true
  let tokenNelDatabase = TOKEN
  let statoRpc = 'ok' // 'ok' | 'errore-http' | 'rete'
  const chiamateRpc = []
  try {
    process.env.VITE_SUPABASE_URL = 'https://database.test'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test'
    globalThis.fetch = async (risorsa, opzioni = {}) => {
      const url = new URL(String(risorsa))
      assert.equal(url.hostname, 'database.test')
      if (url.pathname.endsWith('/rpc/registra_apertura_soggiorno')) {
        chiamateRpc.push(JSON.parse(opzioni.body))
        if (statoRpc === 'rete') throw new Error('rete caduta')
        if (statoRpc === 'errore-http') return json({ message: 'errore del database' }, 500)
        return json(true)
      }
      if (url.pathname.endsWith('/strutture_segreti')) return json({ reti_wifi: [{ nome: 'Casa', password: 'segreta', zona: '' }] })
      if (url.pathname.endsWith('/strutture')) return json({ id: 'struttura-1', attivo: guidaAttiva })
      if (url.pathname.endsWith('/soggiorni')) {
        // il token cercato dev'essere quello nel database, altrimenti nessuna riga
        const cercato = url.searchParams.get('token')
        return json(cercato === `eq.${tokenNelDatabase}` ? { id: ID_SOGGIORNO, nome: 'Famiglia Rossi', checkin: oggi, checkout: oggi } : null)
      }
      throw new Error('Richiesta imprevista: ' + url.pathname)
    }
    const { default: handler } = await import('../api/ospite.js')
    const chiama = async (azione, s = TOKEN) => {
      const res = { stato: 0, corpo: null, headers: {}, setHeader(k, v) { this.headers[k] = v }, status(n) { this.stato = n; return this }, json(d) { this.corpo = d; return this } }
      await handler({ method: 'GET', query: { azione, slug: 'casa-test', s } }, res)
      return res
    }

    // benvenuto: risposta corretta + un'apertura registrata sul soggiorno giusto
    let r = await chiama('soggiorno')
    assert.equal(r.stato, 200)
    assert.equal(r.corpo.nome, 'Famiglia Rossi')
    assert.deepEqual(chiamateRpc, [{ p_id: ID_SOGGIORNO }])

    // anche aprendo direttamente la pagina del Wi-Fi
    r = await chiama('wifi')
    assert.equal(r.stato, 200)
    assert.equal(r.corpo.reti[0].password, 'segreta')
    assert.equal(chiamateRpc.length, 2)

    // un errore del conteggio (database o rete) NON blocca la risposta all'ospite
    for (const modo of ['errore-http', 'rete']) {
      statoRpc = modo
      r = await chiama('soggiorno')
      assert.equal(r.stato, 200, modo)
      assert.equal(r.corpo.nome, 'Famiglia Rossi', modo)
    }
    statoRpc = 'ok'

    // link falso, formato sbagliato, guida in bozza: nessun conteggio
    const prima = chiamateRpc.length
    tokenNelDatabase = 'cd'.repeat(32)
    assert.equal((await chiama('soggiorno')).stato, 404)
    tokenNelDatabase = TOKEN
    assert.equal((await chiama('soggiorno', 'troppo-corto')).stato, 404)
    guidaAttiva = false
    assert.equal((await chiama('soggiorno')).stato, 404)
    assert.equal((await chiama('wifi')).stato, 404)
    assert.equal(chiamateRpc.length, prima, 'nessuna apertura registrata senza un link valido')
  } finally {
    globalThis.fetch = fetchOriginale
    chiavi.forEach(chiave => { if (precedenti[chiave] === undefined) delete process.env[chiave]; else process.env[chiave] = precedenti[chiave] })
  }
})
