import http from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHandler } from './handler.js'
import { MemoryStore } from './store/memory.js'
import { UpstashStore } from './store/upstash.js'

// Saturday 17 Oct 2026, 10:00 at the school
const NOW = new Date(2026, 9, 17, 10, 0)
const FUTURE = '2026-10-20'
const FUTURE2 = '2026-10-21'

// ---------- a tiny fake of Upstash's REST API, so the real UpstashStore code can be tested ----------

async function startMockUpstash(token = 'test-token') {
  const hashes = new Map()
  const strings = new Map()
  const server = http.createServer(async (req, res) => {
    res.setHeader('content-type', 'application/json')
    if (req.headers.authorization !== `Bearer ${token}`) {
      res.statusCode = 401
      return res.end(JSON.stringify({ error: 'Unauthorized' }))
    }
    let raw = ''
    for await (const chunk of req) raw += chunk
    const [cmd, ...a] = JSON.parse(raw)
    let result
    switch (String(cmd).toUpperCase()) {
      case 'HSET': {
        if (!hashes.has(a[0])) hashes.set(a[0], new Map())
        const isNew = !hashes.get(a[0]).has(a[1])
        hashes.get(a[0]).set(a[1], a[2])
        result = isNew ? 1 : 0
        break
      }
      case 'HGET': result = hashes.get(a[0])?.get(a[1]) ?? null; break
      case 'HDEL': result = hashes.get(a[0])?.delete(a[1]) ? 1 : 0; break
      case 'HGETALL': {
        result = []
        for (const [k, v] of hashes.get(a[0]) ?? []) result.push(k, v)
        break
      }
      case 'GET': result = strings.get(a[0]) ?? null; break
      case 'SET':
        if (a[2] === 'NX' && strings.has(a[0])) result = null
        else { strings.set(a[0], a[1]); result = 'OK' }
        break
      case 'DEL': result = strings.delete(a[0]) ? 1 : 0; break
      case 'INCR': {
        const n = Number(strings.get(a[0]) ?? 0) + 1
        strings.set(a[0], String(n))
        result = n
        break
      }
      case 'EXPIRE': result = 1; break
      default:
        res.statusCode = 400
        return res.end(JSON.stringify({ error: `ERR unknown command ${cmd}` }))
    }
    return res.end(JSON.stringify({ result }))
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    stop: () => new Promise((r) => server.close(r)),
  }
}

// ---------- helpers ----------

async function startApi(store, { env = { NODE_ENV: 'test' } } = {}) {
  const handler = createHandler({ env, store, now: () => NOW })
  const server = http.createServer((req, res) => handler(req, res))
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((r) => server.close(r)),
  }
}

// A browser stand-in: keeps its own cookie, like a separate browser would.
function newBrowser(base) {
  let cookie = ''
  return {
    get cookie() { return cookie },
    set cookie(v) { cookie = v },
    async call(method, path, body, { csrf = true } = {}) {
      const headers = {}
      if (body !== undefined) headers['content-type'] = 'application/json'
      if (csrf) headers['x-dsp'] = '1'
      if (cookie) headers.cookie = cookie
      const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
      const set = res.headers.get('set-cookie')
      if (set) {
        const pair = set.split(';')[0]
        cookie = pair.endsWith('=') ? '' : pair
      }
      let json = null
      try { json = await res.json() } catch { /* empty body */ }
      return { status: res.status, body: json }
    },
  }
}

const stores = {
  'local store': async () => ({ store: new MemoryStore(), stop: async () => {} }),
  'Upstash store (mocked REST)': async () => {
    const mock = await startMockUpstash()
    return { store: new UpstashStore({ url: mock.url, token: 'test-token' }), stop: mock.stop }
  },
}

describe.each(Object.entries(stores))('API with the %s', (_name, makeStore) => {
  let api
  let backend

  beforeEach(async () => {
    backend = await makeStore()
    api = await startApi(backend.store)
  })
  afterEach(async () => {
    await api.close()
    await backend.stop()
  })

  const browser = () => newBrowser(api.base)

  async function adminBrowser() {
    const b = browser()
    const res = await b.call('POST', '/api/login', { role: 'admin', username: 'admin', password: 'admin123' })
    expect(res.status).toBe(200)
    return b
  }

  let counter = 0
  async function addCustomer(admin, overrides = {}) {
    counter += 1
    const res = await admin.call('POST', '/api/customers', {
      name: `Customer ${counter}`,
      email: `customer${counter}@example.com`,
      phone: `98765432${String(counter).padStart(2, '0')}`,
      password: 'secret123',
      ...overrides,
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.customer
  }

  const book = (admin, customerId, over = {}) =>
    admin.call('POST', '/api/appointments', { customerId, date: FUTURE, time: '10:00', place: 'Downtown Center', ...over })

  it('is signed out by default and returns no data', async () => {
    const res = await browser().call('GET', '/api/session')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ session: null, customers: [], appointments: [] })
  })

  it('rejects changes that lack the anti-CSRF header', async () => {
    const res = await browser().call('POST', '/api/login', { role: 'admin', username: 'admin', password: 'admin123' }, { csrf: false })
    expect(res.status).toBe(403)
  })

  it('signs the admin in and out', async () => {
    const b = browser()
    const bad = await b.call('POST', '/api/login', { role: 'admin', username: 'admin', password: 'nope' })
    expect(bad.status).toBe(401)

    await b.call('POST', '/api/login', { role: 'admin', username: 'admin', password: 'admin123' })
    expect((await b.call('GET', '/api/session')).body.session).toEqual({ role: 'admin' })

    await b.call('POST', '/api/logout', {})
    expect((await b.call('GET', '/api/session')).body.session).toBeNull()
  })

  it('ignores a tampered session cookie', async () => {
    const admin = await adminBrowser()
    const forged = browser()
    forged.cookie = admin.cookie.slice(0, -3) + 'abc'
    expect((await forged.call('GET', '/api/session')).body.session).toBeNull()
  })

  it('does not let signed-out visitors change anything', async () => {
    const b = browser()
    expect((await b.call('POST', '/api/customers', { name: 'X' })).status).toBe(401)
    expect((await b.call('POST', '/api/appointments', {})).status).toBe(401)
    expect((await b.call('PUT', '/api/appointments/a1/attendance', { attendance: 'present' })).status).toBe(401)
  })

  it('stores passwords hashed and lets the customer sign in with email or mobile number', async () => {
    const admin = await adminBrowser()
    await addCustomer(admin, { name: 'Ravi Kumar', email: 'Ravi@Example.com', phone: '+91 98765 43210', password: 'secret123' })

    const saved = await backend.store.hgetall('customers')
    expect(saved).toHaveLength(1)
    expect(saved[0].passwordHash.startsWith('scrypt$')).toBe(true)
    expect(JSON.stringify(saved)).not.toContain('secret123')
    expect(saved[0].email).toBe('ravi@example.com')
    expect(saved[0].phone).toBe('9876543210')

    const byEmail = browser()
    expect((await byEmail.call('POST', '/api/login', { role: 'customer', identifier: 'RAVI@example.com', password: 'secret123' })).status).toBe(200)
    const byPhone = browser()
    expect((await byPhone.call('POST', '/api/login', { role: 'customer', identifier: '98765 43210', password: 'secret123' })).status).toBe(200)

    const wrong = await browser().call('POST', '/api/login', { role: 'customer', identifier: 'ravi@example.com', password: 'wrongpass' })
    expect(wrong.status).toBe(401)
    const unknown = await browser().call('POST', '/api/login', { role: 'customer', identifier: 'nobody@example.com', password: 'secret123' })
    expect(unknown.status).toBe(401)
    expect(unknown.body.error).toBe(wrong.body.error)
  })

  it('validates customers', async () => {
    const admin = await adminBrowser()
    const first = await addCustomer(admin)
    const ok = { name: 'New Person', email: 'new@example.com', phone: '9123456780', password: 'secret123' }

    expect((await admin.call('POST', '/api/customers', { ...ok, phone: '12345' })).status).toBe(400)
    expect((await admin.call('POST', '/api/customers', { ...ok, password: '123' })).status).toBe(400)
    expect((await admin.call('POST', '/api/customers', { ...ok, password: 12345678 })).status).toBe(400)
    expect((await admin.call('POST', '/api/customers', { ...ok, email: first.email.toUpperCase() })).status).toBe(400)
    expect((await admin.call('POST', '/api/customers', { ...ok, phone: first.phone })).status).toBe(400)
    expect((await admin.call('POST', '/api/customers', ok)).status).toBe(201)
  })

  it('edits a customer and keeps the old password when none is given', async () => {
    const admin = await adminBrowser()
    const c = await addCustomer(admin, { password: 'secret123' })
    const res = await admin.call('PUT', `/api/customers/${c.id}`, { name: 'Renamed', email: c.email, phone: c.phone, password: '' })
    expect(res.status).toBe(200)
    expect(res.body.customer.name).toBe('Renamed')
    const login = await browser().call('POST', '/api/login', { role: 'customer', identifier: c.email, password: 'secret123' })
    expect(login.status).toBe(200)
  })

  it('shows a customer only their own lessons and blocks every admin action', async () => {
    const admin = await adminBrowser()
    const a = await addCustomer(admin, { password: 'secret-a1' })
    const b = await addCustomer(admin, { password: 'secret-b1' })
    const lessonA = (await book(admin, a.id, { time: '09:00' })).body.appointment
    await book(admin, b.id, { time: '11:00' })

    const customerA = browser()
    await customerA.call('POST', '/api/login', { role: 'customer', identifier: a.email, password: 'secret-a1' })
    const me = (await customerA.call('GET', '/api/session')).body
    expect(me.session).toEqual({ role: 'customer', id: a.id })
    expect(me.customers.map((c) => c.id)).toEqual([a.id])
    expect(me.appointments.map((x) => x.id)).toEqual([lessonA.id])
    expect(JSON.stringify(me)).not.toContain('passwordHash')

    expect((await book(customerA, a.id, { time: '13:00' })).status).toBe(403)
    expect((await customerA.call('PUT', `/api/appointments/${lessonA.id}`, { date: FUTURE2, time: '10:00', place: 'North Branch' })).status).toBe(403)
    expect((await customerA.call('DELETE', `/api/appointments/${lessonA.id}`)).status).toBe(403)
    expect((await customerA.call('PUT', `/api/appointments/${lessonA.id}/attendance`, { attendance: 'present' })).status).toBe(403)
    expect((await customerA.call('POST', '/api/customers', { name: 'Hacker', email: 'h@example.com', phone: '9000000001', password: 'secret123' })).status).toBe(403)
    expect((await customerA.call('DELETE', `/api/customers/${b.id}`)).status).toBe(403)
  })

  it('books, reschedules, marks attendance and locks finished lessons', async () => {
    const admin = await adminBrowser()
    const c = await addCustomer(admin)

    const booked = await book(admin, c.id)
    expect(booked.status).toBe(201)
    const id = booked.body.appointment.id

    const moved = await admin.call('PUT', `/api/appointments/${id}`, { date: FUTURE2, time: '14:00', place: 'North Branch' })
    expect(moved.status).toBe(200)
    expect(moved.body.appointment).toMatchObject({ date: FUTURE2, time: '14:00', place: 'North Branch' })

    // the old slot is free again
    const other = await addCustomer(admin)
    expect((await book(admin, other.id)).status).toBe(201)

    expect((await admin.call('PUT', `/api/appointments/${id}/attendance`, { attendance: 'bogus' })).status).toBe(400)
    expect((await admin.call('PUT', `/api/appointments/${id}/attendance`, { attendance: 'present' })).status).toBe(200)

    expect((await admin.call('PUT', `/api/appointments/${id}`, { date: FUTURE, time: '11:00', place: 'Downtown Center' })).status).toBe(409)
    expect((await admin.call('DELETE', `/api/appointments/${id}`)).status).toBe(409)

    expect((await admin.call('PUT', `/api/appointments/${id}/attendance`, { attendance: null })).status).toBe(200)
    expect((await admin.call('DELETE', `/api/appointments/${id}`)).status).toBe(200)
    const all = (await admin.call('GET', '/api/session')).body.appointments
    expect(all.find((x) => x.id === id)).toBeUndefined()
  })

  it('refuses clashes, past slots and invalid input', async () => {
    const admin = await adminBrowser()
    const a = await addCustomer(admin)
    const b = await addCustomer(admin)
    expect((await book(admin, a.id)).status).toBe(201)

    expect((await book(admin, b.id)).status).toBe(409) // same place and time
    expect((await book(admin, a.id, { place: 'North Branch' })).status).toBe(409) // same customer, same time
    expect((await book(admin, b.id, { place: 'North Branch' })).status).toBe(201) // different place is fine

    expect((await book(admin, b.id, { date: '2026-10-17', time: '09:00' })).status).toBe(400) // already passed today
    expect((await book(admin, b.id, { date: '2026-10-16' })).status).toBe(400)
    expect((await book(admin, b.id, { date: '2026-10-17', time: '11:00' })).status).toBe(201) // later today is fine
    expect((await book(admin, b.id, { place: 'Moon Base' })).status).toBe(400)
    expect((await book(admin, b.id, { time: '12:00' })).status).toBe(400)
    expect((await book(admin, b.id, { date: '2026-02-31' })).status).toBe(400)
    expect((await book(admin, 'does-not-exist')).status).toBe(404)
  })

  it('lets exactly one of several simultaneous bookings for the same slot win', async () => {
    const admin = await adminBrowser()
    const people = []
    for (let i = 0; i < 5; i += 1) people.push(await addCustomer(admin))

    const results = await Promise.all(people.map((p) => book(admin, p.id, { date: FUTURE2, time: '15:00', place: 'Airport Branch' })))
    const statuses = results.map((r) => r.status).sort()
    expect(statuses.filter((s) => s === 201)).toHaveLength(1)
    expect(statuses.filter((s) => s === 409)).toHaveLength(4)

    const stored = (await admin.call('GET', '/api/session')).body.appointments
    expect(stored.filter((a) => a.date === FUTURE2 && a.time === '15:00')).toHaveLength(1)
  })

  it('stops the same customer being double-booked by simultaneous requests', async () => {
    const admin = await adminBrowser()
    const c = await addCustomer(admin)
    const results = await Promise.all(
      ['Downtown Center', 'North Branch', 'Airport Branch'].map((place) => book(admin, c.id, { place, time: '16:00' }))
    )
    expect(results.filter((r) => r.status === 201)).toHaveLength(1)
  })

  it('deletes a removed customer\'s lessons and frees their slots', async () => {
    const admin = await adminBrowser()
    const a = await addCustomer(admin)
    const b = await addCustomer(admin)
    expect((await book(admin, a.id)).status).toBe(201)
    expect((await book(admin, b.id)).status).toBe(409)

    expect((await admin.call('DELETE', `/api/customers/${a.id}`)).status).toBe(200)
    const after = (await admin.call('GET', '/api/session')).body
    expect(after.customers.map((c) => c.id)).toEqual([b.id])
    expect(after.appointments).toHaveLength(0)
    expect((await book(admin, b.id)).status).toBe(201)
  })

  it('signs a customer out when the admin resets their password or removes them', async () => {
    const admin = await adminBrowser()
    const c = await addCustomer(admin, { password: 'oldpass123' })
    const session = browser()
    await session.call('POST', '/api/login', { role: 'customer', identifier: c.email, password: 'oldpass123' })
    expect((await session.call('GET', '/api/session')).body.session).not.toBeNull()

    await admin.call('PUT', `/api/customers/${c.id}`, { name: c.name, email: c.email, phone: c.phone, password: 'newpass123' })
    expect((await session.call('GET', '/api/session')).body.session).toBeNull()
    expect((await browser().call('POST', '/api/login', { role: 'customer', identifier: c.email, password: 'oldpass123' })).status).toBe(401)

    const again = browser()
    expect((await again.call('POST', '/api/login', { role: 'customer', identifier: c.email, password: 'newpass123' })).status).toBe(200)
    await admin.call('DELETE', `/api/customers/${c.id}`)
    expect((await again.call('GET', '/api/session')).body.session).toBeNull()
  })

  it('shares one set of data between separate browsers', async () => {
    const admin = await adminBrowser()
    const c = await addCustomer(admin, { password: 'secret123' })
    const phone = browser()
    await phone.call('POST', '/api/login', { role: 'customer', identifier: c.email, password: 'secret123' })
    const laptop = browser()
    await laptop.call('POST', '/api/login', { role: 'customer', identifier: c.phone, password: 'secret123' })

    expect((await phone.call('GET', '/api/session')).body.appointments).toHaveLength(0)
    const lesson = (await book(admin, c.id)).body.appointment
    expect((await phone.call('GET', '/api/session')).body.appointments.map((a) => a.id)).toEqual([lesson.id])
    expect((await laptop.call('GET', '/api/session')).body.appointments.map((a) => a.id)).toEqual([lesson.id])

    await admin.call('PUT', `/api/appointments/${lesson.id}/attendance`, { attendance: 'present' })
    expect((await laptop.call('GET', '/api/session')).body.appointments[0].attendance).toBe('present')
  })

  it('blocks sign-in after too many attempts', async () => {
    const b = browser()
    for (let i = 0; i < 10; i += 1) {
      expect((await b.call('POST', '/api/login', { role: 'admin', username: 'admin', password: `wrong${i}` })).status).toBe(401)
    }
    const blocked = await b.call('POST', '/api/login', { role: 'admin', username: 'admin', password: 'admin123' })
    expect(blocked.status).toBe(429)
  })

  it('answers 404 and 405 for unknown routes', async () => {
    const admin = await adminBrowser()
    expect((await admin.call('GET', '/api/nothing')).status).toBe(404)
    expect((await admin.call('GET', '/api/customers')).status).toBe(405)
  })
})

describe('production safety', () => {
  it('refuses to run without its secrets and database', async () => {
    const api = await startApi(null, { env: { NODE_ENV: 'production' } })
    const b = newBrowser(api.base)
    const session = await b.call('GET', '/api/session')
    expect(session.status).toBe(503)
    expect(session.body.code).toBe('not_configured')
    expect(session.body.problems).toHaveLength(3)
    expect((await b.call('POST', '/api/login', { role: 'admin', username: 'admin', password: 'admin123' })).status).toBe(503)
    expect((await b.call('GET', '/api/health')).body.ok).toBe(false)
    await api.close()
  })

  it('has no default admin password in production', async () => {
    const mock = await startMockUpstash()
    const store = new UpstashStore({ url: mock.url, token: 'test-token' })
    const env = { NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32), UPSTASH_REDIS_REST_URL: mock.url, UPSTASH_REDIS_REST_TOKEN: 'test-token' }
    const api = await startApi(store, { env })
    const b = newBrowser(api.base)
    const res = await b.call('POST', '/api/login', { role: 'admin', username: 'admin', password: 'admin123' })
    expect(res.status).toBe(503)
    expect(res.body.problems[0]).toMatch(/ADMIN_PASSWORD/)
    await api.close()
    await mock.stop()
  })

  it('works once everything is configured', async () => {
    const mock = await startMockUpstash()
    const env = {
      NODE_ENV: 'production', ADMIN_PASSWORD: 'a-long-admin-password', SESSION_SECRET: 'x'.repeat(32),
      KV_REST_API_URL: mock.url, KV_REST_API_TOKEN: 'test-token',
    }
    const api = await startApi(undefined, { env })
    const b = newBrowser(api.base)
    expect((await b.call('POST', '/api/login', { role: 'admin', username: 'admin', password: 'admin123' })).status).toBe(401)
    expect((await b.call('POST', '/api/login', { role: 'admin', username: 'admin', password: 'a-long-admin-password' })).status).toBe(200)
    await api.close()
    await mock.stop()
  })
})
