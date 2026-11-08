import http from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHandler } from './handler.js'
import { MemoryStore } from './store/memory.js'

let api
async function start(env = {}) {
  const handler = createHandler({ env: { NODE_ENV: 'test', ADMIN_PASSWORD: 'admin123', ...env }, store: new MemoryStore() })
  const server = http.createServer((req, res) => handler(req, res))
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  api = { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) }
}
async function post(path, body) {
  const res = await fetch(api.base + path, { method: 'POST', headers: { 'x-dsp': '1', 'content-type': 'application/json' }, body: JSON.stringify(body) })
  let json = {}
  try { json = await res.json() } catch { /* empty */ }
  return { status: res.status, body: json, cookie: (res.headers.get('set-cookie') || '').split(';')[0] }
}

describe('captcha on sign-in', () => {
  beforeEach(() => start({ CAPTCHA_REQUIRED: 'true', SESSION_SECRET: 'x'.repeat(32) }))
  afterEach(() => api.close())
  const getCaptcha = async () => (await fetch(`${api.base}/api/captcha`)).json()
  const login = (extra) => post('/api/login', { role: 'admin', username: 'admin', password: 'admin123', ...extra })

  it('serves a picture and refuses sign-in without a correct answer', async () => {
    const c = await getCaptcha()
    expect(c.image).toMatch(/^data:image\/svg\+xml;base64,/)
    expect((await login({})).status).toBe(400)
    expect((await login({ captchaId: c.id, captcha: 'WRONG' })).status).toBe(400)
    expect((await login({ captchaId: 'forged.token', captcha: 'ABCDE' })).status).toBe(400)
    expect((await login({ captchaId: { a: 1 }, captcha: ['x'] })).status).toBe(400)
  })

  it('a picture can be tried only once, even with the right letters afterwards', async () => {
    const c = await getCaptcha()
    // Read the letters from the picture's own signed hash by brute force over nothing: use the SVG text.
    const svg = Buffer.from(c.image.split(',')[1], 'base64').toString()
    const letters = [...svg.matchAll(/>([A-Z2-9])<\/text>/g)].map((m) => m[1]).join('')
    expect(letters).toHaveLength(5)
    expect((await login({ captchaId: c.id, captcha: 'WRONG' })).status).toBe(400)
    expect((await login({ captchaId: c.id, captcha: letters })).status).toBe(400)
    const d = await getCaptcha()
    const l2 = [...Buffer.from(d.image.split(',')[1], 'base64').toString().matchAll(/>([A-Z2-9])<\/text>/g)].map((m) => m[1]).join('')
    const ok = await login({ captchaId: d.id, captcha: l2.toLowerCase() })
    expect(ok.status).toBe(200)
    expect(ok.cookie).toContain('dsp_session=')
  })
})

describe('offers', () => {
  beforeEach(() => start())
  afterEach(() => api.close())
  const call = async (method, path, body, cookie = '') => {
    const res = await fetch(api.base + path, { method, headers: { 'x-dsp': '1', 'content-type': 'application/json', cookie }, body: body === undefined ? undefined : JSON.stringify(body) })
    let json = {}
    try { json = await res.json() } catch { /* empty */ }
    return { status: res.status, body: json }
  }

  it('anyone can read offers, only the admin can add or remove them', async () => {
    const login = await post('/api/login', { role: 'admin', username: 'admin', password: 'admin123' })
    const cookie = login.cookie
    expect((await call('GET', '/api/offers')).body.offers).toEqual([])
    expect((await call('POST', '/api/offers', { title: 'Diwali offer', details: '10% off' })).status).toBe(401)
    const add = await call('POST', '/api/offers', { title: '  Diwali   offer ', details: '10% off' }, cookie)
    expect(add.status).toBe(201)
    expect(add.body.offer.title).toBe('Diwali offer')
    expect((await call('GET', '/api/offers')).body.offers).toHaveLength(1)
    expect((await call('DELETE', `/api/offers/${add.body.offer.id}`)).status).toBe(401)
    expect((await call('DELETE', `/api/offers/${add.body.offer.id}`, undefined, cookie)).status).toBe(200)
    expect((await call('GET', '/api/offers')).body.offers).toEqual([])
    expect((await call('DELETE', '/api/offers/nope', undefined, cookie)).status).toBe(404)
  })

  it('rejects bad offers', async () => {
    const { cookie } = await post('/api/login', { role: 'admin', username: 'admin', password: 'admin123' })
    expect((await call('POST', '/api/offers', { title: 'x' }, cookie)).status).toBe(400)
    expect((await call('POST', '/api/offers', { title: ['a', 'b'], details: {} }, cookie)).status).toBe(400)
    expect((await call('POST', '/api/offers', { title: 'Fine', details: 'z'.repeat(301) }, cookie)).status).toBe(400)
  })
})

describe('bug reports', () => {
  afterEach(() => api.close())
  const startWith = async (mailer) => {
    const handler = createHandler({ env: { NODE_ENV: 'test', ADMIN_PASSWORD: 'admin123' }, store: new MemoryStore(), mailer })
    const server = http.createServer((req, res) => handler(req, res))
    await new Promise((r) => server.listen(0, '127.0.0.1', r))
    api = { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) }
  }

  it('emails a report and replies with emailed: true', async () => {
    const sent = []
    await startWith({ send: async (m) => { sent.push(m); return true } })
    const res = await post('/api/report', { kind: 'bug', message: 'The booking button does nothing', name: 'Ravi', contact: 'ravi@example.com' })
    expect(res.status).toBe(201)
    expect(res.body.emailed).toBe(true)
    expect(sent[0].subject).toContain('Bug report from Ravi')
    expect(sent[0].text).toContain('booking button')
    expect(sent[0].replyTo).toBe('ravi@example.com')
  })

  it('still accepts the report when email is not set up or fails', async () => {
    await startWith({ send: async () => { throw new Error('down') } })
    const res = await post('/api/report', { message: 'Something looks wrong here' })
    expect(res.status).toBe(201)
    expect(res.body.emailed).toBe(false)
  })

  it('rejects short messages, ignores bots, and limits how many one visitor sends', async () => {
    const sent = []
    await startWith({ send: async (m) => { sent.push(m); return true } })
    expect((await post('/api/report', { message: 'short' })).status).toBe(400)
    expect((await post('/api/report', { message: 'A long enough message', website: 'http://spam' })).status).toBe(200)
    expect(sent).toHaveLength(0)
    for (let i = 0; i < 4; i += 1) expect((await post('/api/report', { message: `Report number ${i} here` })).status).toBe(201)
    expect((await post('/api/report', { message: 'One report too many' })).status).toBe(429)
  })
})
