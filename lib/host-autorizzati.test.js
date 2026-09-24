import test from 'node:test'
import assert from 'node:assert/strict'

// api/host-autorizzati.js con un database finto: si controlla soprattutto che rigenerare
// l'invito NON riporti a 5 il limite di un host che ha fatto l'upgrade, e che l'elenco
// mostri le unità usate sommando TUTTE le strutture di ciascun host.
test('unità incluse: elenco con conteggio, invito che non azzera il limite, upgrade con PATCH', async () => {
  const chiavi = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_ADMIN_EMAIL']
  const precedenti = Object.fromEntries(chiavi.map(chiave => [chiave, process.env[chiave]]))
  const fetchOriginale = globalThis.fetch
  const json = (dati, status = 200) => new Response(JSON.stringify(dati), { status, headers: { 'content-type': 'application/json' } })
  let upsert = null
  let patch = null
  let patchTrovato = true
  try {
    process.env.VITE_SUPABASE_URL = 'https://database.test'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test'
    process.env.VITE_ADMIN_EMAIL = 'admin@example.test'
    globalThis.fetch = async (risorsa, opzioni = {}) => {
      const url = new URL(String(risorsa))
      assert.equal(url.hostname, 'database.test')
      const metodo = (opzioni.method || 'GET').toUpperCase()
      if (url.pathname === '/auth/v1/user') return json({ id: 'admin-id', email: 'admin@example.test' })
      if (url.pathname === '/auth/v1/admin/users') {
        return json({ users: [{ id: 'u-bnb', email: 'bnb@example.test' }, { id: 'u-ville', email: 'Ville@Example.test' }] })
      }
      if (url.pathname === '/auth/v1/admin/generate_link') return json({ properties: { action_link: 'https://link.test/invito' } })
      if (url.pathname.endsWith('/strutture')) {
        return json([
          { owner_user_id: 'u-bnb', unita: 3 }, { owner_user_id: 'u-bnb', unita: 2 },
          { owner_user_id: 'u-ville', unita: 1 }, { owner_user_id: 'sconosciuto', unita: 9 },
        ])
      }
      if (url.pathname.endsWith('/host_autorizzati')) {
        if (metodo === 'GET') {
          return json([
            { email: 'bnb@example.test', unita_incluse: 5 },
            { email: 'ville@example.test', unita_incluse: 13 },
            { email: 'nuovo@example.test', unita_incluse: 5 },
          ])
        }
        if (metodo === 'POST') { upsert = JSON.parse(opzioni.body); return json(null, 201) }
        if (metodo === 'PATCH') { patch = JSON.parse(opzioni.body); return json(patchTrovato ? [{ email: 'bnb@example.test' }] : []) }
      }
      throw new Error('Richiesta imprevista: ' + metodo + ' ' + url.pathname)
    }
    const { default: handler } = await import('../api/host-autorizzati.js')
    const chiama = async (metodo, body = {}) => {
      const res = { stato: 0, corpo: null, status(n) { this.stato = n; return this }, json(dati) { this.corpo = dati; return this } }
      await handler({ method: metodo, headers: { authorization: 'Bearer test' }, body }, res)
      return res
    }

    // elenco: unità usate sommate per host (email in minuscolo, strutture senza email ignorate)
    let r = await chiama('GET')
    assert.equal(r.stato, 200)
    const per = Object.fromEntries(r.corpo.host.map(h => [h.email, h]))
    assert.equal(per['bnb@example.test'].unita_usate, 5)
    assert.equal(per['bnb@example.test'].unita_incluse, 5)
    assert.equal(per['ville@example.test'].unita_usate, 1)
    assert.equal(per['nuovo@example.test'].unita_usate, 0)

    // invito senza unità: NON scrive unita_incluse (né riporta a 5 un limite alzato)
    r = await chiama('POST', { email: 'Ville@Example.test', piano: 'portfolio' })
    assert.equal(r.stato, 200)
    assert.equal('unita_incluse' in upsert, false)
    // invito con unità: le scrive
    r = await chiama('POST', { email: 'nuovo@example.test', unita_incluse: '13' })
    assert.equal(r.stato, 200)
    assert.equal(upsert.unita_incluse, 13)
    // unità non valide: rifiutate prima di toccare il database
    upsert = null
    r = await chiama('POST', { email: 'nuovo@example.test', unita_incluse: '0' })
    assert.equal(r.stato, 400)
    assert.equal(upsert, null)

    // upgrade con PATCH
    r = await chiama('PATCH', { email: 'BNB@example.test', unita_incluse: 8 })
    assert.equal(r.stato, 200)
    assert.deepEqual(patch, { unita_incluse: 8 })
    assert.equal((await chiama('PATCH', { email: 'bnb@example.test' })).stato, 400)
    assert.equal((await chiama('PATCH', { email: 'bnb@example.test', unita_incluse: 1000 })).stato, 400)
    assert.equal((await chiama('PATCH', { unita_incluse: 5 })).stato, 400)
    patchTrovato = false
    assert.equal((await chiama('PATCH', { email: 'nessuno@example.test', unita_incluse: 5 })).stato, 404)
  } finally {
    globalThis.fetch = fetchOriginale
    chiavi.forEach(chiave => { if (precedenti[chiave] === undefined) delete process.env[chiave]; else process.env[chiave] = precedenti[chiave] })
  }
})
