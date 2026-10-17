import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHandler } from './server/handler.js'

// Serves /api/* with the same code that runs on Vercel, so `npm run dev` and `npm run preview`
// work on your own computer. Data is saved to .data/db.json (ignored by git).
function localApi() {
  const mount = (server) => {
    const handler = createHandler({ env: { ...process.env, NODE_ENV: 'development', VERCEL: '' } })
    server.middlewares.use((req, res, next) => {
      if (req.url && req.url.startsWith('/api')) handler(req, res)
      else next()
    })
  }
  return { name: 'dsp-local-api', configureServer: mount, configurePreviewServer: mount }
}

export default defineConfig({
  plugins: [react(), localApi()],
  server: { host: true },
})
