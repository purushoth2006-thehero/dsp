// Store backed by Upstash Redis through its REST API (works from Vercel serverless functions).
// Every call is one HTTPS request: POST <url> with a JSON array like ["HSET", "customers", "c1", "{...}"].
export class UpstashStore {
  constructor({ url, token, fetchImpl = fetch }) {
    this.url = url.replace(/\/+$/, '')
    this.token = token
    this.fetch = fetchImpl
  }

  async #cmd(...args) {
    const res = await this.fetch(this.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(args.map(String)),
    })
    let data = {}
    try { data = await res.json() } catch { /* handled below */ }
    if (!res.ok || data.error) throw new Error(data.error || `Database request failed (${res.status})`)
    return data.result
  }

  async hgetall(hash) {
    const result = (await this.#cmd('HGETALL', hash)) ?? []
    // REST returns a flat [field, value, field, value, ...] list.
    const values = Array.isArray(result) ? result.filter((_, i) => i % 2 === 1) : Object.values(result)
    return values.map((v) => JSON.parse(v))
  }

  async hget(hash, id) {
    const v = await this.#cmd('HGET', hash, id)
    return v == null ? null : JSON.parse(v)
  }

  async hset(hash, id, obj) {
    await this.#cmd('HSET', hash, id, JSON.stringify(obj))
  }

  async hdel(hash, id) {
    await this.#cmd('HDEL', hash, id)
  }

  async get(key) {
    return (await this.#cmd('GET', key)) ?? null
  }

  async set(key, value) {
    await this.#cmd('SET', key, value)
  }

  async setnx(key, value) {
    return (await this.#cmd('SET', key, value, 'NX')) === 'OK'
  }

  async del(key) {
    await this.#cmd('DEL', key)
  }

  async incr(key, ttlSec) {
    const n = Number(await this.#cmd('INCR', key))
    if (n === 1) await this.#cmd('EXPIRE', key, ttlSec)
    return n
  }
}
