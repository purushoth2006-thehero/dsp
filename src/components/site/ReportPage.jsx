import { useState } from 'react'
import { request } from '../../api.js'
import { Field } from '../../ui/Field.jsx'

const KINDS = [
  { value: 'bug', label: 'Something is not working' },
  { value: 'review', label: 'Review' },
  { value: 'idea', label: 'Suggestion' },
]

// Visitors report a problem with the website, or leave a review. It is emailed to the owner.
export default function ReportPage() {
  const [kind, setKind] = useState('bug')
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [website, setWebsite] = useState('') // hidden; only bots fill it in
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const res = await request('POST', '/api/report', {
      kind, message, name, contact, website,
      page: document.referrer || window.location.origin,
      device: navigator.userAgent,
    })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setSent(true)
    return setMessage('')
  }

  return (
    <>
      <h1>Report a bug</h1>
      <section className="card narrow">
        {sent ? (
          <>
            <h2>Thank you</h2>
            <p>Your message has been sent. We will look at it soon.</p>
            <button type="button" className="primary" onClick={() => setSent(false)}>Send another</button>
          </>
        ) : (
          <form className="form" onSubmit={submit}>
            <Field label="What is this about?">
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </Field>
            <Field label="Tell us what happened" hint="Which page, and what you did before it went wrong.">
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={2000} required minLength={10} />
            </Field>
            <Field label="Your name (optional)">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
            </Field>
            <Field label="Phone or email (optional)" hint="Only if you want us to reply.">
              <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} />
            </Field>
            <div className="hp" aria-hidden="true">
              <label>Leave this empty<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
            </div>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send'}</button>
          </form>
        )}
      </section>
    </>
  )
}
