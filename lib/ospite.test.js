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
  let infoArrivo = '  Cassetta chiavi a sinistra della porta, codice 4827.  '
  let datiSoggiorno = { checkin: oggi, checkout: oggi } // cambiabile per provare prima/durante/dopo
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
      if (url.pathname.endsWith('/strutture_segreti')) return json({ reti_wifi: [{ nome: 'Casa', password: 'segreta', zona: '' }], info_arrivo: infoArrivo })
      if (url.pathname.endsWith('/strutture')) return json({ id: 'struttura-1', attivo: guidaAttiva })
      if (url.pathname.endsWith('/soggiorni')) {
        // il token cercato dev'essere quello nel database, altrimenti nessuna riga
        const cercato = url.searchParams.get('token')
        return json(cercato === `eq.${tokenNelDatabase}` ? { id: ID_SOGGIORNO, nome: 'Famiglia Rossi', ...datiSoggiorno } : null)
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

    // ---- istruzioni di arrivo riservate ----
    guidaAttiva = true // il test precedente l'aveva lasciata in bozza
    const domani = new Date(Date.now() + 86_400_000 * 2).toISOString().slice(0, 10)
    const ieri = new Date(Date.now() - 86_400_000 * 3).toISOString().slice(0, 10)
    const piuIndietro = new Date(Date.now() - 86_400_000 * 5).toISOString().slice(0, 10)

    // durante il soggiorno: il testo esce, ripulito dagli spazi
    r = await chiama('arrivo')
    assert.equal(r.stato, 200)
    assert.equal(r.corpo.stato, 'in_corso')
    assert.equal(r.corpo.testo, 'Cassetta chiavi a sinistra della porta, codice 4827.')
    assert.equal(r.headers['Cache-Control'], 'no-store')

    // il benvenuto dice solo CHE esistono, mai il testo (né il codice)
    r = await chiama('soggiorno')
    assert.equal(r.corpo.arrivo, true)
    assert.ok(!JSON.stringify(r.corpo).includes('4827'), 'il benvenuto non deve mai contenere il testo riservato')

    // senza istruzioni scritte dall'host: arrivo=false, testo vuoto
    infoArrivo = '   '
    assert.equal((await chiama('soggiorno')).corpo.arrivo, false)
    assert.equal((await chiama('arrivo')).corpo.testo, '')
    infoArrivo = null
    assert.equal((await chiama('soggiorno')).corpo.arrivo, false)
    infoArrivo = '  Cassetta chiavi a sinistra della porta, codice 4827.  '

    // PRIMA del check-in: solo la data, mai il testo
    datiSoggiorno = { checkin: domani, checkout: domani }
    r = await chiama('arrivo')
    assert.equal(r.corpo.stato, 'presto')
    assert.equal(r.corpo.checkin, domani)
    assert.equal(r.corpo.presente, true) // l'host ha scritto qualcosa, ma il testo non esce
    assert.ok(!JSON.stringify(r.corpo).includes('4827'), 'prima del check-in il codice non deve uscire')
    assert.equal((await chiama('soggiorno')).corpo.arrivo, true) // il pulsante si vede, il testo no
    infoArrivo = ''
    assert.equal((await chiama('arrivo')).corpo.presente, false) // niente scritto: la pagina non promette nulla
    infoArrivo = '  Cassetta chiavi a sinistra della porta, codice 4827.  '

    // DOPO il check-out: niente, e il benvenuto non lo segnala nemmeno
    datiSoggiorno = { checkin: piuIndietro, checkout: ieri }
    r = await chiama('arrivo')
    assert.equal(r.corpo.stato, 'scaduto')
    assert.ok(!JSON.stringify(r.corpo).includes('4827'), 'dopo il check-out il codice non deve uscire')
    assert.equal((await chiama('soggiorno')).corpo.arrivo, false)
    datiSoggiorno = { checkin: oggi, checkout: oggi }

    // token falso / guida in bozza: 404 e nessun testo
    tokenNelDatabase = 'cd'.repeat(32)
    r = await chiama('arrivo')
    assert.equal(r.stato, 404)
    assert.ok(!JSON.stringify(r.corpo).includes('4827'))
    tokenNelDatabase = TOKEN
    guidaAttiva = false
    assert.equal((await chiama('arrivo')).stato, 404)
    guidaAttiva = true
  } finally {
    globalThis.fetch = fetchOriginale
    chiavi.forEach(chiave => { if (precedenti[chiave] === undefined) delete process.env[chiave]; else process.env[chiave] = precedenti[chiave] })
  }
})
