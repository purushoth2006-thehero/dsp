// Sends lesson reminders to customers by WhatsApp and SMS, using Twilio's REST API (no extra packages).
//
// Environment variables (all optional; without them reminders are simply not sent):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
//   TWILIO_WHATSAPP_FROM          e.g. whatsapp:+14155238886 (Twilio sandbox) or your approved WhatsApp sender
//   TWILIO_WHATSAPP_CONTENT_SID   optional approved WhatsApp template (needed to message people first)
//   TWILIO_SMS_FROM               your Twilio phone number or sender ID
export function createNotifier(env = process.env, fetchImpl = fetch) {
  const sid = env.TWILIO_ACCOUNT_SID || ''
  const token = env.TWILIO_AUTH_TOKEN || ''
  const whatsappFrom = env.TWILIO_WHATSAPP_FROM || ''
  const contentSid = env.TWILIO_WHATSAPP_CONTENT_SID || ''
  const smsFrom = env.TWILIO_SMS_FROM || ''

  const channels = []
  if (sid && token && whatsappFrom) channels.push('whatsapp')
  if (sid && token && smsFrom) channels.push('sms')

  async function post(params) {
    const res = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    })
    if (!res.ok) {
      let message = `Twilio error ${res.status}`
      try { message = (await res.json()).message || message } catch { /* not JSON */ }
      throw new Error(message)
    }
  }

  const withPrefix = (value) => (value.startsWith('whatsapp:') ? value : `whatsapp:${value}`)

  return {
    channels,

    // phone: 10-digit Indian mobile number. Returns { sent: [channel...], failed: [{ channel, error }] }.
    async send(phone, { text, variables }) {
      const to = `+91${phone}`
      const sent = []
      const failed = []
      await Promise.all(channels.map(async (channel) => {
        try {
          if (channel === 'whatsapp') {
            await post(contentSid
              ? { To: withPrefix(to), From: withPrefix(whatsappFrom), ContentSid: contentSid, ContentVariables: JSON.stringify(variables) }
              : { To: withPrefix(to), From: withPrefix(whatsappFrom), Body: text })
          } else {
            await post({ To: to, From: smsFrom, Body: text })
          }
          sent.push(channel)
        } catch (err) {
          failed.push({ channel, error: err.message })
        }
      }))
      return { sent, failed }
    },
  }
}
