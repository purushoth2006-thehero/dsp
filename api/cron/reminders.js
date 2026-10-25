// GET /api/cron/reminders?kind=day-before|same-day (called by Vercel Cron)
import { createHandler } from '../../server/handler.js'

export default createHandler()
