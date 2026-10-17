// Reads the server settings from environment variables.
// In production (Vercel) the secrets MUST be set; locally safe defaults are used for development.

export function getConfig(env = process.env) {
  const prod = env.NODE_ENV === 'production' || Boolean(env.VERCEL)

  const adminUser = env.ADMIN_USERNAME || 'admin'
  const adminPass = env.ADMIN_PASSWORD || (prod ? '' : 'admin123')
  const secret = env.SESSION_SECRET || (prod ? '' : 'dev-only-secret-not-for-production')

  // Vercel's Upstash Redis integration sets either the UPSTASH_REDIS_REST_* or the KV_REST_API_* names.
  const dbUrl = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL || ''
  const dbToken = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN || ''

  const problems = []
  if (prod) {
    if (adminPass.length < 8) problems.push('ADMIN_PASSWORD is not set (use at least 8 characters).')
    if (secret.length < 24) problems.push('SESSION_SECRET is not set (use at least 24 random characters).')
    if (!dbUrl || !dbToken) problems.push('No database is connected (add an Upstash Redis store to the Vercel project).')
  }

  return {
    prod, adminUser, adminPass, secret, dbUrl, dbToken,
    dataFile: env.DSP_DATA_FILE || '.data/db.json',
    problems,
  }
}
