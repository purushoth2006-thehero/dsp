import { getConfig } from './config.js'
import { createStore } from './store/index.js'
import { HttpError, createService } from './service.js'
import { createNotifier } from './notify.js'
import { REMINDER_KINDS, sendReminders } from './reminders.js'
import { buildCookie, captchaSvg, fingerprint, hashCaptcha, newCaptchaText, hashOtp, newChallengeId, newOtp, parseCookies, safeEqual, signToken, verifyToken } from './security.js'
import { BRAND } from '../src/rules.js'

const COOKIE = 'dsp_session'
const ADMIN_TTL = 12 * 60 * 60 // seconds
const CUSTOMER_TTL = 7 * 24 * 60 * 60
const MAX_LOGIN_ATTEMPTS = 10
const MAX_ACCOUNT_ATTEMPTS = 20 // per account, from anywhere, so a botnet can't guess one password forever
const LOGIN_WINDOW = 15 * 60
const OTP_TTL = 5 * 60 // a login code is valid for 5 minutes
const OTP_MAX_TRIES = 5
const maskPhone = (phone) => `******${String(phone).slice(-4)}`
const CAPTCHA_TTL = 5 * 60
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function send(res, status, body, headers = {}) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('x-content-type-options', 'nosniff')
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value)
  res.end(JSON.stringify(body))
}

// A request body must be a JSON object; null, arrays and plain values become an empty object.
const asObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})

async function readJson(req) {
  // On Vercel the body may already be parsed into req.body.
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return asObject(req.body)
    try {
      return asObject(JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body)))
    } catch {
      throw new HttpError(400, 'Invalid request.')
    }
  }
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 100_000) throw new HttpError(413, 'Request too large.')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  try {
    return asObject(JSON.parse(Buffer.concat(chunks).toString('utf8')))
  } catch {
    throw new HttpError(400, 'Invalid request.')
  }
}

const clientIp = (req) =>
  String(req.headers['x-vercel-forwarded-for'] ?? req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()
  || req.socket?.remoteAddress
  || 'unknown'

// env/store/now can be injected for tests; on Vercel everything comes from environment variables.
export function createHandler({ env = process.env, store: injectedStore, now, notifier: injectedNotifier } = {}) {
  const cfg = getConfig(env)
  const store = injectedStore ?? createStore(cfg)
  const service = store ? createService(store, now ? { now } : {}) : null
  const notifier = injectedNotifier ?? createNotifier(env)

  // Every sign-in needs a code sent to the person's mobile, once a messaging account (Twilio) is set up.
  const otpOn = notifier.channels.length > 0 && cfg.otpRequired

  const secureCookie = (req) => cfg.prod || req.headers['x-forwarded-proto'] === 'https'
  const clearCookie = (req) => buildCookie(COOKIE, '', { maxAge: 0, secure: secureCookie(req) })

  async function getSession(req) {
    const payload = verifyToken(parseCookies(req.headers.cookie)[COOKIE], cfg.secret)
    if (!payload) return null
    if (payload.r === 'admin') {
      return safeEqual(payload.ph, fingerprint(cfg.adminPass)) ? { role: 'admin' } : null
    }
    if (payload.r === 'customer') {
      const customer = await service.getCustomer(payload.id)
      if (!customer || payload.ph !== fingerprint(customer.passwordHash)) return null
      return { role: 'customer', id: customer.id, customer }
    }
    return null
  }

  async function requireAdmin(req) {
    const session = await getSession(req)
    if (!session) throw new HttpError(401, 'Please sign in.')
    if (session.role !== 'admin') throw new HttpError(403, 'Only the administrator can do this.')
  }

  async function requireSession(req) {
    const session = await getSession(req)
    if (!session) throw new HttpError(401, 'Please sign in.')
    return session
  }

  // Who is acting. The service lets a customer touch only their own lessons.
  const actorOf = (session) => (session.role === 'admin' ? { role: 'admin' } : { role: 'customer', id: session.id })

  async function sessionInfo(req, res) {
    const session = await getSession(req)
    if (!session) {
      const hadCookie = Boolean(parseCookies(req.headers.cookie)[COOKIE])
      return send(res, 200, { session: null, customers: [], appointments: [] }, hadCookie ? { 'set-cookie': clearCookie(req) } : {})
    }
    const data = await service.snapshot(session)
    const publicSession = session.role === 'admin' ? { role: 'admin' } : { role: 'customer', id: session.id }
    return send(res, 200, { session: publicSession, ...data })
  }

  // A fresh picture to type in. The answer is not stored: it lives only as a signed hash inside the id.
  async function newCaptcha(res) {
    if (!cfg.captchaRequired) return send(res, 200, { id: null })
    const text = newCaptchaText()
    const nonce = newChallengeId()
    const id = signToken({ n: nonce, h: hashCaptcha(text, nonce, cfg.secret), exp: Math.floor(Date.now() / 1000) + CAPTCHA_TTL }, cfg.secret)
    const image = `data:image/svg+xml;base64,${Buffer.from(captchaSvg(text)).toString('base64')}`
    return send(res, 200, { id, image }, { 'cache-control': 'no-store' })
  }

  // Each captcha can be tried once: the nonce is burned whether the answer is right or wrong.
  async function checkCaptcha(body) {
    if (!cfg.captchaRequired) return
    const bad = new HttpError(400, 'Please type the letters from the picture. (Press refresh for a new picture.)')
    const token = verifyToken(typeof body.captchaId === 'string' ? body.captchaId : '', cfg.secret)
    if (!token || typeof body.captcha !== 'string') throw bad
    if (!(await store.setnx(`captcha:${token.n}`, '1'))) throw bad
    if (!safeEqual(hashCaptcha(body.captcha, token.n, cfg.secret), token.h)) throw bad
  }

  async function login(req, res) {
    const body = await readJson(req)

    const key = `rl:login:${clientIp(req)}`
    const account = body.role === 'admin' ? `admin:${String(body.username ?? '').slice(0, 60).toLowerCase()}` : `student:${String(body.identifier ?? '').replace(/\D/g, '').slice(-10)}`
    const accountKey = `rl:acct:${account}`
    const tooMany = new HttpError(429, 'Too many sign-in attempts. Please wait 15 minutes and try again.')
    if ((await store.incr(key, LOGIN_WINDOW)) > MAX_LOGIN_ATTEMPTS) throw tooMany
    await checkCaptcha(body)
    if ((await store.incr(accountKey, LOGIN_WINDOW)) > MAX_ACCOUNT_ATTEMPTS) throw tooMany

    let payload
    let maxAge
    if (body.role === 'admin') {
      // Only real strings count: an array like ["secret"] would otherwise turn into the string "secret".
      const typed = typeof body.username === 'string' && typeof body.password === 'string'
      const userOk = safeEqual(typed ? body.username : '', cfg.adminUser)
      const passOk = safeEqual(typed ? body.password : '', cfg.adminPass)
      if (!(typed && userOk && passOk)) throw new HttpError(401, 'Invalid admin credentials.')
      maxAge = ADMIN_TTL
      payload = { r: 'admin', ph: fingerprint(cfg.adminPass) }
    } else if (body.role === 'customer') {
      const customer = await service.verifyLogin(body.identifier, body.password)
      if (!customer) throw new HttpError(401, 'Invalid mobile number or password.')
      maxAge = CUSTOMER_TTL
      payload = { r: 'customer', id: customer.id, ph: fingerprint(customer.passwordHash), phone: customer.phone }
    } else {
      throw new HttpError(400, 'Invalid request.')
    }

    if (otpOn) {
      // Password is right: send a code and wait for it. No session exists until the code is verified.
      const phone = body.role === 'admin' ? cfg.adminPhone : payload.phone
      const challenge = newChallengeId()
      const code = newOtp()
      const record = {
        session: { r: payload.r, id: payload.id, ph: payload.ph, maxAge },
        admin: body.role === 'admin', phone, hash: hashOtp(code, challenge, cfg.secret),
        exp: Date.now() + OTP_TTL * 1000, tries: 0, keys: [key, accountKey],
      }
      await store.set(`otp:${challenge}`, JSON.stringify(record), OTP_TTL * 2)
      const text = `${code} is your ${BRAND} login code. It is valid for 5 minutes. Do not share it with anyone.`
      const outcome = await notifier.send(phone, { text, variables: { 1: code } }, 'otp')
      if (outcome.sent.length === 0) {
        await store.del(`otp:${challenge}`)
        console.error('Could not send login code:', JSON.stringify(outcome.failed))
        throw new HttpError(502, 'We could not send the login code right now. Please try again in a minute.')
      }
      return send(res, 200, { otp: true, challenge, phoneHint: maskPhone(phone) })
    }

    await store.del(key)
    await store.del(accountKey)
    return startSession(req, res, { r: payload.r, id: payload.id, ph: payload.ph, maxAge }, body.role === 'admin')
  }

  function startSession(req, res, { r, id, ph, maxAge }, isAdmin) {
    const token = { r, ph, exp: Math.floor(Date.now() / 1000) + maxAge, ...(id ? { id } : {}) }
    // The admin cookie has no Max-Age, so the browser deletes it when it is closed. (The token also expires after 12 hours.)
    const cookie = buildCookie(COOKIE, signToken(token, cfg.secret), { maxAge: isAdmin ? undefined : maxAge, secure: secureCookie(req) })
    return send(res, 200, { ok: true }, { 'set-cookie': cookie })
  }

  async function verifyCode(req, res) {
    const body = await readJson(req)
    const ipKey = `rl:otp:${clientIp(req)}`
    if ((await store.incr(ipKey, LOGIN_WINDOW)) > MAX_LOGIN_ATTEMPTS * 3) {
      throw new HttpError(429, 'Too many attempts. Please wait 15 minutes and try again.')
    }
    const challenge = typeof body.challenge === 'string' ? body.challenge.slice(0, 64) : ''
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    const raw = challenge && (await store.get(`otp:${challenge}`))
    const record = raw ? JSON.parse(raw) : null
    const expired = new HttpError(400, 'This code has expired. Please sign in again.')
    if (!record || record.exp < Date.now()) {
      if (record) await store.del(`otp:${challenge}`)
      throw expired
    }
    if (record.tries >= OTP_MAX_TRIES) {
      await store.del(`otp:${challenge}`)
      throw new HttpError(429, 'Too many wrong codes. Please sign in again.')
    }
    if (!/^\d{6}$/.test(code) || !safeEqual(hashOtp(code, challenge, cfg.secret), record.hash)) {
      record.tries += 1
      await store.set(`otp:${challenge}`, JSON.stringify(record), OTP_TTL * 2)
      throw new HttpError(401, 'That code is not right. Please check and try again.')
    }
    await store.del(`otp:${challenge}`) // a code works once
    await Promise.all(record.keys.map((k) => store.del(k)))
    return startSession(req, res, record.session, record.admin)
  }

  async function route(req, res) {
    const url = new URL(req.url, 'http://localhost')
    const { pathname } = url
    const path = pathname.replace(/\/+$/, '') || '/'
    const method = req.method ?? 'GET'

    if (path === '/api/health') return send(res, 200, { ok: cfg.problems.length === 0 })
    if (cfg.problems.length > 0) {
      return send(res, 503, { error: 'The server is not set up yet.', code: 'not_configured', problems: cfg.problems })
    }

    // Called on a schedule by Vercel Cron (see vercel.json). Vercel sends `Authorization: Bearer <CRON_SECRET>`.
    if (path === '/api/cron/reminders') {
      if (method !== 'GET') throw new HttpError(405, 'Method not allowed.')
      const secret = env.CRON_SECRET || ''
      if (secret.length < 16) throw new HttpError(503, 'Set CRON_SECRET (at least 16 characters) to turn on reminders.')
      const given = String(req.headers.authorization ?? '').replace(/^Bearer /, '')
      if (!safeEqual(given, secret)) throw new HttpError(401, 'Unauthorized.')
      const kind = url.searchParams.get('kind')
      if (!REMINDER_KINDS.includes(kind)) throw new HttpError(400, 'kind must be day-before or same-day.')
      return send(res, 200, await sendReminders({ service, notifier, kind }))
    }

    // Browsers can't add this header on a cross-site form post, which blocks CSRF.
    if (MUTATING.has(method) && req.headers['x-dsp'] !== '1') throw new HttpError(403, 'Forbidden.')

    if (path === '/api/session') {
      if (method !== 'GET') throw new HttpError(405, 'Method not allowed.')
      return sessionInfo(req, res)
    }
    if (path === '/api/captcha') {
      if (method !== 'GET') throw new HttpError(405, 'Method not allowed.')
      return newCaptcha(res)
    }
    if (path === '/api/login') {
      if (method !== 'POST') throw new HttpError(405, 'Method not allowed.')
      return login(req, res)
    }
    if (path === '/api/login/verify') {
      if (method !== 'POST') throw new HttpError(405, 'Method not allowed.')
      return verifyCode(req, res)
    }
    if (path === '/api/logout') {
      if (method !== 'POST') throw new HttpError(405, 'Method not allowed.')
      return send(res, 200, { ok: true }, { 'set-cookie': clearCookie(req) })
    }

    if (path === '/api/customers') {
      if (method !== 'POST') throw new HttpError(405, 'Method not allowed.')
      await requireAdmin(req)
      return send(res, 201, { customer: await service.addCustomer(await readJson(req)) })
    }

    let match = path.match(/^\/api\/customers\/([\w-]+)$/)
    if (match) {
      await requireAdmin(req)
      if (method === 'PUT') return send(res, 200, { customer: await service.updateCustomer(match[1], await readJson(req)) })
      if (method === 'DELETE') {
        await service.removeCustomer(match[1])
        return send(res, 200, { ok: true })
      }
      throw new HttpError(405, 'Method not allowed.')
    }

    // Which times are taken on one day (no names), so the booking form can grey them out.
    if (path === '/api/slots') {
      if (method !== 'GET') throw new HttpError(405, 'Method not allowed.')
      const session = await requireSession(req)
      return send(res, 200, { slots: await service.takenSlots(url.searchParams.get('date'), actorOf(session)) })
    }

    // Lessons: the admin manages everyone's; a customer manages only their own.
    if (path === '/api/appointments') {
      if (method !== 'POST') throw new HttpError(405, 'Method not allowed.')
      const session = await requireSession(req)
      return send(res, 201, { appointment: await service.bookAppointment(await readJson(req), actorOf(session)) })
    }

    match = path.match(/^\/api\/appointments\/([\w-]+)$/)
    if (match) {
      const session = await requireSession(req)
      if (method === 'PUT') {
        return send(res, 200, { appointment: await service.rescheduleAppointment(match[1], await readJson(req), actorOf(session)) })
      }
      if (method === 'DELETE') {
        await service.cancelAppointment(match[1], actorOf(session))
        return send(res, 200, { ok: true })
      }
      throw new HttpError(405, 'Method not allowed.')
    }

    match = path.match(/^\/api\/appointments\/([\w-]+)\/attendance$/)
    if (match) {
      if (method !== 'PUT') throw new HttpError(405, 'Method not allowed.')
      await requireAdmin(req)
      const body = await readJson(req)
      // { appointment, completed }: `completed` names the customer whose 20th lesson this was (their profile is removed).
      return send(res, 200, await service.setAttendance(match[1], body.attendance ?? null))
    }

    throw new HttpError(404, 'Not found.')
  }

  return async function handler(req, res) {
    try {
      await route(req, res)
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message })
      console.error('API error:', err)
      return send(res, 500, { error: 'Something went wrong on the server. Please try again.' })
    }
  }
}
