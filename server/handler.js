import { getConfig } from './config.js'
import { createStore } from './store/index.js'
import { HttpError, createService } from './service.js'
import { buildCookie, fingerprint, parseCookies, safeEqual, signToken, verifyToken } from './security.js'

const COOKIE = 'dsp_session'
const ADMIN_TTL = 12 * 60 * 60 // seconds
const CUSTOMER_TTL = 7 * 24 * 60 * 60
const MAX_LOGIN_ATTEMPTS = 10
const LOGIN_WINDOW = 15 * 60
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function send(res, status, body, headers = {}) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('x-content-type-options', 'nosniff')
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value)
  res.end(JSON.stringify(body))
}

async function readJson(req) {
  // On Vercel the body may already be parsed into req.body.
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body
    try {
      return JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body))
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
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'Invalid request.')
  }
}

const clientIp = (req) =>
  String(req.headers['x-vercel-forwarded-for'] ?? req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()
  || req.socket?.remoteAddress
  || 'unknown'

// env/store/now can be injected for tests; on Vercel everything comes from environment variables.
export function createHandler({ env = process.env, store: injectedStore, now } = {}) {
  const cfg = getConfig(env)
  const store = injectedStore ?? createStore(cfg)
  const service = store ? createService(store, now ? { now } : {}) : null

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

  async function login(req, res) {
    const body = await readJson(req)

    const key = `rl:login:${clientIp(req)}`
    if ((await store.incr(key, LOGIN_WINDOW)) > MAX_LOGIN_ATTEMPTS) {
      throw new HttpError(429, 'Too many sign-in attempts. Please wait 15 minutes and try again.')
    }

    const nowSec = Math.floor(Date.now() / 1000)
    let payload
    let maxAge
    if (body.role === 'admin') {
      const userOk = safeEqual(body.username ?? '', cfg.adminUser)
      const passOk = safeEqual(body.password ?? '', cfg.adminPass)
      if (!(userOk && passOk)) throw new HttpError(401, 'Invalid admin credentials.')
      maxAge = ADMIN_TTL
      payload = { r: 'admin', ph: fingerprint(cfg.adminPass), exp: nowSec + maxAge }
    } else if (body.role === 'customer') {
      const customer = await service.verifyLogin(body.identifier, body.password)
      if (!customer) throw new HttpError(401, 'Invalid email/mobile number or password.')
      maxAge = CUSTOMER_TTL
      payload = { r: 'customer', id: customer.id, ph: fingerprint(customer.passwordHash), exp: nowSec + maxAge }
    } else {
      throw new HttpError(400, 'Invalid request.')
    }

    await store.del(key)
    const cookie = buildCookie(COOKIE, signToken(payload, cfg.secret), { maxAge, secure: secureCookie(req) })
    return send(res, 200, { ok: true }, { 'set-cookie': cookie })
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

    // Browsers can't add this header on a cross-site form post, which blocks CSRF.
    if (MUTATING.has(method) && req.headers['x-dsp'] !== '1') throw new HttpError(403, 'Forbidden.')

    if (path === '/api/session') {
      if (method !== 'GET') throw new HttpError(405, 'Method not allowed.')
      return sessionInfo(req, res)
    }
    if (path === '/api/login') {
      if (method !== 'POST') throw new HttpError(405, 'Method not allowed.')
      return login(req, res)
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
