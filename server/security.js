import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

// ---------- passwords: salted scrypt, never stored in plain text ----------

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`
}

export async function verifyPassword(password, stored) {
  const [alg, saltHex, keyHex] = String(stored ?? '').split('$')
  if (alg !== 'scrypt' || !saltHex || !keyHex) return false
  const expected = Buffer.from(keyHex, 'hex')
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

// Used when the account does not exist, so a wrong email takes as long as a wrong password.
export const DUMMY_HASH = `scrypt$${'00'.repeat(16)}$${'00'.repeat(64)}`

// Constant-time string comparison (hashes first so different lengths don't leak).
export function safeEqual(a, b) {
  const ha = createHash('sha256').update(String(a)).digest()
  const hb = createHash('sha256').update(String(b)).digest()
  return timingSafeEqual(ha, hb)
}

// Short fingerprint stored in the session. If the password changes, old sessions stop working.
export const fingerprint = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 12)

// ---------- signed session tokens (HMAC-SHA256) ----------

export function signToken(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyToken(token, secret, nowSec = Math.floor(Date.now() / 1000)) {
  if (typeof token !== 'string') return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = Buffer.from(createHmac('sha256', secret).update(body).digest('base64url'))
  const given = Buffer.from(sig)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    return payload && payload.exp > nowSec ? payload : null
  } catch {
    return null
  }
}

// ---------- cookies ----------

export function parseCookies(header = '') {
  const out = {}
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

export function buildCookie(name, value, { maxAge, secure }) {
  return `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/${maxAge == null ? '' : `; Max-Age=${maxAge}`}${secure ? '; Secure' : ''}`
}
