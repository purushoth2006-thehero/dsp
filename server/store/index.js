import { MemoryStore } from './memory.js'
import { UpstashStore } from './upstash.js'

// Upstash when the database variables are set; a local file for development; nothing in production
// without a database (the API then answers "not configured" instead of silently losing data).
export function createStore(cfg) {
  if (cfg.dbUrl && cfg.dbToken) return new UpstashStore({ url: cfg.dbUrl, token: cfg.dbToken })
  if (!cfg.prod) return new MemoryStore({ file: cfg.dataFile })
  return null
}
