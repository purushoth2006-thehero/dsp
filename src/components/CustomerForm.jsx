import { useState } from 'react'
import { Field, PasswordInput } from '../ui/Field.jsx'
import { MIN_PASSWORD } from '../rules.js'

const EMPTY = { name: '', email: '', phone: '', password: '', confirm: '' }

// Shared by sign-up, "Add customer" and "Edit customer".
// onSubmit(form) must return { ok, error }.
export default function CustomerForm({
  initial, requirePassword = true, confirmPassword = false,
  submitLabel, onSubmit, onCancel, resetOnSuccess = false,
}) {
  const [form, setForm] = useState({ ...EMPTY, ...initial })
  const [error, setError] = useState('')

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = (e) => {
    e.preventDefault()
    setError('')
    if (confirmPassword && form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    const result = onSubmit(form)
    if (!result.ok) setError(result.error)
    else if (resetOnSuccess) setForm(EMPTY)
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <Field label="Full name">
        <input value={form.name} onChange={set('name')} autoComplete="name" required />
      </Field>
      <Field label="Email">
        <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
      </Field>
      <Field label="Mobile number" hint="10-digit Indian mobile number">
        <input type="tel" inputMode="numeric" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="9876543210" required />
      </Field>
      <Field
        label={requirePassword ? 'Password' : 'New password'}
        hint={requirePassword ? `At least ${MIN_PASSWORD} characters` : 'Leave blank to keep the current password'}
      >
        <PasswordInput value={form.password} onChange={set('password')} autoComplete="new-password" required={requirePassword} />
      </Field>
      {confirmPassword && (
        <Field label="Confirm password">
          <PasswordInput value={form.confirm} onChange={set('confirm')} autoComplete="new-password" required />
        </Field>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      <div className="form-actions">
        <button className="primary" type="submit">{submitLabel}</button>
        {onCancel && <button className="ghost" type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}
