// Sends bug reports and reviews to the owner's inbox, using the Resend email API (no extra packages).
//
// Environment variables (optional; without RESEND_API_KEY reports are only saved, not emailed):
//   RESEND_API_KEY   from resend.com. Sign up with the same email address that receives the reports.
//   REPORT_TO        where reports go. Defaults to purushothaman.e2006@gmail.com
//   REPORT_FROM      sender. Defaults to Resend's test sender, which can only deliver to the Resend account's own email.
export const DEFAULT_REPORT_TO = 'purushothaman.e2006@gmail.com'

export function createMailer(env = process.env, fetchImpl = fetch) {
  const key = env.RESEND_API_KEY || ''
  const to = env.REPORT_TO || DEFAULT_REPORT_TO
  const from = env.REPORT_FROM || 'Sridhar Driving School <onboarding@resend.dev>'
  return {
    enabled: Boolean(key),
    // Returns true when the email was accepted by Resend.
    async send({ subject, text, replyTo }) {
      if (!key) return false
      const res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
      })
      if (!res.ok) throw new Error(`Email service error ${res.status}`)
      return true
    },
  }
}
