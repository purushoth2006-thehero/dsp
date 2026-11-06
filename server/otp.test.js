import http from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHandler } from './handler.js'
import { MemoryStore } from './store/memory.js'

// A notifier that records the codes instead of messaging anyone.
function fakeNotifier({ fail = false } = {}) {
  const sent = []
  return {
    channels: ['sms'], sent,
    async send(phone, message, kind) {
      if (fail) return { sent: [], failed: [{ channel: 'sms', error: 'down' }] }
      sent.push({ phone, text: message.text, kind, code: message.variables?.[1] })
      return { sent: ['sms'], failed: [] }
    },
  }
}

let api, notifier
async function start(env = {}, n = fakeNotifier()) {
  notifier = n
  const handler = createHandler({ env: { NODE_ENV: 'test', ADMIN_PASSWORD: 'admin123', ...env }, store: new MemoryStore(), notifier })
  const server = http.createServer((req, res) => handler(req, res))
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  api = { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) }
}
async function post(path, body, cookie = '') {
  const res = await fetch(api.base + path, { method: 'POST', headers: { 'x-dsp': '1', 'content-type': 'application/json', cookie }, body: JSON.stringify(body) })
  let json = {}
  try { json = await res.json() } catch { /* empty */ }
  return { status: res.status, body: json, cookie: (res.headers.get('set-cookie') || '').split(';')[0] }
}
const adminLogin = () => post('/api/login', { role: 'admin', username: 'admin', password: 'admin123' })

describe('login codes (OTP)', () => {
  beforeEach(() => start())
  afterEach(() => api.close())

  it('sends the admin code to 7373515196 and gives no session until it is verified', async () => {
    const step1 = await adminLogin()
    expect(step1.status).toBe(200)
    expect(step1.body.otp).toBe(true)
    expect(step1.body.phoneHint).toBe('******5196')
    expect(step1.cookie).toBe('')
    expect(notifier.sent).toHaveLength(1)
    expect(notifier.sent[0].phone).toBe('7373515196')
    const { code } = notifier.sent[0]
    expect(code).toMatch(/^\d{6}$/)
    const step2 = await post('/api/login/verify', { challenge: step1.body.challenge, code })
    expect(step2.status).toBe(200)
    expect(step2.cookie).toContain('dsp_session=')
    // The code works only once.
    expect((await post('/api/login/verify', { challenge: step1.body.challenge, code })).status).toBe(400)
  })

  it('rejects wrong codes and burns the challenge after 5 tries', async () => {
    const { body } = await adminLogin()
    const right = notifier.sent[0].code
    const wrong = right === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i += 1) expect((await post('/api/login/verify', { challenge: body.challenge, code: wrong })).status).toBe(401)
    expect((await post('/api/login/verify', { challenge: body.challenge, code: right })).status).toBe(429)
  })

  it('refuses junk input and unknown challenges', async () => {
    expect((await post('/api/login/verify', { challenge: 'nope', code: '123456' })).status).toBe(400)
    expect((await post('/api/login/verify', { challenge: { a: 1 }, code: ['1'] })).status).toBe(400)
    expect((await post('/api/login/verify', {})).status).toBe(400)
  })

  it('a wrong password never sends a code', async () => {
    const res = await post('/api/login', { role: 'admin', username: 'admin', password: 'nope-nope' })
    expect(res.status).toBe(401)
    expect(notifier.sent).toHaveLength(0)
  })

  it('students get their code on their own mobile', async () => {
    const admin = await adminLogin()
    const a = await post('/api/login/verify', { challenge: admin.body.challenge, code: notifier.sent[0].code })
    const add = await post('/api/customers', { name: 'Ravi Kumar', phone: '9876543210', password: 'secret123', package: 'gold' }, a.cookie)
    expect(add.status).toBe(201)
    const step1 = await post('/api/login', { role: 'customer', identifier: '9876543210', password: 'secret123' })
    expect(step1.body.otp).toBe(true)
    expect(notifier.sent.at(-1).phone).toBe('9876543210')
    const step2 = await post('/api/login/verify', { challenge: step1.body.challenge, code: notifier.sent.at(-1).code })
    expect(step2.status).toBe(200)
    expect(step2.cookie).toContain('dsp_session=')
  })
})

describe('login codes when messaging fails or is off', () => {
  afterEach(() => api.close())

  it('does not sign in when the code cannot be sent', async () => {
    await start({}, fakeNotifier({ fail: true }))
    const res = await adminLogin()
    expect(res.status).toBe(502)
    expect(res.cookie).toBe('')
  })

  it('signs in directly when no messaging account is set up', async () => {
    await start({}, { channels: [], async send() { return { sent: [], failed: [] } } })
    const res = await adminLogin()
    expect(res.body.ok).toBe(true)
    expect(res.cookie).toContain('dsp_session=')
  })

  it('OTP_REQUIRED=false switches codes off', async () => {
    await start({ OTP_REQUIRED: 'false' })
    expect((await adminLogin()).body.ok).toBe(true)
  })
})

describe('captcha on sign-in', () => {
  beforeEach(() => start({ CAPTCHA_REQUIRED: 'true', OTP_REQUIRED: 'false', SESSION_SECRET: 'x'.repeat(32) }))
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
