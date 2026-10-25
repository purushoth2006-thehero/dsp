import { describe, expect, it } from 'vitest'
import { createHandler } from './handler.js'
import { createService } from './service.js'
import { createNotifier } from './notify.js'
import { buildReminder } from './reminders.js'
import { MemoryStore } from './store/memory.js'
import { PLACES } from '../src/rules.js'

// Saturday 17 Oct 2026, 10:00 at the school
const NOW = new Date(2026, 9, 17, 10, 0)
const SECRET = 'cron-secret-123456'

function setup() {
  const store = new MemoryStore()
  const service = createService(store, { now: () => NOW })
  const sent = []
  const notifier = {
    channels: ['whatsapp', 'sms'],
    send: async (phone, message) => { sent.push({ phone, ...message }); return { sent: ['whatsapp', 'sms'], failed: [] } },
  }
  const handler = createHandler({ env: { NODE_ENV: 'test', CRON_SECRET: SECRET }, store, now: () => NOW, notifier })
  const call = async (kind, auth = `Bearer ${SECRET}`) => {
    let status = 0
    let body = ''
    const res = { setHeader() {}, end(b) { body = b }, set statusCode(v) { status = v } }
    await handler({ url: `/api/cron/reminders${kind ? `?kind=${kind}` : ''}`, method: 'GET', headers: auth ? { authorization: auth } : {}, socket: {} }, res)
    return { status, body: JSON.parse(body) }
  }
  const customer = (n) => service.addCustomer({ name: `Asha Kumar ${n}`, email: `a${n}@example.com`, phone: `98765000${n}0`, password: 'secret123' })
  const lesson = (customerId, date, time, over = {}) =>
    service.bookAppointment({ customerId, date, time, place: PLACES[0], trainerId: 't1', ...over })
  return { service, sent, call, customer, lesson }
}

describe('lesson reminders', () => {
  it('words the message with the day, time, place and trainer', () => {
    const msg = buildReminder('day-before', { date: '2026-10-18', time: '09:00', place: PLACES[1], trainerId: 't3' }, { name: 'Priya Sharma' })
    expect(msg.text).toBe(`Hello Priya, reminder from Sridhar Driving School: you have a driving class tomorrow (Sun, 18 Oct, 2026) at 9:00 AM at ${PLACES[1]} with Trainer 3 (lady). Please arrive on time.`)
    expect(msg.variables).toMatchObject({ 1: 'Priya', 2: 'tomorrow', 4: '9:00 AM', 5: PLACES[1], 6: 'Trainer 3 (lady)' })
  })

  it('sends tomorrow\'s lessons the evening before, once only', async () => {
    const { call, sent, customer, lesson } = setup()
    const a = await customer(1)
    const b = await customer(2)
    await lesson(a.id, '2026-10-18', '09:00')
    await lesson(b.id, '2026-10-19', '09:00', { place: PLACES[1] }) // not tomorrow
    const first = await call('day-before')
    expect(first.status).toBe(200)
    expect(first.body).toMatchObject({ configured: true, due: 1, sent: 1, failed: 0 })
    expect(sent).toHaveLength(1)
    expect(sent[0].phone).toBe(a.phone)
    expect(sent[0].text).toContain('tomorrow')
    expect((await call('day-before')).body.due).toBe(0) // already reminded
    expect(sent).toHaveLength(1)
  })

  it('sends the same-day reminder only for lessons still to come', async () => {
    const { call, sent, customer, lesson } = setup()
    const a = await customer(1)
    await lesson(a.id, '2026-10-17', '11:00')
    const r = await call('same-day')
    expect(r.body).toMatchObject({ due: 1, sent: 1 })
    expect(sent[0].text).toContain('today')
    // A day-before reminder for the same lesson is a different reminder.
    expect((await call('day-before')).body.due).toBe(0)
  })

  it('reminds again when a lesson is moved, and skips cancelled lessons', async () => {
    const { call, sent, customer, lesson, service } = setup()
    const a = await customer(1)
    const l = await lesson(a.id, '2026-10-18', '09:00')
    await call('day-before')
    await service.rescheduleAppointment(l.id, { date: '2026-10-18', time: '10:00', place: PLACES[0], trainerId: 't1' })
    expect((await call('day-before')).body.sent).toBe(1)
    expect(sent).toHaveLength(2)
    await service.cancelAppointment(l.id)
    expect((await call('day-before')).body.due).toBe(0)
  })

  it('keeps retrying a lesson when every channel fails', async () => {
    const store = new MemoryStore()
    const service = createService(store, { now: () => NOW })
    let works = false
    const notifier = {
      channels: ['sms'],
      send: async () => (works ? { sent: ['sms'], failed: [] } : { sent: [], failed: [{ channel: 'sms', error: 'bad number' }] }),
    }
    const handler = createHandler({ env: { NODE_ENV: 'test', CRON_SECRET: SECRET }, store, now: () => NOW, notifier })
    const run = async () => {
      let body = ''
      await handler({ url: '/api/cron/reminders?kind=day-before', method: 'GET', headers: { authorization: `Bearer ${SECRET}` }, socket: {} }, { setHeader() {}, end(b) { body = b }, set statusCode(v) { void v } })
      return JSON.parse(body)
    }
    const c = await service.addCustomer({ name: 'Asha', email: 'a@example.com', phone: '9876500001', password: 'secret123' })
    await service.bookAppointment({ customerId: c.id, date: '2026-10-18', time: '09:00', place: PLACES[0], trainerId: 't1' })
    expect(await run()).toMatchObject({ due: 1, sent: 0, failed: 1, errors: ['sms: bad number'] })
    works = true
    expect(await run()).toMatchObject({ due: 1, sent: 1 })
  })

  it('needs the secret, a valid kind, and does nothing without a messaging account', async () => {
    const { call } = setup()
    expect((await call('day-before', '')).status).toBe(401)
    expect((await call('day-before', 'Bearer wrong-secret-value')).status).toBe(401)
    expect((await call('nonsense')).status).toBe(400)

    const store = new MemoryStore()
    const noSecret = createHandler({ env: { NODE_ENV: 'test' }, store })
    let status = 0
    await noSecret({ url: '/api/cron/reminders?kind=same-day', method: 'GET', headers: {}, socket: {} }, { setHeader() {}, end() {}, set statusCode(v) { status = v } })
    expect(status).toBe(503)

    const idle = createHandler({ env: { NODE_ENV: 'test', CRON_SECRET: SECRET }, store, now: () => NOW })
    let body = ''
    await idle({ url: '/api/cron/reminders?kind=same-day', method: 'GET', headers: { authorization: `Bearer ${SECRET}` }, socket: {} }, { setHeader() {}, end(b) { body = b }, set statusCode(v) { void v } })
    expect(JSON.parse(body)).toMatchObject({ configured: false, sent: 0 })
  })
})

describe('Twilio notifier', () => {
  it('sends WhatsApp and SMS to the +91 number', async () => {
    const calls = []
    const fetchImpl = async (url, init) => { calls.push({ url, init, body: new URLSearchParams(init.body) }); return { ok: true, json: async () => ({}) } }
    const n = createNotifier({
      TWILIO_ACCOUNT_SID: 'AC123', TWILIO_AUTH_TOKEN: 'tok', TWILIO_WHATSAPP_FROM: '+14155238886', TWILIO_SMS_FROM: '+15005550006',
    }, fetchImpl)
    expect(n.channels).toEqual(['whatsapp', 'sms'])
    const result = await n.send('9876543210', { text: 'Hi', variables: {} })
    expect(result.sent.sort()).toEqual(['sms', 'whatsapp'])
    const wa = calls.find((c) => c.body.get('To').startsWith('whatsapp:'))
    expect(wa.body.get('To')).toBe('whatsapp:+919876543210')
    expect(wa.body.get('From')).toBe('whatsapp:+14155238886')
    expect(wa.body.get('Body')).toBe('Hi')
    expect(wa.url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json')
    expect(wa.init.headers.authorization).toBe(`Basic ${Buffer.from('AC123:tok').toString('base64')}`)
    expect(calls.find((c) => c.body.get('To') === '+919876543210').body.get('From')).toBe('+15005550006')
  })

  it('uses an approved WhatsApp template when one is set, and reports failures', async () => {
    const calls = []
    const fetchImpl = async (url, init) => {
      calls.push(new URLSearchParams(init.body))
      return { ok: false, status: 400, json: async () => ({ message: 'Invalid number' }) }
    }
    const n = createNotifier({ TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't', TWILIO_WHATSAPP_FROM: 'whatsapp:+1415', TWILIO_WHATSAPP_CONTENT_SID: 'HX99' }, fetchImpl)
    const result = await n.send('9876543210', { text: 'Hi', variables: { 1: 'Asha' } })
    expect(calls[0].get('ContentSid')).toBe('HX99')
    expect(JSON.parse(calls[0].get('ContentVariables'))).toEqual({ 1: 'Asha' })
    expect(calls[0].get('Body')).toBeNull()
    expect(result).toEqual({ sent: [], failed: [{ channel: 'whatsapp', error: 'Invalid number' }] })
  })

  it('has no channels without credentials', () => {
    expect(createNotifier({}).channels).toEqual([])
    expect(createNotifier({ TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't' }).channels).toEqual([])
  })
})
