import fs from 'node:fs'
import path from 'node:path'

// A small Redis-like store used for local development and tests.
// With `file` set it is saved to disk after every change, so `npm run dev` keeps its data.
// Values are kept as JSON strings (like Redis), so callers can never mutate stored data by accident.
export class MemoryStore {
  constructor({ file } = {}) {
    this.file = file
    this.hashes = new Map() // name -> Map(id -> json string)
    this.strings = new Map() // key -> string
    this.counters = new Map() // key -> { n, expires }
    if (file) this.#load()
  }

  #load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'))
      for (const [name, entries] of Object.entries(raw.hashes ?? {})) {
        this.hashes.set(name, new Map(Object.entries(entries)))
      }
      for (const [key, value] of Object.entries(raw.strings ?? {})) this.strings.set(key, value)
    } catch { /* no saved data yet */ }
  }

  #save() {
    if (!this.file) return
    const hashes = {}
    for (const [name, map] of this.hashes) hashes[name] = Object.fromEntries(map)
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify({ hashes, strings: Object.fromEntries(this.strings) }))
    fs.renameSync(tmp, this.file)
  }

  async hgetall(hash) {
    return [...(this.hashes.get(hash)?.values() ?? [])].map((v) => JSON.parse(v))
  }

  async hget(hash, id) {
    const v = this.hashes.get(hash)?.get(id)
    return v === undefined ? null : JSON.parse(v)
  }

  async hset(hash, id, obj) {
    if (!this.hashes.has(hash)) this.hashes.set(hash, new Map())
    this.hashes.get(hash).set(id, JSON.stringify(obj))
    this.#save()
  }

  async hdel(hash, id) {
    this.hashes.get(hash)?.delete(id)
    this.#save()
  }

  async get(key) {
    return this.strings.get(key) ?? null
  }

  async set(key, value) {
    this.strings.set(key, String(value))
    this.#save()
  }

  // Sets the key only if it does not exist yet. Returns true when this call created it.
  async setnx(key, value) {
    if (this.strings.has(key)) return false
    this.strings.set(key, String(value))
    this.#save()
    return true
  }

  async del(key) {
    this.strings.delete(key)
    this.counters.delete(key)
    this.#save()
  }

  // Counts attempts; the counter disappears `ttlSec` seconds after the first one.
  async incr(key, ttlSec) {
    const now = Date.now()
    const current = this.counters.get(key)
    if (!current || current.expires <= now) {
      this.counters.set(key, { n: 1, expires: now + ttlSec * 1000 })
      return 1
    }
    current.n += 1
    return current.n
  }
}
