import { useState } from 'react'
import { Field, PasswordInput } from '../ui/Field.jsx'
import { MIN_PASSWORD } from '../rules.js'

const EMPTY = { name: '', email: '', phone: '', password: '' }

// Used by the admin to add and edit customers.
// onSubmit(form) may be async and must resolve to { ok, error }.
export default function CustomerForm({
  initial, requirePassword = true, submitLabel, onSubmit, onCancel, resetOnSuccess = false,
}) {
  const [form, setForm] = useState({ ...EMPTY, ...initial })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const result = await onSubmit(form)
    setBusy(false)
    if (!result.ok) setError(result.error)
    else if (resetOnSuccess) setForm(EMPTY)
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <Field label="Full name">
        <input value={form.name} onChange={set('name')} autoComplete="off" required />
      </Field>
      <Field label="Email">
        <input type="email" value={form.email} onChange={set('email')} autoComplete="off" required />
      </Field>
      <Field label="Mobile number" hint="10-digit Indian mobile number">
        <input type="tel" inputMode="numeric" value={form.phone} onChange={set('phone')} autoComplete="off" placeholder="9876543210" required />
      </Field>
      <Field
        label={requirePassword ? 'Password' : 'New password'}
        hint={requirePassword
          ? `At least ${MIN_PASSWORD} characters. Give it to the customer: they sign in with their email or mobile number and this password.`
          : 'Leave blank to keep the current password. Setting a new one signs the customer out everywhere.'}
      >
        <PasswordInput value={form.password} onChange={set('password')} autoComplete="new-password" required={requirePassword} />
      </Field>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="form-actions">
        <button className="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        {onCancel && <button className="ghost" type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}
