import { createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

// ---------- passwords: salted scrypt, never stored in plain text ----------

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`
}

export const MAX_PASSWORD = 128

export async function verifyPassword(password, stored) {
  if (String(password).length > MAX_PASSWORD) return false // never hash a huge input
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
    const value = part.slice(i + 1).trim()
    try {
      out[part.slice(0, i).trim()] = decodeURIComponent(value)
    } catch {
      out[part.slice(0, i).trim()] = '' // a malformed cookie is ignored instead of breaking the request
    }
  }
  return out
}

export function buildCookie(name, value, { maxAge, secure }) {
  return `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/${maxAge == null ? '' : `; Max-Age=${maxAge}`}${secure ? '; Secure' : ''}`
}

// ---------- one-time codes (OTP) ----------

export const newOtp = () => String(randomInt(0, 1_000_000)).padStart(6, '0')
export const newChallengeId = () => randomBytes(18).toString('base64url')
// The code is stored only as an HMAC, tied to its challenge, so a database leak does not reveal live codes.
export const hashOtp = (code, challengeId, secret) =>
  createHmac('sha256', secret).update(`otp|${challengeId}|${code}`).digest('hex')

// ---------- captcha (a distorted-text picture; no outside service needed) ----------

const CAPTCHA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O, 1/I that people mix up
export const newCaptchaText = () => Array.from({ length: 5 }, () => CAPTCHA_CHARS[randomInt(CAPTCHA_CHARS.length)]).join('')
export const hashCaptcha = (text, nonce, secret) =>
  createHmac('sha256', secret).update(`captcha|${nonce}|${String(text).trim().toUpperCase()}`).digest('hex')

export function captchaSvg(text) {
  const r = (n) => randomInt(n)
  const letters = [...text].map((ch, i) => {
    const x = 18 + i * 26, y = 36 + r(8), rot = r(41) - 20
    const fill = `hsl(${r(360)},60%,35%)`
    return `<text x="${x}" y="${y}" font-size="${28 + r(6)}" font-family="monospace" font-weight="bold" fill="${fill}" transform="rotate(${rot} ${x} ${y})">${ch}</text>`
  }).join('')
  const lines = Array.from({ length: 5 }, () =>
    `<line x1="${r(160)}" y1="${r(50)}" x2="${r(160)}" y2="${r(50)}" stroke="hsl(${r(360)},50%,55%)" stroke-width="1.5"/>`).join('')
  const dots = Array.from({ length: 25 }, () => `<circle cx="${r(160)}" cy="${r(50)}" r="1.3" fill="#888"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="50" viewBox="0 0 160 50"><rect width="160" height="50" fill="#f3f4f6"/>${lines}${letters}${dots}</svg>`
}
