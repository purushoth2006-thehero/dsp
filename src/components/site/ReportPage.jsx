import { useState } from 'react'
import { Field } from '../../ui/Field.jsx'

const OWNER_EMAIL = 'purushothaman.e2006@gmail.com'
const KINDS = [
  { value: 'bug', label: 'Bug report' },
  { value: 'review', label: 'Review' },
  { value: 'idea', label: 'Suggestion' },
]

// Visitors report a problem with the website or leave a review. The buttons open their own email app (or Gmail)
// with the message already written, addressed to the owner.
export default function ReportPage() {
  const [kind, setKind] = useState('bug')
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')

  const label = KINDS.find((k) => k.value === kind).label
  const subject = `[Sridhar Driving School] ${label}${name.trim() ? ` from ${name.trim()}` : ''}`
  const body = `${message.trim()}\n\nName: ${name.trim() || '-'}\nContact: ${contact.trim() || '-'}\nPage: ${window.location.origin}\nDevice: ${navigator.userAgent}`
  const q = (v) => encodeURIComponent(v)
  const ready = message.trim().length >= 10
  const mailto = `mailto:${OWNER_EMAIL}?subject=${q(subject)}&body=${q(body)}`
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${q(OWNER_EMAIL)}&su=${q(subject)}&body=${q(body)}`
  const block = (e) => { if (!ready) e.preventDefault() }

  return (
    <>
      <h1>Report a bug</h1>
      <section className="card narrow">
        <form className="form" onSubmit={(e) => e.preventDefault()}>
          <Field label="What is this about?">
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </Field>
          <Field label="Tell us what happened" hint="Which page, and what you did before it went wrong.">
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={2000} />
          </Field>
          <Field label="Your name (optional)">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
          </Field>
          <Field label="Your phone number (optional)" hint="So we can call you back.">
            <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} />
          </Field>
          {!ready && <p className="field-hint">Write at least 10 characters to send.</p>}
          <div className="report-actions">
          <a className="primary social-btn" href={mailto} onClick={block} aria-disabled={!ready}>Send by email</a>
          <a className="ghost social-btn" href={gmail} target="_blank" rel="noopener noreferrer" onClick={block} aria-disabled={!ready}>Open in Gmail</a>
          </div>
        </form>
      </section>
    </>
  )
}
