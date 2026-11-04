import http from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHandler } from './handler.js'
import { MemoryStore } from './store/memory.js'
import { UpstashStore } from './store/upstash.js'
import { MAX_UPCOMING_PER_CUSTOMER, PACKAGES, PLACES, TIME_SLOTS, closedDayName } from '../src/rules.js'

const TOTAL_LESSONS = PACKAGES.diamond.lessons

// Monday 19 Oct 2026, 10:00 at the school
const NOW = new Date(2026, 9, 19, 10, 0)
const FUTURE = '2026-10-22'
const FUTURE2 = '2026-10-23'
const TODAY = '2026-10-19'
const TOMORROW = '2026-10-20'

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
  let lastSet = ''
  return {
    get cookie() { return cookie },
    get lastSetCookie() { return lastSet },
    set cookie(v) { cookie = v },
    async call(method, path, body, { csrf = true } = {}) {
      const headers = {}
      if (body !== undefined) headers['content-type'] = 'application/json'
      if (csrf) headers['x-dsp'] = '1'
      if (cookie) headers.cookie = cookie
      const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
      const set = res.headers.get('set-cookie')
      if (set) {
        lastSet = set
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
      phone: `98765432${String(counter).padStart(2, '0')}`,
      password: 'secret123',
      ...overrides,
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.customer
  }

  const book = (admin, customerId, over = {}) =>
    admin.call('POST', '/api/appointments', { customerId, date: FUTURE, time: '10:30', place: PLACES[0], ...over })

  // A browser signed in as this customer.
  async function customerBrowser(c, password = 'secret123') {
    const b = browser()
    const res = await b.call('POST', '/api/login', { role: 'customer', identifier: c.phone, password })
    expect(res.status).toBe(200)
    return b
  }

  // The i-th of many distinct slots (8 a day), so one customer can be given a whole course of lessons.
  // The n-th open day from 12 Nov 2026 (skips the weekly leave days).
  const openDay = (n) => {
    const out = []
    for (let d = 12; out.length <= n; d += 1) {
      const date = `2026-11-${String(d).padStart(2, '0')}`
      if (!closedDayName(date)) out.push(date)
    }
    return out[n]
  }
  const slotNumber = (i) => ({
    date: openDay(Math.floor(i / TIME_SLOTS.length)),
    time: TIME_SLOTS[i % TIME_SLOTS.length],
    place: PLACES[0],
  })

  // Books all 20 lessons of the course for a customer (as the admin) and returns their ids in order.
  async function bookCourse(admin, c) {
    const ids = []
    for (let i = 0; i < TOTAL_LESSONS; i += 1) {
      const res = await book(admin, c.id, slotNumber(i))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      ids.push(res.body.appointment.id)
    }
    return ids
  }

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

  it('stores passwords hashed and lets the customer sign in with their mobile number', async () => {
    const admin = await adminBrowser()
    const created = await addCustomer(admin, { name: 'Ravi Kumar', phone: '+91 98765 43210', password: 'secret123' })
    expect(created).not.toHaveProperty('email')

    const saved = await backend.store.hgetall('customers')
    expect(saved).toHaveLength(1)
    expect(saved[0].passwordHash.startsWith('scrypt$')).toBe(true)
    expect(JSON.stringify(saved)).not.toContain('secret123')
    expect(saved[0].phone).toBe('9876543210')
    expect(saved[0]).not.toHaveProperty('email')

    expect((await browser().call('POST', '/api/login', { role: 'customer', identifier: '98765 43210', password: 'secret123' })).status).toBe(200)
    expect((await browser().call('POST', '/api/login', { role: 'customer', identifier: '+91 9876543210', password: 'secret123' })).status).toBe(200)

    const wrong = await browser().call('POST', '/api/login', { role: 'customer', identifier: '9876543210', password: 'wrongpass' })
    expect(wrong.status).toBe(401)
    const unknown = await browser().call('POST', '/api/login', { role: 'customer', identifier: '9111111111', password: 'secret123' })
    expect(unknown.status).toBe(401)
    expect(unknown.body.error).toBe(wrong.body.error)
    expect((await browser().call('POST', '/api/login', { role: 'customer', identifier: '', password: 'secret123' })).status).toBe(401)
  })

  it('validates customers', async () => {
    const admin = await adminBrowser()
    const first = await addCustomer(admin)
    const ok = { name: 'New Person', phone: '9123456780', password: 'secret123' }

    expect((await admin.call('POST', '/api/customers', { ...ok, phone: '12345' })).status).toBe(400)
    expect((await admin.call('POST', '/api/customers', { ...ok, password: '123' })).status).toBe(400)
    expect((await admin.call('POST', '/api/customers', { ...ok, password: 12345678 })).status).toBe(400)
    expect((await admin.call('POST', '/api/customers', { ...ok, phone: first.phone })).status).toBe(400)
    expect((await admin.call('POST', '/api/customers', ok)).status).toBe(201)
  })

  it('edits a customer and keeps the old password when none is given', async () => {
    const admin = await adminBrowser()
    const c = await addCustomer(admin, { password: 'secret123' })
    const res = await admin.call('PUT', `/api/customers/${c.id}`, { name: 'Renamed', phone: c.phone, password: '' })
    expect(res.status).toBe(200)
    expect(res.body.customer.name).toBe('Renamed')
    const login = await browser().call('POST', '/api/login', { role: 'customer', identifier: c.phone, password: 'secret123' })
    expect(login.status).toBe(200)
  })

  it('shows a customer only their own lessons and blocks every admin-only action', async () => {
    const admin = await adminBrowser()
    const a = await addCustomer(admin, { password: 'secret-a1' })
    const b = await addCustomer(admin, { password: 'secret-b1' })
    const lessonA = (await book(admin, a.id, { time: '09:00' })).body.appointment
    await book(admin, b.id, { time: '12:30' })

    const customerA = await customerBrowser(a, 'secret-a1')
    const me = (await customerA.call('GET', '/api/session')).body
    expect(me.session).toEqual({ role: 'customer', id: a.id })
    expect(me.customers.map((c) => c.id)).toEqual([a.id])
    expect(me.appointments.map((x) => x.id)).toEqual([lessonA.id])
    expect(JSON.stringify(me)).not.toContain('passwordHash')

    expect((await customerA.call('PUT', `/api/appointments/${lessonA.id}/attendance`, { attendance: 'present' })).status).toBe(403)
    expect((await customerA.call('POST', '/api/customers', { name: 'Hacker', phone: '9000000001', password: 'secret123' })).status).toBe(403)
    expect((await customerA.call('PUT', `/api/customers/${b.id}`, { name: 'Hacked', phone: b.phone, password: 'hacked-pass' })).status).toBe(403)
    expect((await customerA.call('DELETE', `/api/customers/${b.id}`)).status).toBe(403)
  })

  it('does not allow lessons on the weekly leave day', async () => {
    const admin = await adminBrowser()
    const c = await addCustomer(admin)
    const res = await book(admin, c.id, { date: '2026-10-21' }) // a Wednesday
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/closed on Wednesdays/)
    expect((await book(admin, c.id, { date: '2026-10-25' })).body.error).toMatch(/closed on Sundays/) // a Sunday
    const ok = await book(admin, c.id, { date: '2026-10-23' })
    expect(ok.status).toBe(201)
    expect((await admin.call('PUT', `/api/appointments/${ok.body.appointment.id}`, { date: '2026-10-21', time: '10:30', place: PLACES[0] })).status).toBe(400)
  })

  it('signs the admin out when the browser closes, but keeps customers signed in for a week', async () => {
    const admin = browser()
    await admin.call('POST', '/api/login', { role: 'admin', username: 'admin', password: 'admin123' })
    expect(admin.lastSetCookie).toContain('HttpOnly')
    expect(admin.lastSetCookie).not.toMatch(/Max-Age/i) // a session cookie: deleted when the browser closes

    const c = await addCustomer(await adminBrowser())
    const customer = await customerBrowser(c)
    expect(customer.lastSetCookie).toMatch(/Max-Age=604800/)
  })

  it('lets a customer book, move and cancel their own lessons', async () => {
    const admin = await adminBrowser()
    const a = await addCustomer(admin)
    const b = await addCustomer(admin)
    const lessonB = (await book(admin, b.id, { date: TOMORROW, time: '10:30' })).body.appointment
    const customerA = await customerBrowser(a)

    // A customer always books for themselves, whatever customerId the request names.
    const booked = await book(customerA, b.id, { date: TOMORROW, time: '09:00' })
    expect(booked.status).toBe(201)
    expect(booked.body.appointment.customerId).toBe(a.id)
    const id = booked.body.appointment.id

    const moved = await customerA.call('PUT', `/api/appointments/${id}`, { date: TOMORROW, time: '07:30', place: PLACES[1] })
    expect(moved.status).toBe(200)
    expect(moved.body.appointment).toMatchObject({ customerId: a.id, date: TOMORROW, time: '07:30', place: PLACES[1] })

    // The same rules as for the admin: a slot someone else holds can't be taken...
    expect((await book(customerA, a.id, { date: TOMORROW, time: '10:30' })).status).toBe(409)
    // ...and someone else's lesson can't be moved or cancelled (it looks like it doesn't exist).
    expect((await customerA.call('PUT', `/api/appointments/${lessonB.id}`, { date: TOMORROW, time: '06:00', place: PLACES[1] })).status).toBe(404)
    expect((await customerA.call('DELETE', `/api/appointments/${lessonB.id}`)).status).toBe(404)

    expect((await customerA.call('DELETE', `/api/appointments/${id}`)).status).toBe(200)
    const mine = (await customerA.call('GET', '/api/session')).body.appointments
    expect(mine).toHaveLength(0)
    expect((await admin.call('GET', '/api/session')).body.appointments.map((x) => x.id)).toEqual([lessonB.id])
  })

  it('lets a customer book only one lesson per day, while the admin can book more', async () => {
    const admin = await adminBrowser()
    const c = await addCustomer(admin)
    const customer = await customerBrowser(c)
    const first = await book(customer, c.id, { date: TOMORROW, time: '09:00' })
    expect(first.status).toBe(201)
    const second = await book(customer, c.id, { date: TOMORROW, time: '12:30' })
    expect(second.status).toBe(409)
    expect(second.body.error).toMatch(/one lesson per day/)
    expect((await book(customer, c.id, { date: TODAY, time: '12:30' })).status).toBe(201) // another day is fine
    // Moving the lesson within its own day is fine.
    expect((await customer.call('PUT', `/api/appointments/${first.body.appointment.id}`, { date: TOMORROW, time: '10:30', place: PLACES[0] })).status).toBe(200)
    expect((await book(admin, c.id, { date: TOMORROW, time: '16:30' })).status).toBe(201)
    // Moving a lesson onto a day that already has another of theirs is refused.
    const other = await book(admin, c.id, { date: FUTURE, time: '09:00' })
    expect((await customer.call('PUT', `/api/appointments/${other.body.appointment.id}`, { date: TOMORROW, time: '07:30', place: PLACES[0] })).status).toBe(409)
  })

  it('lets a customer book only today and tomorrow, while the admin can book any day', async () => {
    const admin = await adminBrowser()
    const c = await addCustomer(admin)
    const customer = await customerBrowser(c)

    expect((await book(customer, c.id, { date: TODAY, time: '12:30' })).status).toBe(201) // later today
    const lesson = (await book(customer, c.id, { date: TOMORROW, time: '09:00' })).body.appointment
    const far = await book(customer, c.id, { date: FUTURE, time: '09:00' })
    expect(far.status).toBe(400)
    expect(far.body.error).toMatch(/today or tomorrow/)
    expect((await book(customer, c.id, { date: '2026-11-30', time: '09:00' })).status).toBe(400)

    // Moving a lesson to a later day is refused too.
    expect((await customer.call('PUT', `/api/appointments/${lesson.id}`, { date: FUTURE, time: '09:00', place: PLACES[0] })).status).toBe(400)

    expect((await book(admin, c.id, { date: FUTURE, time: '09:00' })).status).toBe(201)
    expect((await admin.call('PUT', `/api/appointments/${lesson.id}`, { date: FUTURE, time: '10:30', place: PLACES[0] })).status).toBe(200)
  })

  it('does not let a customer change a lesson that has been marked', async () => {
    const admin = await adminBrowser()
    const c = await addCustomer(admin)
    const lesson = (await book(admin, c.id)).body.appointment
    const customer = await customerBrowser(c)
    await admin.call('PUT', `/api/appointments/${lesson.id}/attendance`, { attendance: 'present' })

    expect((await customer.call('PUT', `/api/appointments/${lesson.id}`, { date: FUTURE2, time: '07:30', place: PLACES[1] })).status).toBe(409)
    expect((await customer.call('DELETE', `/api/appointments/${lesson.id}`)).status).toBe(409)
  })

  it('tells a customer which times are taken without saying who has them', async () => {
    const admin = await adminBrowser()
    const a = await addCustomer(admin)
    const b = await addCustomer(admin)
    await book(admin, b.id, { time: '10:30' })
    const mine = (await book(admin, a.id, { time: '12:30' })).body.appointment
    const customerA = await customerBrowser(a)

    const res = await customerA.call('GET', `/api/slots?date=${FUTURE}`)
    expect(res.status).toBe(200)
    expect(res.body.slots).toEqual([
      { time: '10:30', place: PLACES[0], mine: false },
      { time: '12:30', place: PLACES[0], mine: true, id: mine.id },
    ])
    expect(JSON.stringify(res.body)).not.toContain(b.id)

    expect((await customerA.call('GET', '/api/slots?date=nonsense')).status).toBe(400)
    expect((await customerA.call('GET', '/api/slots')).status).toBe(400)
    expect((await customerA.call('POST', '/api/slots', {})).status).toBe(405)
    expect((await browser().call('GET', `/api/slots?date=${FUTURE}`)).status).toBe(401)
  })

  it('lets a customer hold only a few upcoming lessons at a time', async () => {
    const admin = await adminBrowser()
    const c = await addCustomer(admin)
    const customer = await customerBrowser(c)

    // The admin schedules a customer's next lessons ahead of time.
    const ids = []
    for (let i = 0; i < MAX_UPCOMING_PER_CUSTOMER; i += 1) {
      const res = await book(admin, c.id, slotNumber(i))
      expect(res.status).toBe(201)
      ids.push(res.body.appointment.id)
    }
    const over = await book(customer, c.id, { date: TOMORROW, time: '09:00' })
    expect(over.status).toBe(409)
    expect(over.body.error).toMatch(new RegExp(`up to ${MAX_UPCOMING_PER_CUSTOMER} upcoming`))

    // The limit is for self-booking only: the admin can still schedule more.
    expect((await book(admin, c.id, slotNumber(MAX_UPCOMING_PER_CUSTOMER))).status).toBe(201)

    // Cancelling one is not enough while 5 are still upcoming; cancelling two makes room.
    expect((await customer.call('DELETE', `/api/appointments/${ids[0]}`)).status).toBe(200)
    expect((await book(customer, c.id, { date: TOMORROW, time: '09:00' })).status).toBe(409)
    expect((await customer.call('DELETE', `/api/appointments/${ids[1]}`)).status).toBe(200)
    expect((await book(customer, c.id, { date: TOMORROW, time: '09:00' })).status).toBe(201)
  }, 20000)

  it('stops more than the 20 lessons of the course being booked, but lets missed lessons be replaced', async () => {
    const admin = await adminBrowser()
    const c = await addCustomer(admin)
    const ids = await bookCourse(admin, c)

    const extra = await book(admin, c.id, slotNumber(TOTAL_LESSONS))
    expect(extra.status).toBe(409)
    expect(extra.body.error).toMatch(/All 20 lessons/)

    expect((await admin.call('PUT', `/api/appointments/${ids[0]}/attendance`, { attendance: 'absent' })).status).toBe(200)
    expect((await book(admin, c.id, slotNumber(TOTAL_LESSONS))).status).toBe(201)
  }, 20000)

  it('removes a customer automatically after their 20th attended lesson', async () => {
    const admin = await adminBrowser()
    const c = await addCustomer(admin)
    const other = await addCustomer(admin)
    const ids = await bookCourse(admin, c)
    expect((await book(admin, other.id, { date: '2026-12-01' })).status).toBe(201)
    const customer = await customerBrowser(c)
    const mark = (id, attendance) => admin.call('PUT', `/api/appointments/${id}/attendance`, { attendance })

    for (const id of ids.slice(0, TOTAL_LESSONS - 1)) {
      const res = await mark(id, 'present')
      expect(res.status).toBe(200)
      expect(res.body.completed).toBeNull()
    }
    // A missed lesson is not an attended one.
    expect((await mark(ids[TOTAL_LESSONS - 1], 'absent')).body.completed).toBeNull()
    expect((await admin.call('GET', '/api/session')).body.customers.map((x) => x.id)).toContain(c.id)

    const last = await mark(ids[TOTAL_LESSONS - 1], 'present')
    expect(last.status).toBe(200)
    expect(last.body.completed).toEqual({ name: c.name, lessons: TOTAL_LESSONS })

    const after = (await admin.call('GET', '/api/session')).body
    expect(after.customers.map((x) => x.id)).toEqual([other.id])
    expect(after.appointments.filter((a) => a.customerId === c.id)).toHaveLength(0)
    expect((await customer.call('GET', '/api/session')).body.session).toBeNull() // signed out
    expect((await browser().call('POST', '/api/login', { role: 'customer', identifier: c.phone, password: 'secret123' })).status).toBe(401)

    // Their slots are free again.
    expect((await book(admin, other.id, slotNumber(0))).status).toBe(201)
  }, 30000)

  it('books, reschedules, marks attendance and locks finished lessons', async () => {
    const admin = await adminBrowser()
    const c = await addCustomer(admin)

    const booked = await book(admin, c.id)
    expect(booked.status).toBe(201)
    const id = booked.body.appointment.id

    const moved = await admin.call('PUT', `/api/appointments/${id}`, { date: FUTURE2, time: '07:30', place: PLACES[1] })
    expect(moved.status).toBe(200)
    expect(moved.body.appointment).toMatchObject({ date: FUTURE2, time: '07:30', place: PLACES[1] })

    // the old slot is free again
    const other = await addCustomer(admin)
    expect((await book(admin, other.id)).status).toBe(201)

    expect((await admin.call('PUT', `/api/appointments/${id}/attendance`, { attendance: 'bogus' })).status).toBe(400)
    expect((await admin.call('PUT', `/api/appointments/${id}/attendance`, { attendance: 'present' })).status).toBe(200)

    expect((await admin.call('PUT', `/api/appointments/${id}`, { date: FUTURE, time: '12:30', place: PLACES[0] })).status).toBe(409)
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
    expect((await book(admin, a.id, { place: PLACES[1] })).status).toBe(409) // same customer, same time
    expect((await book(admin, b.id, { place: PLACES[1] })).status).toBe(201) // a different place is fine

    expect((await book(admin, b.id, { date: '2026-10-19', time: '09:00' })).status).toBe(400) // already passed today
    expect((await book(admin, b.id, { date: '2026-10-16' })).status).toBe(400)
    expect((await book(admin, b.id, { date: '2026-10-19', time: '12:30' })).status).toBe(201) // later today is fine
    expect((await book(admin, b.id, { place: '' })).status).toBe(400)
    expect((await book(admin, b.id, { time: '12:00' })).status).toBe(400)
    expect((await book(admin, b.id, { date: '2026-02-31' })).status).toBe(400)
    expect((await book(admin, 'does-not-exist')).status).toBe(404)
  })

  it('gives every customer a package', async () => {
    const admin = await adminBrowser()
    const diamond = await addCustomer(admin)
    const gold = await addCustomer(admin, { package: 'gold' })
    expect(diamond.package).toBe('diamond')
    expect(gold.package).toBe('gold')
    expect((await admin.call('POST', '/api/customers', { name: 'Bad Pkg', phone: '9000000002', password: 'secret123', package: 'vip' })).status).toBe(400)
  })

  it('lets the place be typed, ignoring capitals and extra spaces when checking for clashes', async () => {
    const admin = await adminBrowser()
    const a = await addCustomer(admin)
    const b = await addCustomer(admin)
    const first = await book(admin, a.id, { place: 'Tambaram Ground' })
    expect(first.status).toBe(201)
    expect(first.body.appointment.place).toBe('Tambaram Ground')
    const clash = await book(admin, b.id, { place: '  tambaram   ground ' })
    expect(clash.status).toBe(409)
    expect((await book(admin, b.id, { place: 'Another Place' })).status).toBe(201)
    expect((await book(admin, b.id, { place: '', time: '12:30' })).status).toBe(400)
    expect((await book(admin, b.id, { place: 'x', time: '12:30' })).status).toBe(400)
    expect((await book(admin, b.id, { place: 'y'.repeat(41), time: '12:30' })).status).toBe(400)
  })

  it('treats customers saved with the old package names as Diamond and Gold', async () => {
    const admin = await adminBrowser()
    const old = await addCustomer(admin)
    const record = await backend.store.hget('customers', old.id)
    await backend.store.hset('customers', old.id, { ...record, package: 'ladies' })
    const seen = (await admin.call('GET', '/api/session')).body.customers.find((c) => c.id === old.id)
    expect(seen.package).toBe('gold')
  })

  it('only changes a customer\'s package before they have lessons', async () => {
    const admin = await adminBrowser()
    const c = await addCustomer(admin)
    const form = (pkg) => ({ name: c.name, phone: c.phone, package: pkg })
    expect((await admin.call('PUT', `/api/customers/${c.id}`, form('gold'))).body.customer.package).toBe('gold')
    expect((await book(admin, c.id)).status).toBe(201)
    expect((await admin.call('PUT', `/api/customers/${c.id}`, form('diamond'))).status).toBe(409)
    expect((await admin.call('PUT', `/api/customers/${c.id}`, form('gold'))).status).toBe(200) // same package is fine
  })

  it('lets exactly one of several simultaneous bookings for the same slot win', async () => {
    const admin = await adminBrowser()
    const people = []
    for (let i = 0; i < 5; i += 1) people.push(await addCustomer(admin))

    const results = await Promise.all(people.map((p) => book(admin, p.id, { date: FUTURE2, time: '06:00', place: PLACES[2] })))
    const statuses = results.map((r) => r.status).sort()
    expect(statuses.filter((s) => s === 201)).toHaveLength(1)
    expect(statuses.filter((s) => s === 409)).toHaveLength(4)

    const stored = (await admin.call('GET', '/api/session')).body.appointments
    expect(stored.filter((a) => a.date === FUTURE2 && a.time === '06:00')).toHaveLength(1)
  })

  it('stops the same customer being double-booked by simultaneous requests', async () => {
    const admin = await adminBrowser()
    const c = await addCustomer(admin)
    const results = await Promise.all(
      [PLACES[0], PLACES[1], PLACES[2]].map((place) => book(admin, c.id, { place, time: '16:30' }))
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
    await session.call('POST', '/api/login', { role: 'customer', identifier: c.phone, password: 'oldpass123' })
    expect((await session.call('GET', '/api/session')).body.session).not.toBeNull()

    await admin.call('PUT', `/api/customers/${c.id}`, { name: c.name, phone: c.phone, password: 'newpass123' })
    expect((await session.call('GET', '/api/session')).body.session).toBeNull()
    expect((await browser().call('POST', '/api/login', { role: 'customer', identifier: c.phone, password: 'oldpass123' })).status).toBe(401)

    const again = browser()
    expect((await again.call('POST', '/api/login', { role: 'customer', identifier: c.phone, password: 'newpass123' })).status).toBe(200)
    await admin.call('DELETE', `/api/customers/${c.id}`)
    expect((await again.call('GET', '/api/session')).body.session).toBeNull()
  })

  it('shares one set of data between separate browsers', async () => {
    const admin = await adminBrowser()
    const c = await addCustomer(admin, { password: 'secret123' })
    const phone = browser()
    await phone.call('POST', '/api/login', { role: 'customer', identifier: c.phone, password: 'secret123' })
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
