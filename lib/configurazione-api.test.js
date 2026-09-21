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
